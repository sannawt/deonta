import type { LawScanResponse } from "./api";
import type { ChatResponse } from "../types/chat";

const PREFIX = "ct-proto-v3";

function fp(text: string): string {
  let h = 0;
  const s = text.trim().toLowerCase();
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}

export function scanCacheKey(description: string, includeSecondary: boolean): string {
  return `${PREFIX}:scan:${fp(description)}:${includeSecondary ? "1" : "0"}`;
}

export function assessCacheKey(description: string, regulations: string[]): string {
  const codes = [...regulations].sort().join(",");
  return `${PREFIX}:assess:${fp(description)}:${fp(codes)}`;
}

export function readScanCache(key: string): LawScanResponse | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as LawScanResponse;
  } catch {
    return null;
  }
}

export function writeScanCache(key: string, data: LawScanResponse): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* quota */
  }
}

export function readAssessCache(key: string): ChatResponse | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as ChatResponse;
  } catch {
    return null;
  }
}

export function writeAssessCache(key: string, data: ChatResponse): void {
  try {
    sessionStorage.setItem(key, JSON.stringify(data));
  } catch {
    /* quota */
  }
}
