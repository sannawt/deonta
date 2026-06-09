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
  affected_person_in_union:
    "Whether people affected by the AI system are located in the Union (Art. 2 territorial link).",
  annex_iii_high_risk:
    "Whether the AI system falls under an Annex III high-risk use-case category (e.g. employment, credit, biometrics).",
  annex_i_harmonisation:
    "Whether the product is covered by listed Union harmonisation legislation (Annex I, Sections A & B).",
  biometric_ancillary:
    "Whether biometric categorisation is ancillary to lawfully acquired datasets and does not infer protected categories.",
  provider_mandate_eu:
    "Whether an EU-established actor is mandated to act on behalf of a non-EU provider.",
  ai_system_art3:
    "Whether the product meets the Art. 3(1) definition of an AI system.",
};

export function dimensionResultPlain(result: string): string {
  switch (result) {
    case "PASS":
      return "In scope";
    case "FAIL":
      return "Out of scope";
    case "UNKNOWN":
      return "Needs review";
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
  if (/^predicate used by improved recital/i.test(t)) return true;
  if (/^required for this scope gate/i.test(t)) return true;
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

  if (/affected person located in the union for ai act territorial link/i.test(cleaned)) {
    return "Whether people affected by the system are located in the Union (Art. 2 territorial link)";
  }
  if (/annex iii high-risk use-case category/i.test(cleaned)) {
    return "Whether the system falls under an Annex III high-risk category (e.g. employment, credit, biometrics)";
  }
  if (/listed union harmonisation legislation/i.test(cleaned)) {
    return "Whether the product is covered by listed Union harmonisation legislation (Annex I)";
  }
  if (/biometric categorisation is ancillary/i.test(cleaned)) {
    return "Whether biometric categorisation is ancillary and does not infer protected categories";
  }
  if (/actor established in the union mandated to act on behalf/i.test(cleaned)) {
    return "Whether an EU-established actor is mandated to act for a non-EU provider";
  }

  if (/^predicate used by improved recital-derived rules for (AIAct|GDPR)_R(\d+)/i.test(cleaned)) {
    const m = cleaned.match(/(AIAct|GDPR)_R(\d+)/i);
    if (m) {
      const recital = m[2];
      const reg = m[1].toLowerCase().includes("ai") ? "AI Act" : "GDPR";
      return `Whether Recital ${recital} of the ${reg} supports scope on your facts.`;
    }
  }

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
  if (/^whether recital \d+ of the (ai act|gdpr) supports scope/i.test(text)) return "";
  const question = text.endsWith("?") ? text : `${text}?`;
  return question.charAt(0).toUpperCase() + question.slice(1);
}
