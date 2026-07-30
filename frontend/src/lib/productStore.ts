import type { ChatResponse } from "../types/chat";
import { nanoid } from "./utils";

export type ProductId = string;

export interface KgFact {
  id: string;
  label: string;
  value: string;
  source?: string;
  predicate?: string;
  args?: string[];
}

export interface ProductSpec {
  name: string;
  summary: string;
  markets: string[]; // e.g. ["EU", "EEA", "US"]
  processesPersonalData: "yes" | "no" | "unknown";
  euLink: "yes" | "no" | "unknown";
  aiSystem: "yes" | "no" | "unknown";
  selectedLaws?: string[];
}

export interface ProductDocument {
  id: string;
  name: string;
  status: "ready" | "pending";
}

export interface ProductRecord {
  id: ProductId;
  label: string;
  created_at: number;
  updated_at: number;
  spec: ProductSpec;
  kgFacts?: KgFact[];
  documents?: ProductDocument[];
  playbook_id?: string;
  lastAssessment?: {
    created_at: number;
    prompt: string;
    response: ChatResponse;
  };
  /** @deprecated Use lastWorksheet */
  lastObligations?: {
    created_at: number;
    law_codes: string[];
    selected_obligation_ids: string[];
  };
  lastWorksheet?: {
    created_at: number;
    law_codes: string[];
    open_question_count: number;
  };
}

export type ProductWorkflowId = "default" | "lab";

const STORAGE_KEYS: Record<ProductWorkflowId, string> = {
  default: "ct_products_v1",
  lab: "ct_products_v1_lab",
};

const API_CREDENTIALS: RequestCredentials = "include";

function storageKey(workflow: ProductWorkflowId = "default"): string {
  return STORAGE_KEYS[workflow];
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadProductsFromLocal(workflow: ProductWorkflowId = "default"): ProductRecord[] {
  const data = safeParse<{ version: number; products: ProductRecord[] }>(
    localStorage.getItem(storageKey(workflow)),
  );
  if (!data || data.version !== 1 || !Array.isArray(data.products)) return [];
  return data.products;
}

/** @deprecated Use loadProductsFromLocal or fetchAccountProducts */
export function loadProducts(workflow: ProductWorkflowId = "default"): ProductRecord[] {
  return loadProductsFromLocal(workflow);
}

function clearLocalProducts(workflow: ProductWorkflowId = "default") {
  localStorage.removeItem(storageKey(workflow));
}

export async function fetchAccountProducts(): Promise<ProductRecord[]> {
  const res = await fetch("/api/account/products", { credentials: API_CREDENTIALS });
  if (res.status === 401) return [];
  if (!res.ok) throw new Error(`Failed to load assessments (${res.status})`);
  const data = await res.json();
  return Array.isArray(data.products) ? data.products : [];
}

export async function saveAccountProducts(products: ProductRecord[]): Promise<void> {
  const res = await fetch("/api/account/products", {
    method: "PUT",
    credentials: API_CREDENTIALS,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ products }),
  });
  if (!res.ok) throw new Error(`Failed to save assessments (${res.status})`);
}

export async function patchAccountProduct(product: ProductRecord): Promise<ProductRecord> {
  const res = await fetch(`/api/account/products/${encodeURIComponent(product.id)}`, {
    method: "PATCH",
    credentials: API_CREDENTIALS,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(product),
  });
  if (!res.ok) throw new Error(`Failed to save assessment (${res.status})`);
  const data = await res.json();
  return data.product as ProductRecord;
}

/** One-time migration: upload local assessments when server list is empty. */
export async function migrateLocalProductsIfNeeded(
  workflow: ProductWorkflowId = "default",
): Promise<ProductRecord[]> {
  const server = await fetchAccountProducts();
  if (server.length > 0) return server;
  const local = loadProductsFromLocal(workflow);
  if (local.length > 0) {
    await saveAccountProducts(local);
    clearLocalProducts(workflow);
    return local;
  }
  return [];
}

export function saveProducts(products: ProductRecord[], workflow: ProductWorkflowId = "default") {
  localStorage.setItem(storageKey(workflow), JSON.stringify({ version: 1, products }));
}

export function specToKgFacts(spec: ProductSpec): KgFact[] {
  const id = () => nanoid();
  return [
    { id: id(), label: "Product name", value: spec.name || "—", source: "spec" },
    { id: id(), label: "Summary", value: spec.summary || "—", source: "spec" },
    { id: id(), label: "Markets", value: (spec.markets || []).join(", ") || "—", source: "spec" },
    {
      id: id(),
      label: "Processes personal data",
      value: spec.processesPersonalData,
      source: "spec",
    },
    { id: id(), label: "EU territorial link", value: spec.euLink, source: "spec" },
    { id: id(), label: "AI system", value: spec.aiSystem, source: "spec" },
  ];
}

export function createProduct(
  spec: ProductSpec,
  opts?: { id?: string; label?: string; created_at?: number },
): ProductRecord {
  const now = Date.now();
  const label = opts?.label?.trim() || spec.name?.trim() || "Untitled assessment";
  return {
    id: opts?.id ?? nanoid(),
    label,
    created_at: opts?.created_at ?? now,
    updated_at: now,
    spec,
  };
}

export function upsertProduct(products: ProductRecord[], product: ProductRecord): ProductRecord[] {
  const idx = products.findIndex((p) => p.id === product.id);
  if (idx === -1) return [product, ...products];
  const next = [...products];
  next[idx] = product;
  return next;
}
