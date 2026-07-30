import * as React from "react";
import { cn } from "@/lib/utils";

export function FormField({
  id,
  label,
  required,
  help,
  error,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  help?: string;
  error?: string;
  children: React.ReactNode;
}) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-xs font-semibold text-ds-text-primary">
        {label}
        {required ? (
          <span className="ml-0.5 text-ds-critical" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children}
      {help && !error ? (
        <p id={helpId} className="text-xs text-ds-text-muted">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-ds-critical" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const controlClass =
  "ds-focus-ring w-full rounded-ds-sm border border-ds-border bg-ds-surface px-3 py-2 text-sm text-ds-text-primary placeholder:text-ds-text-muted disabled:cursor-not-allowed disabled:bg-ds-subtle disabled:opacity-70";

export const TextInput = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(controlClass, invalid && "border-ds-critical", className)}
    aria-invalid={invalid || undefined}
    {...props}
  />
));
TextInput.displayName = "TextInput";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }
>(({ className, invalid, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(controlClass, "min-h-[88px] resize-y", invalid && "border-ds-critical", className)}
    aria-invalid={invalid || undefined}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }
>(({ className, invalid, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(controlClass, invalid && "border-ds-critical", className)}
    aria-invalid={invalid || undefined}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

export function SearchField({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <TextInput
      type="search"
      className={cn("ps-3", className)}
      placeholder={props.placeholder ?? "Search…"}
      {...props}
    />
  );
}

export function Checkbox({
  label,
  description,
  className,
  id,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  description?: string;
}) {
  const inputId = id ?? `cb-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <label htmlFor={inputId} className={cn("flex cursor-pointer gap-2.5", className)}>
      <input
        id={inputId}
        type="checkbox"
        className="ds-focus-ring mt-0.5 h-4 w-4 rounded border-ds-border-strong text-ds-primary"
        {...props}
      />
      <span>
        <span className="block text-sm font-medium text-ds-text-primary">{label}</span>
        {description ? (
          <span className="block text-xs text-ds-text-muted">{description}</span>
        ) : null}
      </span>
    </label>
  );
}

export function RadioGroup({
  name,
  legend,
  options,
  value,
  onChange,
}: {
  name: string;
  legend: string;
  options: Array<{ value: string; label: string; description?: string }>;
  value?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-ds-text-primary">{legend}</legend>
      {options.map((opt) => (
        <label key={opt.value} className="flex cursor-pointer gap-2.5">
          <input
            type="radio"
            name={name}
            value={opt.value}
            checked={value === opt.value}
            onChange={() => onChange?.(opt.value)}
            className="ds-focus-ring mt-0.5 h-4 w-4 border-ds-border-strong text-ds-primary"
          />
          <span>
            <span className="block text-sm font-medium text-ds-text-primary">{opt.label}</span>
            {opt.description ? (
              <span className="block text-xs text-ds-text-muted">{opt.description}</span>
            ) : null}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export function Switch({
  label,
  checked,
  onCheckedChange,
  id,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  id?: string;
}) {
  const switchId = id ?? `sw-${label.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <button
      id={switchId}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "ds-focus-ring relative inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors",
        checked ? "border-ds-primary bg-ds-primary" : "border-ds-border-strong bg-ds-subtle",
      )}
    >
      <span
        className={cn(
          "pointer-events-none absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-ds-sm transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

export function DateField(
  props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { invalid?: boolean },
) {
  return <TextInput type="date" {...props} />;
}

export function NumberField(
  props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { invalid?: boolean },
) {
  return <TextInput type="number" inputMode="numeric" {...props} />;
}

export function InputAffix({
  prefix,
  suffix,
  children,
}: {
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  children: React.ReactElement;
}) {
  return (
    <div className="flex items-stretch overflow-hidden rounded-ds-sm border border-ds-border bg-ds-surface focus-within:shadow-ds-focus">
      {prefix ? (
        <span className="flex items-center border-r border-ds-border bg-ds-subtle px-2.5 text-xs text-ds-text-muted">
          {prefix}
        </span>
      ) : null}
      <div className="min-w-0 flex-1 [&_input]:border-0 [&_input]:shadow-none [&_input]:focus:ring-0">
        {children}
      </div>
      {suffix ? (
        <span className="flex items-center border-l border-ds-border bg-ds-subtle px-2.5 text-xs text-ds-text-muted">
          {suffix}
        </span>
      ) : null}
    </div>
  );
}
