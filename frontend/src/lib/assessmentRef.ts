/** Human-readable assessment reference from internal id. */
export function formatAssessmentRef(id: string): string {
  const slug = id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
  return `ASM-${slug || "NEW"}`;
}

export function defaultAssessmentTitle(_id: string): string {
  return "Untitled assessment";
}

export function isDefaultAssessmentTitle(title: string, id: string): boolean {
  const trimmed = title.trim();
  if (!trimmed || trimmed === "Untitled assessment") return true;
  const ref = formatAssessmentRef(id);
  return trimmed === `Assessment ${ref}` || trimmed === ref;
}

const MARKET_LABELS: Record<string, string> = {
  eu: "EU",
  eea: "EEA",
  uk: "UK",
  us: "US",
};

/** Short human title suggested from intake / scenario facts. */
export function suggestAssessmentTitle(args: {
  productName?: string;
  productSummary?: string;
  markets?: string[];
  organisationName?: string;
  scenarioGist?: string;
}): string {
  const gist = args.scenarioGist?.trim();
  if (gist) {
    const sentence = gist.split(/[.!?]/)[0]?.trim();
    if (sentence && sentence.length >= 8) {
      return sentence.length > 56 ? `${sentence.slice(0, 53)}…` : sentence;
    }
  }

  const name = args.productName?.trim();
  if (name) {
    const marketPart = (args.markets ?? [])
      .slice(0, 2)
      .map((m) => MARKET_LABELS[m.toLowerCase()] || m.toUpperCase())
      .join(" · ");
    if (marketPart) return `${name} — ${marketPart}`;
    const org = args.organisationName?.trim();
    if (org) return `${name} (${org})`;
    return name;
  }

  const summary = args.productSummary?.trim();
  if (summary) {
    const lead = summary.split(/[.!?\n]/)[0]?.trim() || summary;
    return lead.length > 56 ? `${lead.slice(0, 53)}…` : lead;
  }

  return "";
}
