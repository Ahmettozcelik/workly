import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type CardPadding = "sm" | "md" | "lg";

const PADDING_CLASSES: Record<CardPadding, string> = {
  sm: "p-4",
  md: "p-6",
  lg: "p-6 sm:p-8",
};

type CardProps = ComponentProps<"div"> & {
  padding?: CardPadding;
};

// Wrap in <section>/<article> at the call site when the content needs it.
export function Card({ padding = "md", className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-line bg-surface text-fg shadow-card",
        PADDING_CLASSES[padding],
        className,
      )}
      {...props}
    />
  );
}
