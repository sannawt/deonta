const REG_ELI: Record<string, string> = {
  GDPR: "2016/679",
  AIAct: "2024/1689",
};

const REG_CELEX: Record<string, string> = {
  GDPR: "32016R0679",
  AIAct: "32024R1689",
};

export function regKeyToPrefix(regKey?: string): "GDPR" | "AIAct" | null {
  const key = (regKey || "").toLowerCase().replace(/-/g, "_");
  if (key === "gdpr") return "GDPR";
  if (key === "ai_act" || key === "eu_ai_act") return "AIAct";
  return null;
}

export function eurlexUrlForProvision(plid: string): string | null {
  const id = (plid || "").trim();
  let prefix: "GDPR" | "AIAct" | null = null;
  if (id.startsWith("GDPR_")) prefix = "GDPR";
  if (id.startsWith("AIAct_")) prefix = "AIAct";
  if (!prefix) return null;

  const body = id.slice(prefix.length + 1);
  const eli = REG_ELI[prefix];

  if (body.startsWith("R")) {
    const num = body.match(/^R(\d+)/);
    if (num) {
      return `https://eur-lex.europa.eu/eli/reg/${eli}/oj/rec_${num[1]}`;
    }
  }

  if (body.startsWith("A")) {
    const art = body.slice(1).split(".")[0];
    if (/^\d+$/.test(art)) {
      return `https://eur-lex.europa.eu/eli/reg/${eli}/oj/art_${art}`;
    }
  }

  return `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${REG_CELEX[prefix]}`;
}

export function eurlexUrlFromRefText(text: string, regKey?: string): string | null {
  const prefix = regKeyToPrefix(regKey);
  if (!prefix) return null;

  const trimmed = (text || "").trim();
  if (!trimmed) return null;

  const recital = trimmed.match(/Recital\s+(\d+)/i);
  if (recital) {
    return `https://eur-lex.europa.eu/eli/reg/${REG_ELI[prefix]}/oj/rec_${recital[1]}`;
  }

  const article = trimmed.match(/Arts?\.?\s*(\d+)/i);
  if (article) {
    return `https://eur-lex.europa.eu/eli/reg/${REG_ELI[prefix]}/oj/art_${article[1]}`;
  }

  return `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${REG_CELEX[prefix]}`;
}
