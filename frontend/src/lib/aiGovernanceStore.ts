import { nanoid } from "./utils";

export type AiRiskTier = "prohibited" | "high" | "limited" | "minimal" | "unknown";
export type AiModelType = "in_house" | "third_party" | "gpai" | "unknown";
export type AiOwnerTeam = "legal" | "privacy" | "product" | "security" | "engineering" | "other";
export type AiApprovalStatus = "draft" | "in_review" | "approved" | "rejected";

export interface AiGovernanceEntry {
  id: string;
  toolName: string;
  vendor?: string;
  useCase: string;
  dataTypes: string;
  modelType: AiModelType;
  riskTier: AiRiskTier;
  owner: AiOwnerTeam;
  approvalStatus: AiApprovalStatus;
  reviewDate?: string;
  linkedAssessmentIds: string[];
  created_at: number;
  updated_at: number;
}

const STORAGE_KEY = "ct_ai_governance_v1";

function loadRaw(): AiGovernanceEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw) as { entries?: AiGovernanceEntry[] };
    return Array.isArray(data.entries) ? data.entries : [];
  } catch {
    return [];
  }
}

function saveRaw(entries: AiGovernanceEntry[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries }));
}

export function loadAiGovernanceEntries(): AiGovernanceEntry[] {
  return loadRaw().sort((a, b) => b.updated_at - a.updated_at);
}

export function upsertAiGovernanceEntry(
  entry: Omit<AiGovernanceEntry, "id" | "created_at" | "updated_at"> & { id?: string },
): AiGovernanceEntry {
  const now = Date.now();
  const rows = loadRaw();
  const id = entry.id ?? nanoid();
  const idx = rows.findIndex((r) => r.id === id);
  const record: AiGovernanceEntry = {
    ...entry,
    id,
    created_at: idx >= 0 ? rows[idx].created_at : now,
    updated_at: now,
  };
  if (idx >= 0) {
    rows[idx] = record;
  } else {
    rows.unshift(record);
  }
  saveRaw(rows);
  return record;
}

export function deleteAiGovernanceEntry(id: string): void {
  saveRaw(loadRaw().filter((r) => r.id !== id));
}

export function createEntryFromIntake(args: {
  assessmentId: string;
  productName: string;
  productSummary: string;
  aiUsageDescription: string;
}): Omit<AiGovernanceEntry, "id" | "created_at" | "updated_at"> {
  return {
    toolName: args.productName || "Unnamed AI use case",
    useCase: args.productSummary || args.aiUsageDescription || "",
    dataTypes: "",
    modelType: "unknown",
    riskTier: "unknown",
    owner: "privacy",
    approvalStatus: "draft",
    linkedAssessmentIds: [args.assessmentId],
  };
}
