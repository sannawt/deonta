import type { Assessment, ChatResponse, Narrative } from "../types/chat";

/** Prefer unified assessment envelope; fall back to legacy fields. */
export function resolveAssessment(data: ChatResponse | null | undefined): Assessment | null {
  if (!data) return null;
  if (data.assessment) return data.assessment;

  if (data.mode !== "applicability" && !data.symbolic?.applicability_results) {
    return null;
  }

  const narrative = data.narrative;
  const factsTable = data.facts_table;

  return {
    conclusion: {
      bottom_line: narrative?.bottom_line,
      verdict_type: narrative?.verdict_type,
      verdict_line: narrative?.verdict_line,
      focused_questions: narrative?.focused_questions,
    },
    facts: {
      from_question:
        factsTable?.rows?.filter((r) => r.source === "question") ||
        factsTable?.from_question ||
        [],
      from_playbook:
        factsTable?.rows?.filter((r) => r.source === "playbook") ||
        factsTable?.from_playbook ||
        [],
      playbook_extended: factsTable?.playbook_extended || [],
      playbook_total_matched: factsTable?.playbook_total_matched,
      playbook_company_id: factsTable?.playbook_company_id,
      playbook_company_label: factsTable?.playbook_company_label,
      summary: factsTable?.summary,
    },
    scope: data.worksheet,
    scope_analysis: data.scope_analysis,
    open_questions: data.clarifying_questions,
    playbook: data.playbook,
    applicability_results: data.symbolic?.applicability_results,
  };
}

export function narrativeFromAssessment(assessment: Assessment): Narrative {
  const c = assessment.conclusion;
  return {
    verdict_type: c.verdict_type || "cannot_determine",
    verdict_line: c.verdict_line || "",
    bottom_line: c.bottom_line,
    focused_questions: c.focused_questions,
  };
}
