import { useId, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { mergeIds } from "@/lib/merge-ids";

// Native checkbox with its own label, description and error (not used inside
// FormField). Server-compatible: do not add "use client".
type CheckboxProps = Omit<ComponentProps<"input">, "type" | "children"> & {
  label: ReactNode;
  description?: ReactNode;
  error?: ReactNode;
};

export function Checkbox({
  label,
  description,
  error,
  id,
  required,
  disabled,
  className,
  "aria-describedby": describedBy,
  ...props
}: CheckboxProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hasDescription =
    description != null && description !== false && description !== "";
  const hasError = error != null && error !== false && error !== "";
  const descriptionId = hasDescription ? `${inputId}-description` : undefined;
  const errorId = hasError ? `${inputId}-error` : undefined;

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id={inputId}
          required={required}
          disabled={disabled}
          aria-describedby={mergeIds(descriptionId, errorId, describedBy)}
          aria-invalid={hasError || undefined}
          className="mt-0.5 size-5 shrink-0 cursor-pointer accent-accent disabled:cursor-not-allowed"
          {...props}
        />
        <div className="min-w-0 space-y-1">
          <label
            htmlFor={inputId}
            className={cn(
              "block text-base",
              disabled ? "cursor-not-allowed text-fg-muted" : "cursor-pointer text-fg",
            )}
          >
            {label}
            {required && (
              <span aria-hidden="true" className="ms-0.5 text-danger">
                *
              </span>
            )}
          </label>
          {hasDescription && (
            <p id={descriptionId} className="text-sm text-fg-muted">
              {description}
            </p>
          )}
        </div>
      </div>
      {hasError && (
        <p id={errorId} className="ps-8 text-sm font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
