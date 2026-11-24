"""Read-only mode (READ_ONLY=1), used for hosting on a read-only filesystem."""
import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.exc import OperationalError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import main
from ai_service import ExplanationService
from database import Base, make_engine
from explanation_cache import ExplanationCache


def _ollama_must_not_be_called(request):
    raise AssertionError(f"read-only mode must not call Ollama: {request.url}")


@pytest.fixture
def read_only(monkeypatch):
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    service = ExplanationService(base_url="http://ollama.test", transport=httpx.MockTransport(_ollama_must_not_be_called))
    cache = ExplanationCache(service, sessionmaker(bind=engine))
    monkeypatch.setattr(main, "explanation_cache", cache)
    monkeypatch.setattr(main, "READ_ONLY", True)
    return cache


def test_adding_and_deleting_entries_is_refused(read_only):
    client = TestClient(main.app)
    added = client.post("/visitation/entry", json={"date": "2026-01-05", "visitors": 10})
    deleted = client.delete("/visitation/entry/1")
    assert added.status_code == 403
    assert deleted.status_code == 403
    assert "read-only" in added.json()["detail"]


def test_uncached_explanation_says_none_was_generated_without_calling_ollama(read_only):
    body = TestClient(main.app).post(
        "/api/ai/explain-chart", json={"chart_type": "heatmap", "data": {"x": 1}}
    ).json()
    assert body["available"] is False
    assert body["reason"] == "error"
    assert "hasn't been generated" in body["explanation"]


def test_status_reports_cached_explanations_as_available(read_only):
    body = TestClient(main.app).get("/api/ai/status").json()
    assert body["available"] is True
    assert body["service"] == "cache"


def test_read_only_engine_reads_but_cannot_write(tmp_path):
    path = tmp_path / "test.db"
    writable = make_engine(path, read_only=False)
    with writable.begin() as conn:
        conn.execute(text("CREATE TABLE t (x INTEGER)"))
        conn.execute(text("INSERT INTO t VALUES (1)"))
    writable.dispose()

    engine = make_engine(path, read_only=True)
    with engine.connect() as conn:
        assert conn.execute(text("SELECT x FROM t")).scalar() == 1
        with pytest.raises(OperationalError):
            conn.execute(text("INSERT INTO t VALUES (2)"))
