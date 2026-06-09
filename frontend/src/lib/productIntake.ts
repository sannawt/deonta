import {
  hasStructuredIntake,
  intakeToDescription,
  type ProductIntakeState,
} from "./kgIntakeSchema";

/** @deprecated Use intakeToDescription with ProductIntakeState */
export function buildIntakeDescription(
  productInfo: string,
  marketsAndLocation: string,
): string {
  const parts: string[] = [];
  const product = productInfo.trim();
  const markets = marketsAndLocation.trim();
  if (product) parts.push(`Product or service:\n${product}`);
  if (markets) parts.push(`Customers and location:\n${markets}`);
  return parts.join("\n\n");
}

export function hasIntakeInput(
  productInfo: string,
  marketsAndLocation: string,
  filesCount: number,
  kgFactsCount: number,
): boolean {
  return (
    productInfo.trim().length >= 12 ||
    marketsAndLocation.trim().length >= 8 ||
    filesCount > 0 ||
    kgFactsCount > 0
  );
}

export { hasStructuredIntake, intakeToDescription, type ProductIntakeState };
