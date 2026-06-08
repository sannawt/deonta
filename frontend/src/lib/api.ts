import type { ChatResponse } from "../types/chat";
import { accountHeaders, accountHeadersMultipart, ensureAccountId } from "./account";
import type { ProductSpec } from "./productStore";

export interface KgNode {
  id: string;
  type: string;
  label: string;
  properties?: Record<string, unknown>;
  source?: string;
  playbook_node_id?: string;
}

export interface KgEdge {
  id: string;
  from: string;
  to: string;
  type: string;
  label?: string;
}

export interface PlaybookSummary {
  playbook_id: string;
  name: string;
  updated_at?: number;
  node_count?: number;
}

export interface ProductKgResponse {
  version: number;
  nodes: KgNode[];
  edges: KgEdge[];
  facts: KgFact[];
  spec: {
    name: string;
    summary: string;
    markets: string[];
    processesPersonalData: string;
    euLink: string;
    aiSystem: string;
  };
  playbook_id?: string;
  playbook_linked?: boolean;
}

export interface LawCatalogItem {
  code: string;
  label: string;
  short: string;
  engine_mode: "symbolic" | "retrieval_only" | "planned";
  us_module?: boolean;
}

export interface KgFact {
  id: string;
  label: string;
  value: string;
  source?: string;
  provenance?: string;
  predicate?: string;
  args?: string[];
}

async function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error(
      "Cannot reach the API. Start the backend with: make run — then open http://127.0.0.1:8000/ (not Vite alone)."
    );
  }
}

export async function fetchLaws(): Promise<LawCatalogItem[]> {
  const res = await apiFetch("/api/laws");
  if (!res.ok) throw new Error(`Failed to load laws (${res.status})`);
  const data = await res.json();
  return data.laws ?? [];
}

export interface LawScanResult {
  code: string;
  short: string;
  number: string;
  description: string;
  summary?: string;
  keywords?: string[];
  score: number;
  engine_mode: "symbolic" | "retrieval_only" | "planned";
  label?: string;
  ui_label?: string;
  legal_instrument?: string;
  reg_id?: string;
  catalog_code?: string | null;
  document_tier?: string;
  match_rationale?: string;
  hit_count?: number;
  rank_method?: string;
}

export interface LawScanEmbeddingMeta {
  has_neo4j_embeddings?: boolean;
  vector_search_used?: boolean;
  dimensions?: number;
  vector_property?: string;
  vector_index?: string;
  query_provider?: string;
  query_model?: string;
}

export interface LawScanResponse {
  version: number;
  scan_query: string;
  backend: string;
  regulation_count?: number;
  corpus_chars?: number;
  total_ranked?: number;
  match_count?: number;
  total_match_count?: number;
  min_score?: number;
  include_secondary?: boolean;
  full_scan?: boolean;
  display_limit?: number;
  total_hits?: number;
  total_vector_hits?: number;
  results: LawScanResult[];
  rank_method?: string;
  embedding_search?: LawScanEmbeddingMeta;
}

export async function scanRelevantLaws(body: {
  description: string;
  kg_facts: KgFact[];
  limit?: number;
  min_score?: number;
  include_secondary?: boolean;
  full_scan?: boolean;
}): Promise<LawScanResponse> {
  const res = await apiFetch("/api/products/law-scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      description: body.description,
      kg_facts: body.kg_facts,
      limit: body.limit ?? 15,
      min_score: body.min_score ?? 0.75,
      include_secondary: body.include_secondary ?? true,
      full_scan: body.full_scan ?? false,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let detail = text.slice(0, 300);
    try {
      const j = JSON.parse(text) as { detail?: string };
      if (j.detail) detail = j.detail;
    } catch {
      /* use raw */
    }
    throw new Error(detail || `Law scan failed (${res.status})`);
  }
  return res.json();
}

export async function assessProduct(body: {
  spec: ProductSpec & { regulations?: string[] };
  kg_facts: KgFact[];
  selected_laws?: LawScanResult[];
  playbook_company_id?: string;
  playbook_id?: string;
  account_id?: string;
  case_id?: string;
}): Promise<ChatResponse> {
  const headers = await accountHeaders();
  const res = await apiFetch("/api/products/assess", {
    method: "POST",
    headers,
    body: JSON.stringify({
      spec: {
        name: body.spec.name,
        summary: body.spec.summary,
        markets: body.spec.markets,
        processesPersonalData: body.spec.processesPersonalData,
        euLink: body.spec.euLink,
        aiSystem: body.spec.aiSystem,
        regulations: body.spec.regulations ?? [],
      },
      kg_facts: body.kg_facts,
      selected_laws: (body.selected_laws ?? []).map((row) => ({
        code: row.catalog_code || row.code,
        label: row.label || "",
        short: row.short || "",
        ui_label: row.ui_label || "",
        legal_instrument: row.legal_instrument || "",
        number: row.number || "",
        engine_mode: row.engine_mode || "retrieval_only",
        score: row.score ?? null,
      })),
      playbook_company_id: body.playbook_company_id,
      playbook_id: body.playbook_id,
      account_id: body.account_id,
      case_id: body.case_id,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Assessment failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function sendChat(body: {
  question: string;
  session_id?: string;
  playbook_company_id?: string;
  company_name?: string;
}): Promise<ChatResponse> {
  const res = await apiFetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: body.question,
      session_id: body.session_id,
      playbook_company_id: body.playbook_company_id,
      company_name: body.company_name,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Chat failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function fetchLawSummary(code: string) {
  const res = await apiFetch(`/api/laws/${encodeURIComponent(code)}/summary`);
  if (!res.ok) throw new Error(`Law not found (${res.status})`);
  return res.json();
}

export async function fetchEvidencePack(obligationIds: string[], lawCodes: string[]) {
  const res = await apiFetch("/api/laws/evidence-pack", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ obligation_ids: obligationIds, law_codes: lawCodes }),
  });
  if (!res.ok) throw new Error(`Evidence pack failed (${res.status})`);
  return res.json();
}

export async function fetchCorpusStatus() {
  const res = await apiFetch("/api/corpus-status");
  if (!res.ok) throw new Error(`Corpus status failed (${res.status})`);
  return res.json();
}

export async function fetchPlaybookCompanies() {
  const res = await apiFetch("/api/playbook-companies");
  if (!res.ok) return { companies: [] };
  return res.json();
}

export async function fetchAccountPlaybooks(): Promise<PlaybookSummary[]> {
  const headers = await accountHeaders();
  const res = await apiFetch("/api/playbooks", { headers });
  if (!res.ok) throw new Error(`Failed to load playbooks (${res.status})`);
  const data = await res.json();
  return data.playbooks ?? [];
}

export async function createAccountPlaybook(name: string) {
  const headers = await accountHeaders();
  const res = await apiFetch("/api/playbooks", {
    method: "POST",
    headers,
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error(`Failed to create playbook (${res.status})`);
  return res.json();
}

export async function parseProduct(input: {
  description?: string;
  playbook_id?: string;
  files?: File[];
}): Promise<ProductKgResponse> {
  await ensureAccountId();

  if (!input.files?.length) {
    const headers = await accountHeaders();
    const res = await apiFetch("/api/products/parse/json", {
      method: "POST",
      headers,
      body: JSON.stringify({
        description: input.description ?? "",
        playbook_id: input.playbook_id ?? null,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Parse failed (${res.status}): ${text.slice(0, 200)}`);
    }
    return res.json();
  }

  const h = await accountHeadersMultipart();
  const form = new FormData();
  if (input.description) form.append("description", input.description);
  if (input.playbook_id) form.append("playbook_id", input.playbook_id);
  for (const f of input.files) {
    form.append("files", f);
  }
  const res = await apiFetch("/api/products/parse", {
    method: "POST",
    headers: h,
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Parse failed (${res.status}): ${text.slice(0, 200)}`);
  }
  return res.json();
}

export async function uploadPlaybookDocuments(playbookId: string, files: File[]) {
  const h = await accountHeadersMultipart();
  const form = new FormData();
  for (const f of files) form.append("files", f);
  const res = await apiFetch(`/api/playbooks/${encodeURIComponent(playbookId)}/documents`, {
    method: "POST",
    headers: h,
    body: form,
  });
  if (!res.ok) throw new Error(`Playbook upload failed (${res.status})`);
  return res.json();
}
