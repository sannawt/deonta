// Types matching the /api/chat response envelope
// and local session state.

export type DimResult = "pass" | "fail" | "not_reached" | "cannot_determine" | "deferred";

export interface TraceEntry {
  dimension: string;
  predicate?: string;
  result: DimResult;
  evidence?: string;
  citations?: string[];
  note?: string;
}

export interface ApplicabilityResult {
  verdict: "applies" | "does_not_apply" | "cannot_determine";
  scope: Record<string, DimResult>;
  trace: TraceEntry[];
  risk_category?: string | null;
  headline?: string;
  missing_atoms?: string[];
  actors?: string[];
  playbook_error?: string | null;
}

export type NarrativeVerdictType = "applies" | "does_not_apply" | "cannot_determine" | "gathering";

export interface Narrative {
  verdict_type: NarrativeVerdictType;
  verdict_line: string;
  session_title?: string;
  full_analysis?: string;
  indicative_bullets?: Array<{ instrument_id: string; signal: string; reason: string }>;
  focused_questions?: string[];
  bottom_line?: {
    title: string;
    rows: Array<{
      instrument: string;
      result: string;
      conclusion_text: string;
    }>;
  };
}

export interface ConsolidatedFact {
  predicate: string;
  args: string[];
  status?: string;
  source_tag?: string;
  playbook_label?: string;
  playbook_node_id?: string;
}

export interface ClarifyingQuestion {
  text?: string;
  predicate?: string;
  missing_atom?: string;
  regulation?: string;
  dimension?: string;
}

export interface PlaybookInfo {
  matches: Array<{ id: string; properties?: Record<string, string> }>;
  error?: string | null;
  match_count?: number;
  company_id?: string;
  company_label?: string;
}

export interface FactRow {
  field: string;
  value: string;
  source?: string;
  relevance?: "used" | "related" | "background";
  predicate?: string;
}

export interface FactSummaryBullet {
  label: string;
  detail: string;
  relevance?: "used" | "related" | "background";
}

export interface FactsSummary {
  scenario_gist?: string;
  from_question?: FactSummaryBullet[];
  from_playbook?: FactSummaryBullet[];
  note?: string;
  source?: string;
}

export interface ScopeCitation {
  provision_long_id: string;
  label: string;
  display?: string;
  title?: string | null;
  text?: string | null;
  excerpt?: string | null;
  eurlex_url?: string | null;
  regulation?: string;
}

export interface ScopeDecisiveFact {
  atom: string;
  kind: string;
  label: string;
  note?: string | null;
}

export interface ScopeRuleInvoked {
  provision_long_id: string;
  citation?: ScopeCitation;
  rule_text?: string;
  head_atom?: string;
  kind?: string;
  proof_steps?: number;
}

export interface ScopeDimensionLlm {
  interpretation?: string;
  why_result?: string;
  key_facts?: string[];
}

export interface ScopeDimension {
  id: string;
  label: string;
  result: string;
  evidence: string;
  predicate?: string;
  citations: ScopeCitation[];
  decisive_facts: ScopeDecisiveFact[];
  rules_invoked: ScopeRuleInvoked[];
  proof_lines?: Array<{
    kind?: string;
    atom?: string;
    note?: string;
    provision_long_id?: string | null;
  }>;
  llm?: ScopeDimensionLlm;
}

export interface ScopeLegalTest {
  label: string;
  answer: string;
}

export interface ScopeInstrument {
  id: string;
  label: string;
  full_name: string;
  reg_key?: string;
  verdict?: string;
  verdict_display?: string;
  headline?: string;
  risk_category?: string | null;
  missing_atoms?: string[];
  dimensions: ScopeDimension[];
  llm_summary?: string;
  assessment_source?: "symbolic" | "llm_assisted" | "heuristic" | "pending";
  confidence?: "high" | "medium" | "low";
  legal_tests?: ScopeLegalTest[];
  facts_used?: string[];
  missing_facts?: string[];
}

export interface ScopeAnalysis {
  instruments: ScopeInstrument[];
  llm_enriched?: boolean;
}

export interface Assessment {
  conclusion: {
    bottom_line?: Narrative["bottom_line"];
    verdict_type?: NarrativeVerdictType;
    verdict_line?: string;
    focused_questions?: string[];
  };
  facts: {
    from_question: FactRow[];
    from_playbook: FactRow[];
    playbook_extended?: FactRow[];
    playbook_total_matched?: number;
    playbook_company_id?: string;
    playbook_company_label?: string;
    summary?: FactsSummary;
  };
  scope?: ChatResponse["worksheet"];
  scope_analysis?: ScopeAnalysis;
  open_questions?: ClarifyingQuestion[];
  playbook?: PlaybookInfo;
  applicability_results?: Record<string, ApplicabilityResult>;
}

export interface ChatResponse {
  mode?: "applicability" | "general";
  assessment?: Assessment;
  assistant_text?: string;
  general?: {
    assistant_text?: string;
    related_provisions?: Array<{
      provision_long_id?: string;
      regulation?: string;
      title?: string | null;
    }>;
  };
  narrative: Narrative;
  symbolic: {
    applicability_results: Record<string, ApplicabilityResult>;
    context?: { product_name?: string | null; session_id?: string | null };
  };
  fact_payload?: Record<string, unknown>;
  consolidated_facts?: ConsolidatedFact[];
  facts_table?: {
    title?: string;
    rows: Array<FactRow>;
    from_question?: FactRow[];
    from_playbook?: FactRow[];
    playbook_extended?: FactRow[];
    summary?: FactsSummary;
    question_count?: number;
    playbook_count?: number;
    playbook_total_matched?: number;
    playbook_company_id?: string;
    playbook_company_label?: string;
  };
  clarifying_questions?: ClarifyingQuestion[];
  clarification_required?: boolean;
  graph_citations?: Record<string, unknown>;
  playbook?: PlaybookInfo;
  extractor_notes?: string[];
  worksheet?: {
    rows: Array<{
      legal_test_name: string;
      gdpr_result: string;
      ai_act_result: string;
      reasoning: string;
      legal_basis: string;
    }>;
  };
  scope_analysis?: ScopeAnalysis;
}

// ── Session state ──────────────────────────────────────────────────────

export type MessageRole = "user" | "assistant" | "loading";

export interface Message {
  id: string;
  role: MessageRole;
  text?: string;
  data?: ChatResponse;
  error?: string;
}

export interface Session {
  id: string;
  title: string;
  company_name?: string;
  playbook_company_id?: string;
  messages: Message[];
  created_at: number;
}
