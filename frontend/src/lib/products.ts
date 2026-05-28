export type ProductSource = "session" | "playbook";

export interface ProductListRow {
  product_id: string;
  label: string;
  source: ProductSource;
  playbook_company_id?: string | null;
  updated_at?: string | null;
}

export interface ProductDetail {
  product_id: string;
  label: string;
  source: ProductSource;
  playbook_company_id?: string | null;
  updated_at?: string | null;
  assessment?: unknown | null;
}

export async function fetchProducts(playbookCompanyId?: string): Promise<ProductListRow[]> {
  const qs = playbookCompanyId ? `?playbook_company_id=${encodeURIComponent(playbookCompanyId)}` : "";
  const res = await fetch(`/api/products${qs}`);
  if (!res.ok) throw new Error(`Failed to load products (${res.status})`);
  const data = (await res.json()) as { version?: number; products?: ProductListRow[] };
  return data.products ?? [];
}

export async function fetchProduct(productId: string): Promise<ProductDetail> {
  const res = await fetch(`/api/products/${encodeURIComponent(productId)}`);
  if (!res.ok) throw new Error(`Failed to load product (${res.status})`);
  const data = (await res.json()) as { version?: number } & ProductDetail;
  return data;
}

