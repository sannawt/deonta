export type FactStatus =
  | "user"
  | "extracted"
  | "confirmed"
  | "missing"
  | "contested"
  | "derived"
  | "defeating";

export type GateStatus =
  | "Sufficiently supported"
  | "Missing decisive facts"
  | "Contested"
  | "Potentially defeated"
  | "Not assessed";

export type ReadinessStatus =
  | "Ready for determination"
  | "Needs facts"
  | "Potentially defeated"
  | "Interpretation required";

export interface FactChip {
  id: string;
  label: string;
  predicate: string;
  status: FactStatus;
  effect?: "required" | "sufficient" | "supporting" | "defeating";
  source?: string;
  whyItMatters?: string;
  counterfactualImpact?: string;
}

export interface LegalSource {
  label: string;
  excerpt: string;
  nodeId: string;
}

export interface ApplicabilityGate {
  id: string;
  gate: "Temporal scope" | "Territorial scope" | "Material scope" | "Exclusions / defeat conditions";
  status: GateStatus;
  decisiveQuestion: string;
  whyItMatters: string;
  knownFacts: FactChip[];
  missingFacts: FactChip[];
  contestedFacts: FactChip[];
  potentialDefeaters: FactChip[];
  derivedPredicates: string[];
  legalSources: LegalSource[];
  ruleSnippet: string;
  counterfactualImpact: string;
  proofTrace?: string[];
}

export interface FactScale {
  supports: string[];
  missingContested: string[];
  defeats: string[];
}

export interface RegulationReadiness {
  regulation: string;
  shortCode: string;
  decisiveFactCount: number;
  missingCount: number;
  contestedCount: number;
  exclusionCount: number;
  readiness: ReadinessStatus;
  determinationNote: string;
  gates: ApplicabilityGate[];
  scale: FactScale;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  factRefs?: string[];
}

export interface ChatFact {
  id: string;
  label: string;
  predicate: string;
  status: FactStatus;
  source: string;
}

export interface InterpretationProfile {
  id: string;
  label: string;
  description: string;
  affectedRegulations: string[];
  ruleChanges: string[];
  decisiveFactShifts: string[];
  gateSensitivity: { regulation: string; gate: string; from: GateStatus; to: GateStatus }[];
  likelyDeterminationChange?: string;
}

export interface Counterfactual {
  id: string;
  label: string;
  enabled: boolean;
  gatesAffected: string[];
  rulesAffected: string[];
  becomesDecisive?: string[];
  requiresRerun: boolean;
}

export interface ProofTrace {
  legalGraphNodeIds: string[];
  scenarioGraphNodeIds: string[];
  ruleId: string;
  predicateSchemaId: string;
}

export interface SelectionDetail {
  fact?: FactChip;
  gate?: ApplicabilityGate;
  regulation?: string;
  proofTrace?: ProofTrace;
  scenarioEvidence?: { label: string; source: string; confirmed: boolean }[];
}

export interface WorkbenchScenario {
  id: string;
  title: string;
  question: string;
  intro: string;
  chatMessages: ChatMessage[];
  chatFacts: ChatFact[];
  regulations: RegulationReadiness[];
  interpretationProfiles: InterpretationProfile[];
  counterfactuals: Counterfactual[];
  legalGraphNodes: Record<string, { label: string; type: string }>;
  scenarioGraphNodes: Record<string, { label: string; type: string }>;
  predicateSchema: Record<string, { arity: number; description: string }>;
}

export interface WorkbenchState {
  scenarioId: string;
  activeProfileId: string;
  counterfactuals: Record<string, boolean>;
  determinationRun: boolean;
  selection: SelectionDetail | null;
}
