import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type AlertVariant = "neutral" | "success" | "danger";

const VARIANT_CLASSES: Record<AlertVariant, { border: string; icon: string }> = {
  neutral: { border: "border-s-line-strong", icon: "text-fg-muted" },
  success: { border: "border-s-success", icon: "text-success" },
  danger: { border: "border-s-danger", icon: "text-danger" },
};

type AlertProps = ComponentProps<"div"> & {
  variant?: AlertVariant;
  title?: ReactNode;
};

// danger -> role="alert" (assertive); others -> role="status" (polite).
// Live regions announce only when inserted or changed after load, so render
// alerts conditionally rather than toggling visibility with CSS.
export function Alert({
  variant = "neutral",
  title,
  className,
  children,
  ...props
}: AlertProps) {
  return (
    <div
      role={variant === "danger" ? "alert" : "status"}
      className={cn(
        "flex gap-3 rounded-control border border-s-4 border-line bg-surface p-4 text-fg",
        VARIANT_CLASSES[variant].border,
        className,
      )}
      {...props}
    >
      <AlertIcon
        variant={variant}
        className={cn("mt-0.5 size-5 shrink-0", VARIANT_CLASSES[variant].icon)}
      />
      <div className="min-w-0 space-y-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div>{children}</div>}
      </div>
    </div>
  );
}

function AlertIcon({ variant, className }: { variant: AlertVariant; className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="9" />
      {variant === "danger" && <path d="M12 7.5v5M12 16.5h.01" />}
      {variant === "success" && <path d="m8.5 12.5 2.5 2.5 4.5-5" />}
      {variant === "neutral" && <path d="M12 11v5.5M12 7.5h.01" />}
    </svg>
  );
}
