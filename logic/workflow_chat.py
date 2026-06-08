"""
OpenAI-powered assistant copy for the product workflow chat UI.
"""

from __future__ import annotations

from typing import Any

from logic.openai_client import chat_completion, openai_configured

_SYSTEM = (
    "You are ComplianceTwin's applicability assistant. "
    "Guide product teams through EU regulatory applicability in plain language. "
    "Be concise (2–4 short sentences unless asked for detail). "
    "Do not invent legal conclusions beyond the context provided. "
    "When uncertain, say what additional product facts would help."
)

_FALLBACKS: dict[str, str] = {
    "welcome": (
        "Describe your product or service and I'll scan EU regulations that may apply."
    ),
    "intake_ack": (
        "Thanks — I'm reading your description. "
        "Next I'll scan the legal database for relevant instruments."
    ),
    "law_scan_intro": (
        "Here are the regulations that look relevant. Adjust the selection, "
        "then check applicability."
    ),
    "law_scan_empty": (
        "I could not find regulations above the relevance threshold. "
        "Try a longer description or add more product detail."
    ),
    "scope_start": (
        "Running per-law scope assessment for your selection. "
        "I'll write up the results in plain language — ask follow-up questions when it appears."
    ),
    "follow_up": (
        "I can help clarify the scan or scope. Add more product detail and send "
        "again to refresh the law list, or ask a specific question."
    ),
}


def _law_lines(results: list[dict[str, Any]], *, limit: int = 12) -> str:
    lines: list[str] = []
    for row in results[:limit]:
        label = (
            row.get("ui_label")
            or row.get("short")
            or row.get("label")
            or row.get("code")
            or "Law"
        )
        instrument = row.get("legal_instrument") or row.get("number") or ""
        score = row.get("score")
        suffix = f" ({int(round(float(score) * 100))}%)" if score is not None else ""
        lines.append(f"- {label}{suffix}: {instrument}".strip(": "))
    return "\n".join(lines) if lines else "(no matches)"


def _stage_prompt(stage: str, context: dict[str, Any]) -> str:
    user_message = str(context.get("user_message") or "").strip()
    product_summary = str(context.get("product_summary") or "").strip()
    selected = context.get("selected_laws") or []
    results = context.get("law_scan_results") or []
    count = len(results)

    if stage == "welcome":
        return "Write a one-sentence welcome asking the user to describe their product or service."

    if stage == "intake_ack":
        return (
            f"The user wrote:\n{user_message[:2000]}\n\n"
            f"Product summary so far:\n{product_summary[:1200] or '(building map)'}\n\n"
            "Briefly acknowledge what you understood and say you are scanning relevant EU law."
        )

    if stage == "law_scan_intro":
        if count == 0:
            return (
                f"Product:\n{product_summary[:1200]}\n\n"
                "No regulations met the relevance threshold. Explain gently and suggest "
                "what extra product detail might surface more matches."
            )
        selected_s = ", ".join(str(c) for c in selected[:8]) if selected else "all shown"
        return (
            f"Product:\n{product_summary[:1200]}\n\n"
            f"Law scan found {count} candidate instrument(s):\n{_law_lines(results)}\n\n"
            f"Currently selected for assessment: {selected_s}.\n"
            "Summarize the themes (e.g. data, AI, product safety) in plain language and "
            "tell the user they can adjust checkboxes then click Check applicability."
        )

    if stage == "scope_start":
        n = len(selected) if selected else count
        return (
            f"Starting scope assessment for {n} selected instrument(s). "
            f"Selected codes: {', '.join(str(c) for c in selected[:10]) or 'n/a'}.\n"
            "Write a short message that sets expectations for per-law scope results below."
        )

    if stage == "follow_up":
        return (
            f"Product:\n{product_summary[:1200]}\n\n"
            f"Recent law matches:\n{_law_lines(results)}\n\n"
            f"User question:\n{user_message[:2000]}\n\n"
            "Answer helpfully about applicability scanning or next steps. "
            "Do not claim a final legal verdict unless provided in context."
        )

    return user_message or "Respond helpfully to the user."


def generate_workflow_reply(*, stage: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
    """
    Return { assistant_text, llm_used, fallback }.
    """
    ctx = context or {}
    stage = (stage or "follow_up").strip()
    fallback_key = "law_scan_empty" if stage == "law_scan_intro" and not ctx.get("law_scan_results") else stage
    fallback = _FALLBACKS.get(fallback_key) or _FALLBACKS["follow_up"]

    if not openai_configured():
        return {"assistant_text": fallback, "llm_used": False, "fallback": True}

    text = chat_completion(
        messages=[
            {"role": "system", "content": _SYSTEM},
            {"role": "user", "content": _stage_prompt(stage, ctx)},
        ],
        temperature=0.3,
        timeout=45,
    )
    if not text:
        return {"assistant_text": fallback, "llm_used": False, "fallback": True}

    return {"assistant_text": text, "llm_used": True, "fallback": False}
