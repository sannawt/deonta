// Client-side rule catalog cache.
// Loaded once at app start from GET /api/rule-catalog.

export interface CatalogProvision {
  provision_long_id: string;
  provision_id?: string | null;
  regulation: string;
  type?: string | null;
  scope_tags: string[];
  title?: string | null;
  text?: string | null;
  datalog_rule?: string | null;
  rules: Array<{
    rule_text: string;
    head_atom: string;
    head_predicate: string;
    scope_tag: string;
    body_atoms: string[];
    source_type: string;
  }>;
}

let _catalog: CatalogProvision[] | null = null;
const _byId: Map<string, CatalogProvision> = new Map();

export async function ensureCatalogLoaded(): Promise<CatalogProvision[]> {
  if (_catalog) return _catalog;
  try {
    const res = await fetch("/api/rule-catalog");
    if (!res.ok) return [];
    const data = await res.json();
    const provisions: CatalogProvision[] = data.provisions || [];
    _catalog = provisions;
    for (const p of provisions) {
      _byId.set(p.provision_long_id, p);
      if (p.provision_id) _byId.set(p.provision_id, p);
    }
    return provisions;
  } catch {
    return [];
  }
}

export function lookupProvision(id: string): CatalogProvision | undefined {
  return _byId.get(id);
}
