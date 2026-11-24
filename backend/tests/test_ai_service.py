import asyncio
import json

import httpx

from ai_service import (
    Claim,
    ExplanationService,
    ModelExplanation,
    extract_numbers,
    flatten_numbers,
    verify_explanation,
)

MONTH_DATA = {
    "month": "April 2025",
    "year": 2025,
    "stats": {"visitors": 182345, "percentage": "12.4", "rank": 3, "avgDaily": 6078},
}


# --- flatten_numbers ------------------------------------------------------

def test_flatten_numbers_builds_dot_paths_and_parses_numeric_strings():
    numbers = flatten_numbers({**MONTH_DATA, "years_covered": [1929, 2024], "flag": True})

    assert numbers["stats.visitors"] == 182345
    assert numbers["stats.percentage"] == 12.4
    assert numbers["years_covered.1"] == 2024
    assert "flag" not in numbers  # booleans are not numbers
    assert "month" not in numbers


# --- extract_numbers ------------------------------------------------------

def test_extract_numbers_handles_commas_scales_and_percent():
    found = {text: value for text, value, _ in extract_numbers(
        "April drew 182,345 visitors (12.4%), about 1.2 million over the season."
    )}
    assert found["182,345"] == 182345
    assert found["12.4%"] == 12.4
    assert found["1.2 million"] == 1_200_000


def test_extract_numbers_skips_ordinals_and_small_counts():
    found = [text for text, _, _ in extract_numbers("The 3rd busiest of 12 months, over 3 weeks.")]
    assert found == []


# --- verify_explanation ---------------------------------------------------

def _explanation(summary, claims):
    return ModelExplanation(summary=summary, claims=[Claim(**c) for c in claims])


def test_correct_claims_are_verified():
    explanation = _explanation(
        "April had 182,345 visitors, 12.4% of the year.",
        [
            {"text": "182,345 visitors", "value": 182345, "source_field": "stats.visitors"},
            {"text": "12.4% of the year", "value": 12.4, "source_field": "stats.percentage"},
        ],
    )
    claims, unchecked = verify_explanation(explanation, MONTH_DATA)

    assert [c.status for c in claims] == ["verified", "verified"]
    assert unchecked == []


def test_wrong_value_is_a_mismatch():
    explanation = _explanation(
        "April had 210,000 visitors.",
        [{"text": "210,000 visitors", "value": 210000, "source_field": "stats.visitors"}],
    )
    claims, unchecked = verify_explanation(explanation, MONTH_DATA)

    assert claims[0].status == "mismatch"
    assert claims[0].actual == 182345
    assert unchecked == ["210,000"]


def test_invented_field_is_unknown():
    explanation = _explanation(
        "April had 182,345 visitors.",
        [{"text": "182,345 visitors", "value": 182345, "source_field": "stats.total"}],
    )
    claims, _ = verify_explanation(explanation, MONTH_DATA)
    assert claims[0].status == "unknown_field"


def test_claims_without_numbers_or_fields_are_ignored():
    # Seen from Mistral: a non-numeric sentence returned as a claim with field "-".
    explanation = _explanation(
        "April had 182,345 visitors. Spring weather is a likely factor.",
        [
            {"text": "182,345 visitors", "value": 182345, "source_field": "stats.visitors"},
            {"text": "Spring weather is a likely factor.", "value": -1, "source_field": "-"},
        ],
    )
    claims, unchecked = verify_explanation(explanation, MONTH_DATA)
    assert [c.status for c in claims] == ["verified"]
    assert unchecked == []


def test_rounded_numbers_in_summary_still_match():
    data = {"total_visitors": 1_234_567}
    explanation = _explanation("About 1.2 million people visited.", [])
    _, unchecked = verify_explanation(explanation, data)
    assert unchecked == []


def test_declines_match_negative_values():
    data = {"biggest_decline_value": -410_000}
    explanation = _explanation(
        "The biggest drop was 410,000 visitors.",
        [{"text": "drop of 410,000", "value": 410000, "source_field": "biggest_decline_value"}],
    )
    claims, unchecked = verify_explanation(explanation, data)
    assert claims[0].status == "verified"
    assert unchecked == []


# --- ExplanationService with a fake Ollama --------------------------------

def _fake_ollama(responses):
    """Return a transport that replies with each model output in turn."""
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/api/tags":
            return httpx.Response(200, json={"models": []})
        body = json.loads(request.content)
        calls.append(body)
        output = responses[min(len(calls) - 1, len(responses) - 1)]
        return httpx.Response(200, json={"response": json.dumps(output)})

    return httpx.MockTransport(handler), calls


GOOD = {
    "summary": "April had 182,345 visitors.",
    "claims": [{"text": "182,345 visitors", "value": 182345, "source_field": "stats.visitors"}],
}
WRONG = {
    "summary": "April had 199,000 visitors.",
    "claims": [{"text": "199,000 visitors", "value": 199000, "source_field": "stats.visitors"}],
}


def test_service_sends_schema_and_returns_verified_result():
    transport, calls = _fake_ollama([GOOD])
    service = ExplanationService(base_url="http://ollama.test", transport=transport)

    result = asyncio.run(service.explain("monthly_breakdown", MONTH_DATA))

    assert result.explanation == "April had 182,345 visitors."
    assert result.verification.status == "verified"
    assert result.verification.attempts == 1
    assert calls[0]["format"]["properties"].keys() >= {"summary", "claims"}
    assert calls[0]["options"]["temperature"] == 0


def test_service_retries_with_feedback_when_numbers_are_wrong():
    transport, calls = _fake_ollama([WRONG, GOOD])
    service = ExplanationService(base_url="http://ollama.test", transport=transport)

    result = asyncio.run(service.explain("monthly_breakdown", MONTH_DATA))

    assert result.verification.status == "verified"
    assert result.verification.attempts == 2
    assert "stats.visitors is 182345" in calls[1]["prompt"]


def test_service_reports_failure_when_retry_is_also_wrong():
    transport, _ = _fake_ollama([WRONG, WRONG])
    service = ExplanationService(base_url="http://ollama.test", transport=transport)

    result = asyncio.run(service.explain("monthly_breakdown", MONTH_DATA))

    assert result.verification.status == "failed"
    assert result.verification.claims[0].status == "mismatch"


def test_service_retries_when_output_is_not_valid_json():
    def handler(request):
        if request.url.path == "/api/tags":
            return httpx.Response(200, json={})
        handler.count += 1
        text = "not json" if handler.count == 1 else json.dumps(GOOD)
        return httpx.Response(200, json={"response": text})

    handler.count = 0
    service = ExplanationService(base_url="http://ollama.test", transport=httpx.MockTransport(handler))

    result = asyncio.run(service.explain("monthly_breakdown", MONTH_DATA))
    assert result.verification.status == "verified"
    assert result.verification.attempts == 2


def test_schema_caps_claims_so_generation_stays_short():
    from ai_service import MAX_CLAIMS, ModelExplanation, build_prompt

    schema = ModelExplanation.model_json_schema()
    assert schema["properties"]["claims"]["maxItems"] == MAX_CLAIMS
    assert f"at most {MAX_CLAIMS} numbers" in build_prompt("heatmap", {"x": 1})


# --- 2020 / COVID-19 context ----------------------------------------------

HEATMAP_WITH_2020 = {
    "annual_totals": {"2019": 1659702, "2020": 1238083, "2021": 1806865},
    "lowest_year": {"year": 2020, "visitors": 1238083},
}


def test_prompt_explains_2020_as_covid_closure_when_data_covers_it():
    from ai_service import build_prompt

    assert "COVID-19" in build_prompt("heatmap", HEATMAP_WITH_2020)
    assert "COVID-19" in build_prompt("annual_trends", {"biggest_decline_year": 2020})
    assert "COVID-19" not in build_prompt("monthly_breakdown", MONTH_DATA)


def test_covid_name_is_not_flagged_as_an_unchecked_number():
    explanation = ModelExplanation(
        summary="Visits fell in 2020 when COVID-19 closed the park.", claims=[]
    )
    _, unchecked = verify_explanation(explanation, HEATMAP_WITH_2020)
    assert unchecked == []


def test_service_adds_covid_note_when_model_leaves_it_out():
    transport, _ = _fake_ollama([{
        "summary": "2020 was the lowest year with 1,238,083 visitors.",
        "claims": [{"text": "1,238,083 visitors", "value": 1238083, "source_field": "lowest_year.visitors"}],
    }])
    service = ExplanationService(base_url="http://ollama.test", transport=transport)

    result = asyncio.run(service.explain("heatmap", HEATMAP_WITH_2020))

    assert result.explanation.startswith("2020 was the lowest year")
    assert "COVID-19" in result.explanation
    assert result.verification.status == "verified"


def test_service_does_not_repeat_covid_note_the_model_already_gave():
    transport, _ = _fake_ollama([{
        "summary": "2020 dipped because COVID-19 closed the park for two months.",
        "claims": [],
    }])
    service = ExplanationService(base_url="http://ollama.test", transport=transport)

    result = asyncio.run(service.explain("heatmap", HEATMAP_WITH_2020))

    assert result.explanation.count("COVID") == 1
    # It named the cause but not that 2020 is an outlier, so that gets added
    assert result.explanation.endswith("The 2020 drop was an aberration, not part of the long-term trend.")


def test_no_note_added_when_model_already_calls_2020_an_aberration():
    summary = "2020 dipped because COVID-19 closed the park, an aberration in the trend."
    transport, _ = _fake_ollama([{"summary": summary, "claims": []}])
    service = ExplanationService(base_url="http://ollama.test", transport=transport)

    result = asyncio.run(service.explain("heatmap", HEATMAP_WITH_2020))

    assert result.explanation == summary


def test_no_covid_note_when_data_does_not_cover_2020():
    transport, _ = _fake_ollama([GOOD])
    service = ExplanationService(base_url="http://ollama.test", transport=transport)

    result = asyncio.run(service.explain("monthly_breakdown", MONTH_DATA))

    assert "COVID" not in result.explanation


# --- claim text must match the field it cites -----------------------------

def test_claim_whose_sentence_number_differs_from_its_field_is_a_mismatch():
    # The real failure: the sentence states the 10-year average, but the claim
    # cites total_visitors (and copies that field's value), so it used to pass.
    data = {"total_visitors": 46406230, "average_per_year_last_10_years": 1541399}
    explanation = _explanation(
        "The average is 1,541,399 visitors per year.",
        [{"text": "The average number of visitors per year is 1,541,399.",
          "value": 46406230, "source_field": "total_visitors"}],
    )
    claims, _ = verify_explanation(explanation, data)
    assert claims[0].status == "mismatch"


def test_claim_sentence_matching_its_field_is_verified_even_if_rounded():
    data = {"record_year": {"year": 2021, "visitors": 1806865}}
    explanation = _explanation(
        "2021 was the busiest year with 1.8 million visitors.",
        [{"text": "1.8 million visitors in 2021", "value": 1806865, "source_field": "record_year.visitors"}],
    )
    claims, _ = verify_explanation(explanation, data)
    assert claims[0].status == "verified"


def test_retry_prompt_explains_a_sentence_that_cites_the_wrong_field():
    from ai_service import build_retry_prompt

    data = {"total_visitors": 46406230, "average_per_year_last_10_years": 1541399}
    explanation = _explanation("x", [{"text": "The average is 1,541,399.", "value": 46406230, "source_field": "total_visitors"}])
    claims, _ = verify_explanation(explanation, data)
    prompt = build_retry_prompt("ORIGINAL", claims, None)
    assert "total_visitors is 46406230" in prompt
    assert "1,541,399" in prompt


# --- leaked field names ---------------------------------------------------

def test_field_names_are_removed_from_the_summary():
    from ai_service import strip_field_names

    text = ("2021 had 568,782 more visitors than the year before (2020 record_year.visitors_lost). "
            "July was busiest (peak_month_visitors).")
    assert strip_field_names(text) == (
        "2021 had 568,782 more visitors than the year before. July was busiest."
    )
    # Ordinary parentheses stay
    assert strip_field_names("Spring (March to May) is busy.") == "Spring (March to May) is busy."


# --- ranks and small numbers in claims ------------------------------------

FEB = {"month": "February", "year": 2025, "stats": {"visitors": 51541, "percentage": "3.4", "rank": 10, "avgDaily": 1841}}


def test_ordinal_rank_in_a_claim_is_checked():
    # The real February failure: "10th" was ignored, so only "2025" was compared with rank 10
    explanation = _explanation(
        "February was the 10th busiest month.",
        [{"text": "February 2025 ranked as the 10th busiest month.", "value": 10, "source_field": "stats.rank"}],
    )
    claims, unchecked = verify_explanation(explanation, FEB)
    assert claims[0].status == "verified"
    assert unchecked == []


def test_wrong_ordinal_rank_is_still_a_mismatch():
    explanation = _explanation(
        "February was the 3rd busiest month.",
        [{"text": "February 2025 was the 3rd busiest month.", "value": 10, "source_field": "stats.rank"}],
    )
    claims, _ = verify_explanation(explanation, FEB)
    assert claims[0].status == "mismatch"


def test_small_plain_number_in_a_claim_is_checked():
    explanation = _explanation(
        "It ranked 10 of 12.",
        [{"text": "It ranked 10 out of 12 months.", "value": 10, "source_field": "stats.rank"}],
    )
    claims, _ = verify_explanation(explanation, FEB)
    assert claims[0].status == "verified"
