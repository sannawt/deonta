import type { ChatResponse } from "../types/chat";
import { nanoid } from "./utils";

export type ProductId = string;

export interface ProductSpec {
  name: string;
  summary: string;
  markets: string[]; // e.g. ["EU", "EEA", "US"]
  processesPersonalData: "yes" | "no" | "unknown";
  euLink: "yes" | "no" | "unknown";
  aiSystem: "yes" | "no" | "unknown";
}

export interface ProductRecord {
  id: ProductId;
  label: string;
  created_at: number;
  updated_at: number;
  spec: ProductSpec;
  lastAssessment?: {
    created_at: number;
    prompt: string;
    response: ChatResponse;
  };
}

const STORAGE_KEY = "ct_products_v1";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadProducts(): ProductRecord[] {
  const data = safeParse<{ version: number; products: ProductRecord[] }>(
    localStorage.getItem(STORAGE_KEY)
  );
  if (!data || data.version !== 1 || !Array.isArray(data.products)) return [];
  return data.products;
}

export function saveProducts(products: ProductRecord[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, products }));
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

