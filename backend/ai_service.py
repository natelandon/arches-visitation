"""AI chart explanations with structured output and number checking.

The model must return JSON that matches `ModelExplanation`: a short summary
plus a list of claims, each naming the number it uses and the field in the
chart data it came from. Every claim is then checked against the data the
model was given, and any other number written in the summary is checked too.
If a claim is wrong, the model gets one retry with the errors as feedback.
"""

import json
import logging
import math
import os
import re
from typing import Any, Dict, List, Literal, Optional, Tuple

import httpx
from pydantic import BaseModel, Field, ValidationError

logger = logging.getLogger(__name__)

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
DEFAULT_MODEL = os.getenv("OLLAMA_MODEL", "mistral")
GENERATE_TIMEOUT_SECONDS = float(os.getenv("OLLAMA_TIMEOUT_SECONDS", "240"))
MAX_ATTEMPTS = 2
MAX_CLAIMS = 4
MAX_SUMMARY_WORDS = 60

ChartType = Literal["annual_trends", "monthly_breakdown", "heatmap", "monthly_rank"]


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class Claim(BaseModel):
    """One number the model used, and where in the data it came from."""

    text: str = Field(description="The phrase from the summary that states this number.")
    value: float = Field(description="The number exactly as it appears in the data.")
    source_field: str = Field(
        description=(
            "Dot path of the data field the number came from, for example "
            "'stats.visitors' or 'years_covered.0'."
        )
    )


class ModelExplanation(BaseModel):
    """The JSON shape the model is required to return."""

    summary: str = Field(description="A short, plain-language explanation of the chart.")
    # maxItems goes into the JSON schema Ollama constrains generation with, so
    # the model can't list a claim for every value. On a laptop CPU Mistral
    # writes ~4 tokens/s, so output length is what decides response time.
    claims: List[Claim] = Field(
        description="Every number mentioned in the summary.", max_length=MAX_CLAIMS
    )


ClaimStatus = Literal["verified", "mismatch", "unknown_field"]


class CheckedClaim(Claim):
    status: ClaimStatus
    actual: Optional[float] = None


VerificationStatus = Literal["verified", "partially_verified", "failed"]


class Verification(BaseModel):
    status: VerificationStatus
    claims: List[CheckedClaim]
    # Numbers written in the summary that don't match any value in the data.
    # These may be legitimate (for example a percentage the model worked out),
    # but they could not be checked, so the UI flags them.
    unchecked_numbers: List[str]
    attempts: int
    model: str


class ExplanationResult(BaseModel):
    explanation: str
    verification: Verification


class AIServiceError(Exception):
    """The model could not be reached or did not return a usable answer."""


# ---------------------------------------------------------------------------
# Number checking (pure functions, no model involved)
# ---------------------------------------------------------------------------

def _to_number(value: Any) -> Optional[float]:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value) if math.isfinite(value) else None
    if isinstance(value, str):
        try:
            number = float(value.replace(",", "").strip())
        except ValueError:
            return None
        return number if math.isfinite(number) else None
    return None


def flatten_numbers(data: Any, prefix: str = "") -> Dict[str, float]:
    """Map every numeric leaf in `data` to its dot path."""
    numbers: Dict[str, float] = {}
    if isinstance(data, dict):
        items = data.items()
    elif isinstance(data, list):
        items = enumerate(data)
    else:
        number = _to_number(data)
        if number is not None and prefix:
            numbers[prefix] = number
        return numbers

    for key, value in items:
        path = f"{prefix}.{key}" if prefix else str(key)
        numbers.update(flatten_numbers(value, path))
    return numbers


def values_match(claimed: float, actual: float, tolerance: Optional[float] = None) -> bool:
    """Compare ignoring sign, so "a decline of 2,100" matches -2100."""
    if tolerance is None:
        tolerance = max(abs(actual) * 0.01, 0.5)
    return abs(abs(claimed) - abs(actual)) <= tolerance


_MULTIPLIERS = {"million": 1_000_000, "m": 1_000_000, "thousand": 1_000, "k": 1_000}

# A number, optionally followed by a scale word and/or a percent sign.
# The look-arounds skip ordinals like "1st" and numbers inside words.
_NUMBER_PATTERN = re.compile(
    r"(?<![\w.])(-?\d[\d,]*(?:\.\d+)?)"
    r"(?:\s*(million|thousand|[mk])(?![a-z]))?"
    r"(%)?(?![\w])",
    re.IGNORECASE,
)


def extract_numbers(text: str, include_counts: bool = False) -> List[Tuple[str, float, float]]:
    """Find numbers written in free text.

    Returns (original text, value, tolerance). The tolerance comes from how
    precisely the number was written, so "1.2 million" matches 1,234,567.
    By default, ordinals ("10th") and small whole numbers (0-12) are skipped:
    in a summary they are usually counts like "3 months", not data values.
    With include_counts=True they are kept, for checking a claim's sentence,
    where a rank like "10th" is exactly the value being claimed.
    """
    # "COVID-19" is a name, not a data value.
    text = re.sub(r"COVID-19", "COVID", text, flags=re.IGNORECASE)
    if include_counts:
        text = re.sub(r"(\d)(?:st|nd|rd|th)\b", r"\1", text, flags=re.IGNORECASE)
    found = []
    for match in _NUMBER_PATTERN.finditer(text):
        raw, scale, _percent = match.groups()
        digits = raw.replace(",", "")
        try:
            number = float(digits)
        except ValueError:
            continue
        decimals = len(digits.split(".")[1]) if "." in digits else 0
        multiplier = _MULTIPLIERS.get((scale or "").lower(), 1)

        if not include_counts and multiplier == 1 and decimals == 0 and abs(number) <= 12:
            continue

        value = number * multiplier
        rounding = 0.5 * (10 ** -decimals) * multiplier
        tolerance = max(rounding, abs(value) * 0.005, 0.5)
        found.append((match.group(0).strip(), value, tolerance))
    return found


def claim_matches(claim: Claim, actual: float) -> bool:
    """True if the claim's sentence states the value of the field it cites.

    The number written in the sentence is what readers see, so that is what
    gets checked. Comparing only `claim.value` let a sentence state one number
    while the claim cited (and copied) a different field.
    """
    written = extract_numbers(claim.text, include_counts=True)
    if not written:
        return values_match(claim.value, actual)
    return any(values_match(value, actual, tolerance) for _, value, tolerance in written)


# Parentheses holding a data field name, e.g. "(record_year.visitors_lost)".
# Each part of the name has 2+ characters, so "(e.g. ...)" is left alone.
_FIELD_NAME_PARENS = re.compile(r"\s*\([^()]*\b[a-z][a-z0-9]+(?:[._][A-Za-z0-9]+)+\b[^()]*\)")


def strip_field_names(summary: str) -> str:
    """Remove parenthesized field names the model copied into the summary."""
    return _FIELD_NAME_PARENS.sub("", summary)


def verify_explanation(
    explanation: ModelExplanation, data: Dict[str, Any]
) -> Tuple[List[CheckedClaim], List[str]]:
    """Check the model's claims and summary numbers against the chart data."""
    numbers = flatten_numbers(data)

    checked: List[CheckedClaim] = []
    for claim in explanation.claims:
        path = claim.source_field.strip()
        actual = numbers.get(path)
        # Models sometimes add a "claim" for a sentence with no number in it,
        # with a placeholder field like "-". There is nothing to check, so skip it.
        if actual is None and not re.search(r"\d", claim.text):
            continue
        if actual is None:
            status: ClaimStatus = "unknown_field"
        elif claim_matches(claim, actual):
            status = "verified"
        else:
            status = "mismatch"
        checked.append(CheckedClaim(**claim.model_dump(), status=status, actual=actual))

    unchecked = [
        text
        for text, value, tolerance in extract_numbers(explanation.summary)
        if not any(values_match(value, actual, tolerance) for actual in numbers.values())
    ]
    return checked, unchecked


def overall_status(claims: List[CheckedClaim], unchecked: List[str]) -> VerificationStatus:
    if any(claim.status != "verified" for claim in claims):
        return "failed"
    if unchecked:
        return "partially_verified"
    return "verified"


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

_RULES = f"""
Rules:
- Keep the summary under {MAX_SUMMARY_WORDS} words and mention at most {MAX_CLAIMS} numbers.
- Write the summary for park visitors: never put field names or dot paths in it.
- Use only numbers that appear in the data. Do not calculate new totals or percentages.
- Claims are only for numbers. For every number in the summary, add a claim with the exact value from the data and
  the dot path of the field it came from (list positions are numbers, e.g. "years_covered.0").
- Do not state causes as facts, except those given under Context. If you mention a
  possible reason (season, weather, holidays, school schedules), present it as a likely factor.
- Respond only with JSON that matches the schema.
""".strip()

# Known history the model may state as fact. Without it, a small model
# describes 2020 as just "an unusually low year".
COVID_CONTEXT = (
    "In 2020 Arches National Park closed for about two months in the spring "
    "because of the COVID-19 pandemic. 2020's drop in visitation is an aberration "
    "caused by that closure, not part of the long-term trend. If you mention 2020 "
    "or the biggest decline, say this."
)
# Added when the model named COVID-19 but didn't say 2020 is an outlier.
ABERRATION_NOTE = "The 2020 drop was an aberration, not part of the long-term trend."
# Added to the summary when the data covers 2020 and the model left it out.
COVID_NOTE = (
    "The 2020 drop is an aberration: the park closed for about two months that "
    "spring because of the COVID-19 pandemic."
)


def covers_2020(data: Dict[str, Any]) -> bool:
    """True if 2020 appears in the data as a value or a key (e.g. annual_totals.2020)."""
    for path, value in flatten_numbers(data).items():
        if value == 2020 or "2020" in path.split("."):
            return True
    return False


def build_prompt(chart_type: ChartType, data: Dict[str, Any]) -> str:
    data_json = json.dumps(data, indent=2)

    if chart_type == "annual_trends":
        task = (
            "Summarize these annual visitation statistics for Arches National Park "
            "in 2-3 sentences for park visitors. The data covers the years in "
            "year_range; total_visitors is the sum over all of them. "
            "average_per_year_last_10_years covers only the latest ten years. "
            "record_year is the busiest year; biggest_rise and "
            "biggest_drop are the largest changes from one year to the next; "
            "recent_annual_totals lists each of the latest years. Cover the overall "
            "trend, the record year, and the biggest rise and drop."
        )
    elif chart_type == "monthly_breakdown":
        task = (
            f"Explain the visitation statistics for {data.get('month', 'this month')} "
            f"at Arches National Park in 1-2 sentences. Say how the month ranks against "
            f"others and mention likely seasonal factors."
        )
    elif chart_type == "heatmap":
        task = (
            "Describe the seasonal pattern in this monthly visitation heatmap for Arches "
            "National Park in 2-3 sentences. The data covers the years in year_range: "
            "monthly_average is each month's average across those years, and "
            "annual_totals is each year's total. Name the busiest and quietest months "
            "and point out any unusually high or low years."
        )
    else:  # monthly_rank
        task = (
            f"In one sentence, explain why {data.get('month', 'this month')} ranks "
            f"#{data.get('rank', '?')} for visitation at Arches National Park."
        )

    context = f"Context:\n{COVID_CONTEXT}\n\n" if covers_2020(data) else ""
    return f"{task}\n\nData:\n{data_json}\n\n{context}{_RULES}"


def _plain(number: float) -> str:
    """Write a number in full for the model: 46406230, not 4.64062e+07."""
    return f"{number:.0f}" if float(number).is_integer() else f"{number:g}"


def build_retry_prompt(
    original_prompt: str, claims: List[CheckedClaim], schema_error: Optional[str]
) -> str:
    problems = []
    if schema_error:
        problems.append(f"- The response was not valid JSON for the schema: {schema_error}")
    for claim in claims:
        if claim.status == "unknown_field":
            problems.append(
                f'- "{claim.source_field}" is not a field in the data (claim: "{claim.text}").'
            )
        elif claim.status == "mismatch":
            problems.append(
                f'- "{claim.text}" cites {claim.source_field}, but {claim.source_field} '
                f"is {_plain(claim.actual)}. Cite the field that holds the number you wrote, "
                f"or correct the number."
            )
    return (
        f"{original_prompt}\n\nYour previous answer had these problems. Fix them:\n"
        + "\n".join(problems)
    )


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class ExplanationService:
    """Calls Ollama asynchronously, so slow generations don't block the server."""

    def __init__(
        self,
        base_url: str = OLLAMA_BASE_URL,
        model: str = DEFAULT_MODEL,
        transport: Optional[httpx.AsyncBaseTransport] = None,
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self._transport = transport  # injected in tests

    def _client(self, timeout: float) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            base_url=self.base_url, timeout=timeout, transport=self._transport
        )

    async def is_available(self) -> bool:
        try:
            async with self._client(timeout=2) as client:
                response = await client.get("/api/tags")
            return response.status_code == 200
        except httpx.HTTPError as e:
            logger.warning(f"Ollama service not available: {e}")
            return False

    async def _generate(self, prompt: str) -> str:
        payload = {
            "model": self.model,
            "prompt": prompt,
            "stream": False,
            # Ollama constrains generation to this JSON schema.
            "format": ModelExplanation.model_json_schema(),
            # Temperature 0 keeps factual summaries consistent between runs.
            "options": {"temperature": 0},
        }
        try:
            async with self._client(timeout=GENERATE_TIMEOUT_SECONDS) as client:
                response = await client.post("/api/generate", json=payload)
        except httpx.TimeoutException as e:
            raise AIServiceError("Explanation generation timed out. Please try again.") from e
        except httpx.HTTPError as e:
            raise AIServiceError(
                "AI explanation service is not available. Please ensure Ollama is running."
            ) from e

        if response.status_code != 200:
            logger.error(f"Ollama API error {response.status_code}: {response.text[:200]}")
            raise AIServiceError("Unable to generate explanation at this time.")
        return response.json().get("response", "")

    async def explain(self, chart_type: ChartType, data: Dict[str, Any]) -> ExplanationResult:
        prompt = build_prompt(chart_type, data)
        current_prompt = prompt
        best: Optional[Tuple[ModelExplanation, List[CheckedClaim], List[str]]] = None

        for attempt in range(1, MAX_ATTEMPTS + 1):
            raw = await self._generate(current_prompt)
            try:
                explanation = ModelExplanation.model_validate_json(raw)
            except ValidationError as e:
                logger.warning(f"Attempt {attempt}: model output failed schema validation")
                current_prompt = build_retry_prompt(prompt, [], str(e.errors()[:3]))
                continue

            explanation.summary = strip_field_names(explanation.summary)
            claims, unchecked = verify_explanation(explanation, data)
            status = overall_status(claims, unchecked)
            best = (explanation, claims, unchecked)
            if status != "failed":
                break

            logger.info(f"Attempt {attempt}: claims did not match the data, retrying")
            current_prompt = build_retry_prompt(prompt, claims, None)

        if best is None:
            raise AIServiceError("The AI model did not return a valid explanation. Please try again.")

        explanation, claims, unchecked = best
        summary = explanation.summary
        if covers_2020(data):
            lowered = summary.lower()
            if "covid" not in lowered:
                summary = f"{summary.rstrip()} {COVID_NOTE}"
            elif "aberration" not in lowered:
                summary = f"{summary.rstrip()} {ABERRATION_NOTE}"
        return ExplanationResult(
            explanation=summary,
            verification=Verification(
                status=overall_status(claims, unchecked),
                claims=claims,
                unchecked_numbers=unchecked,
                attempts=attempt,
                model=self.model,
            ),
        )


explanation_service = ExplanationService()
