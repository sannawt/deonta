/**
 * Readable multi-sentence summaries for scope dimension rows.
 */

import type { ScopeDimension } from "../types/chat";
import { enrichDimensionSummary } from "./scopeLawNarratives";

export function compactDimensionSummary(dim: ScopeDimension, regKey?: string): string {
  return enrichDimensionSummary(dim, regKey);
}
