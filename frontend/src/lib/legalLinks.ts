const REG_ELI: Record<string, string> = {
  GDPR: "2016/679",
  AIAct: "2024/1689",
  NIS2: "2022/2555",
  DSA: "2022/2065",
  DMA: "2022/1925",
  CRA: "2024/2847",
};

const REG_CELEX: Record<string, string> = {
  GDPR: "32016R0679",
  AIAct: "32024R1689",
  NIS2: "32022L2555",
  DSA: "32022R2065",
  DMA: "32022R1925",
  CRA: "32024R2847",
};

type RegPrefix = keyof typeof REG_ELI;

export function regKeyToPrefix(regKey?: string): RegPrefix | null {
  const key = (regKey || "").toLowerCase().replace(/-/g, "_").replace(/\s+/g, "_");
  if (key === "gdpr") return "GDPR";
  if (key === "ai_act" || key === "eu_ai_act" || key === "aiact") return "AIAct";
  if (key === "nis2" || key === "nis_2") return "NIS2";
  if (key === "dsa" || key === "digital_services_act") return "DSA";
  if (key === "dma" || key === "digital_markets_act") return "DMA";
  if (key === "cra" || key === "cyber_resilience_act") return "CRA";
  return null;
}

export function eurlexUrlForProvision(plid: string): string | null {
  const id = (plid || "").trim();

  let prefix: RegPrefix | null = null;
  for (const p of Object.keys(REG_ELI) as RegPrefix[]) {
    if (id.startsWith(`${p}_`)) {
      prefix = p;
      break;
    }
  }
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

  const recital = trimmed.match(/Recitals?\s+(\d+)/i);
  if (recital) {
    return `https://eur-lex.europa.eu/eli/reg/${REG_ELI[prefix]}/oj/rec_${recital[1]}`;
  }

  const article = trimmed.match(/Articles?\s*(\d+)|Arts?\.?\s*(\d+)/i);
  if (article) {
    const num = article[1] || article[2];
    return `https://eur-lex.europa.eu/eli/reg/${REG_ELI[prefix]}/oj/art_${num}`;
  }

  const annex = trimmed.match(/Annex\s+([IVX]+)/i);
  if (annex) {
    return `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${REG_CELEX[prefix]}`;
  }

  const para = trimmed.match(/para(?:graph|\.)\s*(\d+)/i);
  if (para) {
    return `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${REG_CELEX[prefix]}`;
  }

  return `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${REG_CELEX[prefix]}`;
}
