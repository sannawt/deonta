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
  lastAssessment?: {
    created_at: number;
    prompt: string;
    response: ChatResponse;
  };
}

export type ProductWorkflowId = "default" | "lab";

const STORAGE_KEYS: Record<ProductWorkflowId, string> = {
  default: "ct_products_v1",
  lab: "ct_products_v1_lab",
};

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

export function loadProducts(workflow: ProductWorkflowId = "default"): ProductRecord[] {
  const data = safeParse<{ version: number; products: ProductRecord[] }>(
    localStorage.getItem(storageKey(workflow))
  );
  if (!data || data.version !== 1 || !Array.isArray(data.products)) return [];
  return data.products;
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

export function createProduct(spec: ProductSpec): ProductRecord {
  const now = Date.now();
  const label = spec.name?.trim() || "Untitled product";
  return { id: nanoid(), label, created_at: now, updated_at: now, spec };
}

export function upsertProduct(products: ProductRecord[], product: ProductRecord): ProductRecord[] {
  const idx = products.findIndex((p) => p.id === product.id);
  if (idx === -1) return [product, ...products];
  const next = [...products];
  next[idx] = product;
  return next;
}

