import json

import httpx
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import main
from ai_service import ExplanationService
from database import Base
from explanation_cache import ExplanationCache


def _use(monkeypatch, service):
    """Point the endpoint at `service`, with its cache in a fresh in-memory database."""
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    cache = ExplanationCache(service, sessionmaker(bind=engine))
    monkeypatch.setattr(main, "explanation_cache", cache)
    return cache


def _service(model_output):
    def handler(request):
        if request.url.path == "/api/tags":
            return httpx.Response(200, json={})
        return httpx.Response(200, json={"response": json.dumps(model_output)})

    return ExplanationService(base_url="http://ollama.test", transport=httpx.MockTransport(handler))


def test_explain_chart_returns_summary_and_verification(monkeypatch):
    _use(monkeypatch, _service({
        "summary": "The peak year had 1,806,865 visitors.",
        "claims": [{"text": "1,806,865 visitors", "value": 1806865, "source_field": "peak_year_visitors"}],
    }))
    client = TestClient(main.app)

    response = client.post("/api/ai/explain-chart", json={
        "chart_type": "annual_trends",
        "data": {"peak_year_visitors": 1806865},
    })

    body = response.json()
    assert response.status_code == 200
    assert body["available"] is True
    assert body["explanation"] == "The peak year had 1,806,865 visitors."
    assert body["verification"]["status"] == "verified"


def test_unknown_chart_type_is_rejected():
    client = TestClient(main.app)
    response = client.post("/api/ai/explain-chart", json={"chart_type": "pie", "data": {}})
    assert response.status_code == 422


def test_timeout_is_reported_as_an_error_not_as_ollama_missing(monkeypatch):
    def handler(request):
        if request.url.path == "/api/tags":
            return httpx.Response(200, json={})
        raise httpx.ReadTimeout("timed out", request=request)

    _use(monkeypatch, ExplanationService(
        base_url="http://ollama.test", transport=httpx.MockTransport(handler)
    ))
    body = TestClient(main.app).post("/api/ai/explain-chart", json={
        "chart_type": "heatmap", "data": {"x": 1},
    }).json()

    assert body["available"] is False
    assert body["reason"] == "error"
    assert "timed out" in body["explanation"]


def test_unreachable_ollama_is_reported_as_unavailable(monkeypatch):
    def handler(request):
        raise httpx.ConnectError("refused", request=request)

    _use(monkeypatch, ExplanationService(
        base_url="http://ollama.test", transport=httpx.MockTransport(handler)
    ))
    body = TestClient(main.app).post("/api/ai/explain-chart", json={
        "chart_type": "heatmap", "data": {"x": 1},
    }).json()

    assert body["available"] is False
    assert body["reason"] == "unavailable"


def test_cached_explanation_is_served_even_when_ollama_is_down(monkeypatch):
    good = {
        "summary": "The peak year had 1,806,865 visitors.",
        "claims": [{"text": "1,806,865 visitors", "value": 1806865, "source_field": "peak_year_visitors"}],
    }
    cache = _use(monkeypatch, _service(good))
    client = TestClient(main.app)
    request = {"chart_type": "annual_trends", "data": {"peak_year_visitors": 1806865}}

    first = client.post("/api/ai/explain-chart", json=request).json()
    assert first["cached"] is False

    def down(req):
        raise httpx.ConnectError("refused", request=req)

    cache.service = ExplanationService(base_url="http://ollama.test", transport=httpx.MockTransport(down))
    second = client.post("/api/ai/explain-chart", json=request).json()

    assert second["available"] is True
    assert second["cached"] is True
    assert second["explanation"] == first["explanation"]
