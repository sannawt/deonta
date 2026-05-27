import type { GateStatus, ReadinessStatus } from "@/types/workbench";

export function readinessBadgeVariant(
  status: ReadinessStatus
): "ok" | "warn" | "risk" | "accent" | "default" {
  switch (status) {
    case "Ready for determination":
      return "ok";
    case "Needs facts":
      return "warn";
    case "Potentially defeated":
      return "risk";
    case "Interpretation required":
      return "accent";
    default:
      return "default";
  }
}

export function gateBadgeVariant(
  status: GateStatus
): "ok" | "warn" | "risk" | "accent" | "default" {
  switch (status) {
    case "Sufficiently supported":
      return "ok";
    case "Missing decisive facts":
      return "warn";
    case "Contested":
      return "accent";
    case "Potentially defeated":
      return "risk";
    default:
      return "default";
  }
}

export function factStatusLabel(status: string): string {
  const map: Record<string, string> = {
    user: "User-provided",
    extracted: "Extracted candidate",
    confirmed: "Lawyer-confirmed",
    missing: "Missing",
    contested: "Contested",
    derived: "Derived",
    defeating: "Potential defeater",
  };
  return map[status] ?? status;
}
