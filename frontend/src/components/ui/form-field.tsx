import { useId, type ReactNode } from "react";
import { cn } from "@/lib/cn";

// Must stay server-compatible: do NOT add "use client". `children` is a
// function, which a Server Component cannot pass to a Client Component.

// Props to spread onto the field's control: {...control}
export type FieldControlProps = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  required?: boolean;
  disabled?: boolean;
};

type FormFieldProps = {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  disabled?: boolean;
  id?: string;
  /** Extra element IDs (space-separated) to merge into aria-describedby. */
  describedBy?: string;
  /** Layout only (applies to the outer wrapper). */
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
};

// Order: label -> hint -> control -> error. A required "*" must be explained
// at form level (e.g. "* Required field").
export function FormField({
  label,
  hint,
  error,
  required = false,
  disabled = false,
  id,
  describedBy,
  className,
  children,
}: FormFieldProps) {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const hasHint = hint != null && hint !== false && hint !== "";
  const hasError = error != null && error !== false && error !== "";
  const hintId = hasHint ? `${controlId}-hint` : undefined;
  const errorId = hasError ? `${controlId}-error` : undefined;

  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={controlId} className="block text-sm font-semibold text-fg">
        {label}
        {required && (
          <span aria-hidden="true" className="ms-0.5 text-danger">
            *
          </span>
        )}
      </label>
      {hasHint && (
        <p id={hintId} className="text-sm text-fg-muted">
          {hint}
        </p>
      )}
      {children({
        id: controlId,
        "aria-describedby": mergeIds(hintId, errorId, describedBy),
        "aria-invalid": hasError || undefined,
        required: required || undefined,
        disabled: disabled || undefined,
      })}
      {hasError && (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

function mergeIds(...values: Array<string | undefined>) {
  const ids = new Set(
    values.flatMap((value) => value?.split(/\s+/) ?? []).filter(Boolean),
  );
  return ids.size > 0 ? [...ids].join(" ") : undefined;
}
