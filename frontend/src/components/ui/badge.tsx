import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-paper-line bg-paper-muted text-ink-mid",
        ok: "border-legal-ok/30 bg-legal-okBg text-legal-ok",
        warn: "border-legal-warn/30 bg-legal-warnBg text-legal-warn",
        risk: "border-legal-risk/30 bg-legal-riskBg text-legal-risk",
        accent: "border-legal-accent/20 bg-legal-soft text-legal-accent",
        outline: "border-paper-line text-ink-dim",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export function Badge({
  className,
  variant,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
