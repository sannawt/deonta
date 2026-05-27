import type { DimResult } from "../types/chat";

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function nanoid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function dimBadgeClass(result: DimResult): string {
  switch (result) {
    case "pass":           return "badge-green";
    case "fail":           return "badge-red";
    case "cannot_determine": return "badge-amber";
    case "not_reached":    return "badge-gray";
    case "deferred":       return "badge-blue";
    default:               return "badge-gray";
  }
}

export function dimLabel(result: DimResult): string {
  switch (result) {
    case "pass":             return "PASS";
    case "fail":             return "FAIL";
    case "cannot_determine": return "OPEN";
    case "not_reached":      return "N/A";
    case "deferred":         return "DEFERRED";
    default:                 return (result as string).toUpperCase();
  }
}

export function verdictBadgeClass(verdict: string): string {
  switch (verdict) {
    case "applies":          return "badge-green";
    case "does_not_apply":   return "badge-red";
    case "cannot_determine": return "badge-amber";
    default:                 return "badge-gray";
  }
}

export function verdictLabel(verdict: string): string {
  switch (verdict) {
    case "applies":          return "APPLIES";
    case "does_not_apply":   return "DOES NOT APPLY";
    case "cannot_determine": return "CANNOT DETERMINE";
    default:                 return verdict.toUpperCase();
  }
}

export function sourceTagBadgeClass(tag: string): string {
  switch (tag) {
    case "playbook": return "badge-blue";
    case "question": return "badge-green";
    case "derived":  return "badge-green";
    case "missing":  return "badge-amber";
    default:         return "badge-gray";
  }
}

export function sourceDisplayLabel(tag: string): string {
  if (tag === "playbook") return "From playbook";
  if (tag === "question") return "From question";
  if (tag === "used") return "Used in analysis";
  if (tag === "related") return "Related context";
  if (tag === "background") return "Other match";
  return tag;
}

// ── Display sanitizers ──────────────────────────────────────────────────
// The backend / rule atoms sometimes include internal scenario ids like
// sit_xxx / scenario_xxx. These are useful for engines, but should not show
// up in the UI.

const INTERNAL_ID_RX = /\b(?:sit|scenario)_[A-Za-z0-9_-]+\b/g;
const UUID_RX =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
// Opaque app-generated identifiers often appear as long base36-ish strings.
// Example: processing(52p7xkrlmpno0xvj)
const OPAQUE_ID_RX = /\b[a-z0-9]{12,}\b/gi;
// Engine derived entities: <case_id>_person / <case_id>_datum (not legal identifiers).
const ENGINE_ENTITY_RX = /\b(?:sit_[a-z0-9]+|[a-z0-9]{10,22})_(person|datum)\b/gi;

function _looksLikeOpaqueId(token: string): boolean {
  const t = token.trim();
  if (!t) return false;
  if (UUID_RX.test(t)) return true;
  if (!OPAQUE_ID_RX.test(t)) return false;
  // Heuristic: require at least one digit, and not all digits (to avoid removing years).
  const hasDigit = /\d/.test(t);
  const hasLetter = /[a-z]/i.test(t);
  if (!hasDigit || !hasLetter) return false;
  // Avoid nuking short-ish legal identifiers like "AIAct_A2.1.c"
  if (t.includes("_") || t.includes(".") || t.includes(":")) return false;
  return true;
}

function _stripQuotes(token: string): string {
  const t = token.trim();
  if ((t.startsWith("\"") && t.endsWith("\"")) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).trim();
  }
  return t;
}

function _isEmptyArg(token: string): boolean {
  const t = _stripQuotes(token);
  return t === "" || t === "null" || t === "None";
}

/** Engine placeholder for the organisation under assessment */
export const ENGINE_ACTOR_LABEL = "your organisation";
export const ENGINE_SCENARIO_LABEL = "this assessment scenario";

export function formatEngineTokens(text: string): string {
  return stripInternalIds(
    String(text || "")
      .replace(/\byour_org\b/gi, ENGINE_ACTOR_LABEL)
      .replace(/\bthis assessment scenario\b/gi, ENGINE_SCENARIO_LABEL)
  );
}

export function stripInternalIds(text: string): string {
  const s = String(text || "")
    .replace(/\byour_org\b/gi, ENGINE_ACTOR_LABEL)
    .replace(ENGINE_ENTITY_RX, (_m, kind) =>
      String(kind).toLowerCase() === "person" ? "a data subject" : "a data item"
    )
    .replace(INTERNAL_ID_RX, "")
    .replace(UUID_RX, "")
    // remove empty string literals that often stand in for removed ids
    .replace(/""/g, "")
    .replace(/''/g, "")
    .replace(/\(\s*,/g, "(") // clean "(, x"
    .replace(/,\s*,/g, ", ")
    .replace(/\(\s*\)/g, "()")
    .replace(/\s+/g, " ")
    .replace(/\(\s*,\s*/g, "(")
    .replace(/,\s*\)/g, ")")
    .trim();
  return s;
}

export function formatPredicateCall(predicate: string, args: string[]): string {
  const cleanArgs = (args || [])
    .map((a) => stripInternalIds(a))
    .map((a) => _stripQuotes(a))
    .map((a) => a.trim())
    .filter((a) => a.length > 0)
    .filter((a) => !_isEmptyArg(a))
    .filter((a) => !_looksLikeOpaqueId(a));
  return `${predicate}(${cleanArgs.join(", ")})`;
}

export function formatAtom(atom: string): string {
  // e.g. "personal_data(sit_abc, company_x)" -> "personal_data(company_x)"
  const cleaned = stripInternalIds(atom);
  // If atoms include opaque ids as arguments, drop them.
  // We do a lightweight parse: predicate(args...)
  const m = cleaned.match(/^([A-Za-z_][A-Za-z0-9_]*)\((.*)\)$/);
  if (!m) return cleaned;
  const pred = m[1];
  const inner = m[2].trim();
  if (!inner) return `${pred}()`;
  const parts = inner
    .split(",")
    .map((p) => _stripQuotes(p))
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
    .filter((p) => !_isEmptyArg(p));
  const filtered = parts.filter((p) => !_looksLikeOpaqueId(p));
  return `${pred}(${filtered.join(", ")})`;
}

// Predicate-only display (requested UX): remove "(...)" entirely.
export function predicateOnlyFromCall(predicate: string): string {
  return String(predicate || "").trim();
}

export function predicateOnlyFromAtom(atom: string): string {
  const cleaned = stripInternalIds(atom);
  const m = cleaned.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\(/);
  if (m) return m[1];
  // if it's already just a predicate token
  const t = cleaned.trim();
  const m2 = t.match(/^([A-Za-z_][A-Za-z0-9_]*)$/);
  return m2 ? m2[1] : t;
}
