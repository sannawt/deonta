import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchProvisions } from "../lib/api";
import type { ScopeCitation } from "../types/chat";

const globalCache = new Map<string, ScopeCitation>();

function hasFullText(citation: ScopeCitation | undefined): boolean {
  return Boolean(citation?.text?.trim() || citation?.excerpt?.trim());
}

function mergeCitation(base: ScopeCitation, fetched?: ScopeCitation): ScopeCitation {
  if (!fetched) return base;
  return {
    ...base,
    ...fetched,
    label: fetched.label || base.label,
    provision_long_id: fetched.provision_long_id || base.provision_long_id,
    eurlex_url: fetched.eurlex_url || base.eurlex_url,
    text: fetched.text || base.text,
    excerpt: fetched.excerpt || base.excerpt,
    title: fetched.title || base.title,
    display: fetched.display || base.display,
  };
}

function cacheKey(citation: ScopeCitation): string {
  return citation.provision_long_id || citation.label;
}

export function useProvisionTexts(
  ids: string[],
  seedCitations: ScopeCitation[] = [],
): {
  citations: Map<string, ScopeCitation>;
  loading: boolean;
  error: string | null;
} {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const inflight = useRef<Set<string>>(new Set());

  const normalizedIds = useMemo(
    () => [...new Set(ids.map((id) => id.trim()).filter(Boolean))],
    [ids],
  );

  useEffect(() => {
    for (const citation of seedCitations) {
      const key = cacheKey(citation);
      if (!key) continue;
      globalCache.set(key, mergeCitation(globalCache.get(key) || citation, citation));
    }
  }, [seedCitations]);

  const fetchMissing = useCallback(async (missingIds: string[]) => {
    if (!missingIds.length) return;
    setLoading(true);
    setError(null);
    try {
      const fetched = await fetchProvisions(missingIds);
      for (const citation of fetched) {
        const key = cacheKey(citation);
        if (!key) continue;
        globalCache.set(key, mergeCitation(globalCache.get(key) || citation, citation));
      }
      setTick((n) => n + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load provision text");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const missing = normalizedIds.filter((id) => {
      if (inflight.current.has(id)) return false;
      const seeded = seedCitations.find((c) => cacheKey(c) === id);
      const cached = globalCache.get(id);
      return !hasFullText(seeded) && !hasFullText(cached);
    });

    if (!missing.length) return;

    for (const id of missing) inflight.current.add(id);
    void fetchMissing(missing).finally(() => {
      for (const id of missing) inflight.current.delete(id);
    });
  }, [normalizedIds, seedCitations, fetchMissing]);

  const citations = useMemo(() => {
    void tick;
    const map = new Map<string, ScopeCitation>();
    for (const id of normalizedIds) {
      const seeded = seedCitations.find((c) => cacheKey(c) === id);
      const cached = globalCache.get(id);
      const merged = mergeCitation(seeded || { provision_long_id: id, label: id }, cached);
      map.set(id, merged);
    }
    return map;
  }, [normalizedIds, seedCitations, tick]);

  return { citations, loading, error };
}
