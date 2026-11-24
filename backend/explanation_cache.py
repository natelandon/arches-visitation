"""Persistent cache for AI chart explanations.

A local model on a laptop CPU takes 1-2 minutes per explanation, and the chart
data only changes when someone adds an entry, so checked explanations are
stored in SQLite and reused. Only explanations whose numbers all matched the
data ("verified") are stored; anything else is asked for again next time.

The cache key is a hash of the model name and the exact prompt, and the prompt
contains the chart data, the task wording and the rules. So new data, a
different model or an edited prompt all miss the cache automatically. Bump
CACHE_VERSION when something outside the prompt changes the result (such as
the post-processing in ExplanationService.explain).
"""

import asyncio
import hashlib
import json
import logging
from typing import Any, Callable, Dict, Optional

from sqlalchemy.orm import Session

from ai_service import ChartType, ExplanationResult, ExplanationService, ModelExplanation, build_prompt
from database import ExplanationCacheEntry, SessionLocal

logger = logging.getLogger(__name__)

# 2: claims are checked by the number written in their sentence
# 3: 2020 is always called an aberration
CACHE_VERSION = 3


class ExplanationCache:
    def __init__(
        self,
        service: ExplanationService,
        session_factory: Callable[[], Session] = SessionLocal,
    ):
        self.service = service
        self._session_factory = session_factory
        # Generations in progress, so concurrent requests for the same chart
        # share one model run instead of queuing a second one in Ollama.
        self._inflight: Dict[str, asyncio.Task] = {}

    def key(self, chart_type: ChartType, data: Dict[str, Any]) -> str:
        canonical = json.loads(json.dumps(data, sort_keys=True))  # key ignores dict order
        material = json.dumps(
            {
                "version": CACHE_VERSION,
                "model": self.service.model,
                "prompt": build_prompt(chart_type, canonical),
                "schema": ModelExplanation.model_json_schema(),
            },
            sort_keys=True,
        )
        return hashlib.sha256(material.encode()).hexdigest()

    def get(self, chart_type: ChartType, data: Dict[str, Any]) -> Optional[ExplanationResult]:
        with self._session_factory() as session:
            entry = session.get(ExplanationCacheEntry, self.key(chart_type, data))
            if entry is None:
                return None
            result = ExplanationResult.model_validate_json(entry.result_json)
            # Rows saved before only-verified caching may hold unchecked numbers
            return result if result.verification.status == "verified" else None

    async def explain(self, chart_type: ChartType, data: Dict[str, Any]) -> ExplanationResult:
        """Return a cached explanation, or generate, store and return a new one.

        Raises AIServiceError like ExplanationService.explain; failures are not cached.
        """
        cached = self.get(chart_type, data)
        if cached is not None:
            return cached

        key = self.key(chart_type, data)
        task = self._inflight.get(key)
        if task is None:
            task = asyncio.create_task(self._generate_and_store(key, chart_type, data))
            self._inflight[key] = task
            task.add_done_callback(lambda _: self._inflight.pop(key, None))
        # shield: if this request is cancelled (the browser navigated away),
        # the generation still finishes and is cached for next time.
        return await asyncio.shield(task)

    async def _generate_and_store(
        self, key: str, chart_type: ChartType, data: Dict[str, Any]
    ) -> ExplanationResult:
        result = await self.service.explain(chart_type, data)
        if result.verification.status != "verified":
            logger.info(f"Not caching {chart_type} explanation ({result.verification.status})")
            return result
        with self._session_factory() as session:
            session.merge(
                ExplanationCacheEntry(
                    key=key,
                    chart_type=chart_type,
                    model=self.service.model,
                    result_json=result.model_dump_json(),
                )
            )
            session.commit()
        logger.info(f"Cached {chart_type} explanation")
        return result
