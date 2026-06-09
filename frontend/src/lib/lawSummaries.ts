/** Rich plain-language summaries for law scan and scope views. */

export interface LawSummaryContent {
  code: string;
  title: string;
  number: string;
  overview: string;
  appliesWhen: string;
  keyProvisions: string[];
}

const SUMMARIES: Record<string, LawSummaryContent> = {
  gdpr: {
    code: "gdpr",
    title: "General Data Protection Regulation (GDPR)",
    number: "2016/679",
    overview:
      "The GDPR is the EU framework for protecting natural persons when their personal data is processed. " +
      "It sets rules on lawful bases (Art. 6), transparency, data subject rights (Arts. 12–23), " +
      "security and accountability (Art. 32), international transfers (Chapter V), and the role of " +
      "controllers and processors (Arts. 4 and 24–28). Recitals 1–3 explain the fundamental rights " +
      "rationale; Recital 30 addresses online identifiers; Recital 50 covers processing for a single point of contact.",
    appliesWhen:
      "Typically relevant when you process personal data about individuals in the EU/EEA, monitor their behaviour, " +
      "or offer goods or services to them — even if you are established outside the EU (see Art. 3).",
    keyProvisions: [
      "Art. 3 — territorial scope (establishment, offering to data subjects in the Union, monitoring behaviour)",
      "Art. 4 — definitions of personal data, processing, controller, and processor",
      "Art. 6 — lawful bases for processing personal data",
      "Art. 9 — special categories of personal data",
      "Art. 28 — processor obligations and contracts",
      "Art. 32 — security of processing",
      "Recital 24 — processing in the context of the activities of an establishment",
      "Recital 29 — not applicable to processing by a natural person in the course of a purely personal or household activity",
    ],
  },
  ai_act: {
    code: "ai_act",
    title: "Artificial Intelligence Act (EU AI Act)",
    number: "2024/1689",
    overview:
      "The EU AI Act regulates AI systems placed on the market, put into service, or used in the Union. " +
      "It classifies systems by risk (Title III), imposes obligations on providers and deployers, and bans " +
      "certain unacceptable practices (Art. 5). High-risk AI systems listed in Annex III — such as recruitment, " +
      "creditworthiness, and biometric identification — face conformity assessment, documentation, human oversight, " +
      "and post-market monitoring. General-purpose AI models have separate obligations in Chapter V.",
    appliesWhen:
      "Relevant when your product includes machine learning, automated decision-making, generative AI, or similar " +
      "AI placed on the EU market or producing effects in the Union (Art. 2).",
    keyProvisions: [
      "Art. 2 — scope of the Regulation",
      "Art. 3 — definitions of AI system, provider, deployer, and high-risk AI system",
      "Art. 5 — prohibited AI practices",
      "Art. 6 — classification rules for high-risk AI systems",
      "Annex III — high-risk AI systems (e.g. employment, education, credit, law enforcement)",
      "Art. 9 — risk management system for high-risk AI",
      "Art. 14 — human oversight",
      "Recital 25 — machine-based systems designed to operate with varying levels of autonomy",
    ],
  },
  cra: {
    code: "cra",
    title: "Cyber Resilience Act (CRA)",
    number: "2024/2847",
    overview:
      "The CRA sets cybersecurity requirements for products with digital elements placed on the EU market. " +
      "Manufacturers must design for security by default, provide security updates, vulnerability handling, " +
      "and conformity assessment depending on risk category. It applies across the product lifecycle from design " +
      "through support and end-of-life.",
    appliesWhen:
      "Relevant for software, firmware, connected devices, and other products with digital elements sold in the EU.",
    keyProvisions: [
      "Art. 2 — scope",
      "Art. 10 — essential cybersecurity requirements",
      "Art. 14 — vulnerability handling obligations",
      "Annex I — categories of products with digital elements",
    ],
  },
  dsa: {
    code: "dsa",
    title: "Digital Services Act (DSA)",
    number: "2022/2065",
    overview:
      "The DSA regulates intermediary services — hosting, online platforms, and very large online platforms — " +
      "regarding illegal content, transparency, advertising, recommender systems, and user redress. " +
      "It imposes due diligence, notice-and-action, and reporting duties proportionate to service type and reach.",
    appliesWhen:
      "Relevant when you operate an online platform, marketplace, social network, or hosting service reaching EU users.",
    keyProvisions: [
      "Art. 3 — definitions of intermediary services and online platforms",
      "Art. 14 — liability regime for hosting",
      "Art. 16 — notice and action mechanisms",
      "Art. 24 — transparency reporting for online platforms",
    ],
  },
  dma: {
    code: "dma",
    title: "Digital Markets Act (DMA)",
    number: "2022/1925",
    overview:
      "The DMA imposes obligations on gatekeepers — very large platforms with entrenched market power — " +
      "to ensure fair and contestable digital markets. It covers interoperability, data access, self-preferencing, " +
      "and anti-steering rules for core platform services.",
    appliesWhen:
      "Relevant only if you are designated as a gatekeeper or provide core platform services at gatekeeper scale in the EU.",
    keyProvisions: [
      "Art. 2 — scope",
      "Art. 3 — gatekeeper designation criteria",
      "Art. 5 — obligations for gatekeepers",
      "Annex I — core platform services",
    ],
  },
  nis2: {
    code: "nis2",
    title: "NIS2 Directive",
    number: "2022/2555",
    overview:
      "NIS2 strengthens cybersecurity risk management and incident reporting for essential and important entities " +
      "across sectors such as energy, transport, health, digital infrastructure, and public administration. " +
      "Member States transpose it into national law; obligations include governance, supply-chain security, and reporting.",
    appliesWhen:
      "Relevant for operators of essential services, managed service providers, and entities in covered sectors in the EU.",
    keyProvisions: [
      "Art. 2 — scope",
      "Art. 21 — cybersecurity risk-management measures",
      "Art. 23 — incident notification",
      "Annex I — sectors using general approach",
      "Annex II — sectors using sector-specific approach",
    ],
  },
  data_act: {
    code: "data_act",
    title: "EU Data Act",
    number: "2023/2854",
    overview:
      "The Data Act governs access to and use of data generated by connected products and related services, " +
      "including user access, business-to-business sharing, cloud switching, and safeguards for trade secrets and SMEs.",
    appliesWhen:
      "Relevant when you manufacture connected products or offer related services generating IoT or usage data in the EU.",
    keyProvisions: [
      "Art. 2 — scope",
      "Art. 3 — definitions of connected product and related service",
      "Art. 4 — user access to data",
      "Art. 23 — switching between data processing services",
    ],
  },
  eprivacy: {
    code: "eprivacy",
    title: "ePrivacy Directive",
    number: "2002/58/EC",
    overview:
      "The ePrivacy Directive complements the GDPR for electronic communications — covering confidentiality of communications, " +
      "cookies and similar technologies, marketing messages, and traffic/location data. Member States implement it nationally.",
    appliesWhen:
      "Relevant when you store or access information on users' devices, send electronic marketing, or process communications metadata.",
    keyProvisions: [
      "Art. 5 — confidentiality of communications",
      "Art. 6 — traffic data",
      "Art. 13 — unsolicited communications",
    ],
  },
  dora: {
    code: "dora",
    title: "Digital Operational Resilience Act (DORA)",
    number: "2022/2554",
    overview:
      "DORA sets ICT risk management, incident reporting, resilience testing, and third-party oversight rules for financial entities and critical ICT providers in the EU.",
    appliesWhen:
      "Relevant for banks, insurers, investment firms, and ICT service providers supporting the financial sector in the Union.",
    keyProvisions: ["Art. 2 — scope", "Art. 5 — ICT risk management", "Art. 17 — incident reporting"],
  },
  gpsr: {
    code: "gpsr",
    title: "General Product Safety Regulation (GPSR)",
    number: "2023/988",
    overview:
      "GPSR sets general safety requirements, traceability, and incident reporting for consumer products placed on the EU market.",
    appliesWhen: "Relevant for most consumer products made available in the EU, whether sold or supplied commercially.",
    keyProvisions: ["Art. 2 — scope", "Art. 5 — safety requirements", "Art. 22 — product traceability"],
  },
  red: {
    code: "red",
    title: "Radio Equipment Directive (RED)",
    number: "2014/53/EU",
    overview:
      "RED sets essential requirements for radio equipment placed on the EU market, including spectrum use, EMC, and safety, with CE marking.",
    appliesWhen: "Relevant for products that intentionally transmit or receive radio waves and are placed on the EU market.",
    keyProvisions: ["Art. 2 — scope", "Art. 3 — essential requirements", "Annex I — product categories"],
  },
  rohs: {
    code: "rohs",
    title: "RoHS Directive",
    number: "2011/65/EU",
    overview:
      "RoHS restricts hazardous substances in electrical and electronic equipment placed on the EU market.",
    appliesWhen: "Relevant for EEE in Annex I categories placed on the EU market.",
    keyProvisions: ["Art. 2 — scope", "Art. 4 — restricted substances", "Annex II — restriction list"],
  },
  weee: {
    code: "weee",
    title: "WEEE Directive",
    number: "2012/19/EU",
    overview:
      "WEEE requires collection, recycling, and producer take-back for electrical and electronic equipment placed on the EU market.",
    appliesWhen: "Relevant for producers placing EEE on the EU market.",
    keyProvisions: ["Art. 2 — scope", "Art. 14 — producer responsibility", "Annex I — categories"],
  },
  reach: {
    code: "reach",
    title: "REACH Regulation",
    number: "1907/2006",
    overview:
      "REACH governs registration, evaluation, authorisation, and restriction of chemical substances, mixtures, and articles in the EU.",
    appliesWhen: "Relevant when manufacturing, importing, or placing articles containing regulated substances on the EU market.",
    keyProvisions: ["Art. 2 — scope", "Art. 7 — registration", "Art. 33 — SVHC communication"],
  },
  product_liability: {
    code: "product_liability",
    title: "Product Liability Directive (PLD)",
    number: "2024/2853",
    overview:
      "The revised PLD governs strict liability for defective products placed on the EU market, including software-related defects.",
    appliesWhen: "Relevant when placing products on the EU market that could cause injury or property damage if defective.",
    keyProvisions: ["Art. 2 — scope", "Art. 6 — defect", "Art. 8 — damages"],
  },
  market_surveillance: {
    code: "market_surveillance",
    title: "Market Surveillance Regulation (MSR)",
    number: "2019/1020",
    overview:
      "MSR coordinates market surveillance for products subject to Union harmonisation legislation and economic operator duties.",
    appliesWhen: "Relevant for products placed on the EU market under harmonisation rules.",
    keyProvisions: ["Art. 2 — scope", "Art. 4 — economic operators", "Art. 15 — EU responsible person"],
  },
  eecc: {
    code: "eecc",
    title: "European Electronic Communications Code (EECC)",
    number: "2018/1972",
    overview:
      "EECC regulates electronic communications networks and services in the EU as transposed by Member States.",
    appliesWhen: "Relevant for providers of electronic communications networks or services in the Union.",
    keyProvisions: ["Art. 2 — scope", "Art. 3 — definitions", "Art. 61 — access obligations"],
  },
};

export function normalizeLawCode(code: string): string {
  return (code || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_")
    .replace(/^eu_/, "");
}

export function lawSummaryForCode(code: string): LawSummaryContent | null {
  const key = normalizeLawCode(code);
  if (SUMMARIES[key]) return SUMMARIES[key];
  if (key.includes("ai") && key.includes("act")) return SUMMARIES.ai_act;
  return null;
}

export function eurlexInstrumentUrl(code: string): string | null {
  const summary = lawSummaryForCode(code);
  if (!summary) return null;
  const celex: Record<string, string> = {
    gdpr: "32016R0679",
    ai_act: "32024R1689",
    cra: "32024R2847",
    dsa: "32022R2065",
    dma: "32022R1925",
    nis2: "32022L2555",
    data_act: "32023L2854",
    eprivacy: "32002L0058",
    dora: "32022R2554",
    gpsr: "32023R0988",
    red: "32014L0053",
    rohs: "32011L0065",
    weee: "32012L0019",
    reach: "32006R1907",
    product_liability: "32024L2853",
    market_surveillance: "32019R1020",
    eecc: "32018L1972",
  };
  const key = normalizeLawCode(code);
  const id = celex[key];
  return id ? `https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:${id}` : null;
}
