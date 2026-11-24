import asyncio
import json

import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from ai_service import AIServiceError, ExplanationService
from database import Base
from explanation_cache import ExplanationCache

DATA = {"stats": {"visitors": 182345}}
GOOD = {
    "summary": "April had 182,345 visitors.",
    "claims": [{"text": "182,345 visitors", "value": 182345, "source_field": "stats.visitors"}],
}


@pytest.fixture
def session_factory():
    # One shared in-memory database per test
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)


def fake_ollama(outputs, delay=0.0):
    """Ollama stand-in that counts generate calls. An Exception output raises."""
    calls = []

    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/tags":
            return httpx.Response(200, json={})
        calls.append(request)
        await asyncio.sleep(delay)
        output = outputs[min(len(calls) - 1, len(outputs) - 1)]
        if isinstance(output, Exception):
            raise output
        return httpx.Response(200, json={"response": json.dumps(output)})

    return httpx.MockTransport(handler), calls


def make_cache(session_factory, transport, model="mistral"):
    service = ExplanationService(base_url="http://ollama.test", model=model, transport=transport)
    return ExplanationCache(service, session_factory)


def test_second_request_is_served_from_cache(session_factory):
    transport, calls = fake_ollama([GOOD])
    cache = make_cache(session_factory, transport)

    first = asyncio.run(cache.explain("monthly_breakdown", DATA))
    second = asyncio.run(cache.explain("monthly_breakdown", DATA))

    assert len(calls) == 1
    assert second == first
    assert cache.get("monthly_breakdown", DATA) == first


def test_cache_survives_a_restart(session_factory):
    transport, calls = fake_ollama([GOOD])
    asyncio.run(make_cache(session_factory, transport).explain("monthly_breakdown", DATA))

    # A new cache object over the same database, as after a backend restart
    restarted = make_cache(session_factory, transport)
    assert restarted.get("monthly_breakdown", DATA) is not None
    asyncio.run(restarted.explain("monthly_breakdown", DATA))
    assert len(calls) == 1


def test_concurrent_requests_share_one_generation(session_factory):
    transport, calls = fake_ollama([GOOD], delay=0.05)
    cache = make_cache(session_factory, transport)

    async def both():
        return await asyncio.gather(
            cache.explain("monthly_breakdown", DATA),
            cache.explain("monthly_breakdown", DATA),
        )

    a, b = asyncio.run(both())
    assert len(calls) == 1
    assert a == b


def test_cancelled_request_still_finishes_and_caches(session_factory):
    transport, calls = fake_ollama([GOOD], delay=0.05)
    cache = make_cache(session_factory, transport)

    async def cancel_then_wait():
        request = asyncio.create_task(cache.explain("monthly_breakdown", DATA))
        await asyncio.sleep(0.01)
        request.cancel()  # e.g. the browser navigated away
        with pytest.raises(asyncio.CancelledError):
            await request
        await asyncio.sleep(0.1)  # the generation keeps going in the background

    asyncio.run(cancel_then_wait())
    assert len(calls) == 1
    assert cache.get("monthly_breakdown", DATA) is not None


def test_failures_are_not_cached(session_factory):
    timeout = httpx.ReadTimeout("timed out")
    transport, calls = fake_ollama([timeout, GOOD])
    cache = make_cache(session_factory, transport)

    with pytest.raises(AIServiceError):
        asyncio.run(cache.explain("monthly_breakdown", DATA))
    assert cache.get("monthly_breakdown", DATA) is None

    asyncio.run(cache.explain("monthly_breakdown", DATA))
    assert len(calls) == 2


def test_different_data_chart_or_model_is_a_miss(session_factory):
    transport, calls = fake_ollama([GOOD])
    cache = make_cache(session_factory, transport)
    asyncio.run(cache.explain("monthly_breakdown", DATA))

    assert cache.get("monthly_breakdown", {"stats": {"visitors": 1}}) is None
    assert cache.get("monthly_rank", DATA) is None
    assert make_cache(session_factory, transport, model="llama3.1").get("monthly_breakdown", DATA) is None


def test_key_ignores_dict_order(session_factory):
    transport, _ = fake_ollama([GOOD])
    cache = make_cache(session_factory, transport)
    a = {"x": 1, "y": {"p": 2, "q": 3}}
    b = {"y": {"q": 3, "p": 2}, "x": 1}
    assert cache.key("heatmap", a) == cache.key("heatmap", b)


WRONG = {
    "summary": "April had 199,000 visitors.",
    "claims": [{"text": "199,000 visitors", "value": 199000, "source_field": "stats.visitors"}],
}
UNCHECKED = {
    "summary": "April had 182,345 visitors, about 1.1 million fewer than expected.",
    "claims": [{"text": "182,345 visitors", "value": 182345, "source_field": "stats.visitors"}],
}


@pytest.mark.parametrize("output, status", [(WRONG, "failed"), (UNCHECKED, "partially_verified")])
def test_only_fully_verified_explanations_are_cached(session_factory, output, status):
    transport, calls = fake_ollama([output])
    cache = make_cache(session_factory, transport)

    result = asyncio.run(cache.explain("monthly_breakdown", DATA))
    assert result.verification.status == status
    assert cache.get("monthly_breakdown", DATA) is None
    calls_for_one_request = len(calls)

    asyncio.run(cache.explain("monthly_breakdown", DATA))
    assert len(calls) == 2 * calls_for_one_request  # asked the model again


def test_unverified_rows_from_before_this_rule_are_ignored(session_factory):
    from database import ExplanationCacheEntry

    transport, _ = fake_ollama([UNCHECKED])
    cache = make_cache(session_factory, transport)
    result = asyncio.run(cache.service.explain("monthly_breakdown", DATA))
    with session_factory() as session:
        session.add(ExplanationCacheEntry(
            key=cache.key("monthly_breakdown", DATA), chart_type="monthly_breakdown",
            model="mistral", result_json=result.model_dump_json(),
        ))
        session.commit()

    assert cache.get("monthly_breakdown", DATA) is None
