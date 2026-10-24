import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "neutral" | "accent" | "success" | "danger";

// Outline style: transparent background, so text contrast equals the token
// on whatever surface the badge sits on.
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: "border-line-strong text-fg-muted",
  accent: "border-accent-text text-accent-text",
  success: "border-success text-success",
  danger: "border-danger text-danger",
};

type BadgeProps = ComponentProps<"span"> & {
  variant?: BadgeVariant;
};

export function Badge({ variant = "neutral", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold",
        VARIANT_CLASSES[variant],
        className,
      )}
      {...props}
    />
  );
}
