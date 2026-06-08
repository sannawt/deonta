import {
  ENGINE_ACTOR_LABEL,
  ENGINE_SCENARIO_LABEL,
  formatEngineTokens,
  predicateOnlyFromAtom,
  stripInternalIds,
} from "./utils";

const PREDICATE_PHRASES: Record<string, string> = {
  data_subjects_in_eu_targeted:
    "People in the EU are in scope for your organisation in this assessment.",
  processing_in_context_of_establishment:
    "Processing appears linked to an EU establishment of your organisation.",
  places_on_eu_market: "Your organisation appears to place the product on the EU market.",
  provider: "Your organisation appears to act as the provider for this product.",
  output_used_in_eu: "Output of the system appears to be used in the EU.",
  established_in: "Your organisation appears established in the EU.",
  processing: "A processing activity is described in this assessment.",
  personal_data: "Personal data is involved on the facts provided.",
  automated_means: "Processing uses automated means.",
  natural_person: "The processing concerns a natural person (data subject).",
  concerns: "The activity concerns identifiable information.",
  identifies: "The activity can identify people.",
  has_feature: "The product has a relevant technical feature for this regulation.",
  has_capability: "The product has a relevant capability for this regulation.",
  territorial_link_eu: "An EU territorial link is present on these facts.",
  eu_targeted: "The offering appears targeted at the EU.",
  regulation_territorial_link: "An EU territorial link is asserted for this assessment.",
  regulation_material: "The activity falls within the regulation's material scope.",
  regulation_excluded: "Whether an exclusion or carve-out applies.",
  in_force: "The regulation is in force for the assessment period.",
};

export function dimensionResultPlain(result: string): string {
  switch (result) {
    case "PASS":
      return "Met";
    case "FAIL":
      return "Not met";
    case "UNKNOWN":
      return "Unclear";
    case "NOT_REACHED":
      return "Not reached";
    case "DEFERRED":
      return "Deferred";
    default:
      return result.replace(/_/g, " ").toLowerCase();
  }
}

export function dimensionResultSentence(
  label: string,
  result: string,
): string {
  const plain = dimensionResultPlain(result);
  const name = label.toLowerCase();
  switch (result) {
    case "PASS":
      return `On these facts, ${name} appears satisfied.`;
    case "FAIL":
      return `On these facts, ${name} does not appear satisfied.`;
    case "UNKNOWN":
      return `${label} cannot be confirmed yet on the facts provided.`;
    case "NOT_REACHED":
      return `${label} was not evaluated because earlier gates were not reached.`;
    default:
      return `${label}: ${plain}.`;
  }
}

function normalizePredicateKey(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

export function isTechnicalAtom(text: string): boolean {
  const t = (text || "").trim();
  if (!t) return true;
  if (/^[a-z][a-z0-9_]*\s*\(/i.test(t)) return true;
  if (/['"]/.test(t) && /[(),]/.test(t)) return true;
  if (/\b(alice|church|safe.?harbour|dir\s*\d|decision\s+\d)/i.test(t)) return true;
  if (/·/.test(t) && t.length < 80) return true;
  if (/^decision\b/i.test(t) || /^consent\b/i.test(t)) return true;
  if (t.split(" ").length <= 3 && /^[a-z0-9_.'\s·-]+$/i.test(t) && t.includes("'"))
    return true;
  return false;
}

export function humanizeFactText(raw: string): string {
  const cleaned = formatEngineTokens(stripInternalIds(raw));
  if (!cleaned || cleaned === "—") return "";

  const predKey = normalizePredicateKey(predicateOnlyFromAtom(cleaned));
  if (PREDICATE_PHRASES[predKey]) return PREDICATE_PHRASES[predKey];

  const spaced = normalizePredicateKey(cleaned.replace(/([a-z])([A-Z])/g, "$1 $2"));
  if (PREDICATE_PHRASES[spaced]) return PREDICATE_PHRASES[spaced];

  if (/^[A-Z][a-z]+(\s[A-Z][a-z]+)+$/.test(cleaned)) {
    const key = normalizePredicateKey(cleaned);
    if (PREDICATE_PHRASES[key]) return PREDICATE_PHRASES[key];
    return cleaned
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/^./, (c) => c.toUpperCase());
  }

  if (cleaned === ENGINE_ACTOR_LABEL || cleaned === ENGINE_SCENARIO_LABEL) {
    return cleaned;
  }

  return cleaned;
}

export function humanizeRuleExplanation(
  ruleText?: string,
  headAtom?: string,
): string {
  const text = (ruleText || "").trim();
  if (text && text.length > 24 && !/^[a-z_]+\(/i.test(text)) {
    return formatEngineTokens(text);
  }
  const atom = (headAtom || "").trim();
  if (atom && !isTechnicalAtom(atom)) {
    return `The assessment applied a scope rule: ${humanizeFactText(atom)}`;
  }
  return "A legal provision from the rule catalogue was applied to test this scope dimension.";
}

export function humanizeMissingQuestion(raw: string): string {
  const text = humanizeFactText(raw);
  if (!text || isTechnicalAtom(text)) return "";
  const question = text.endsWith("?") ? text : `${text}?`;
  return question.charAt(0).toUpperCase() + question.slice(1);
}
