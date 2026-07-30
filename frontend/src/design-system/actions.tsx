import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "ds-focus-ring inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-ds-sm text-[length:var(--ds-text-button)] font-semibold transition-colors duration-fast disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-ds-primary text-white hover:bg-ds-primary-hover",
        secondary:
          "border border-ds-border-strong bg-ds-surface text-ds-text-primary hover:bg-ds-subtle",
        tertiary: "text-ds-primary hover:bg-ds-primary-soft",
        destructive: "bg-ds-destructive text-white hover:bg-ds-critical",
        ghost: "text-ds-text-secondary hover:bg-ds-subtle hover:text-ds-text-primary",
        outline:
          "border border-ds-border bg-transparent text-ds-text-secondary hover:bg-ds-subtle",
      },
      size: {
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4",
        lg: "h-10 px-5",
        icon: "h-9 w-9 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export function IconButton({
  label,
  className,
  ...props
}: Omit<ButtonProps, "children" | "size"> & { label: string; children: React.ReactNode }) {
  return (
    <Button size="icon" aria-label={label} title={label} className={className} {...props} />
  );
}

export function SplitButton({
  label,
  onPrimary,
  menuItems,
  loading,
  disabled,
}: {
  label: string;
  onPrimary: () => void;
  menuItems: Array<{ id: string; label: string; onSelect: () => void }>;
  loading?: boolean;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative inline-flex">
      <Button
        variant="primary"
        className="rounded-e-none"
        loading={loading}
        disabled={disabled}
        onClick={onPrimary}
      >
        {label}
      </Button>
      <Button
        variant="primary"
        size="icon"
        className="rounded-s-none border-l border-white/30"
        disabled={disabled || loading}
        aria-label={`${label} more actions`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden>▾</span>
      </Button>
      {open ? (
        <ul
          role="menu"
          className="absolute right-0 top-full z-dropdown mt-1 min-w-[10rem] rounded-ds-md border border-ds-border bg-ds-surface py-1 shadow-ds-md"
        >
          {menuItems.map((item) => (
            <li key={item.id} role="none">
              <button
                type="button"
                role="menuitem"
                className="ds-focus-ring block w-full px-3 py-1.5 text-left text-sm text-ds-text-primary hover:bg-ds-subtle"
                onClick={() => {
                  setOpen(false);
                  item.onSelect();
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export { buttonVariants };
