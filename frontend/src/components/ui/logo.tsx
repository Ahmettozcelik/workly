import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

// "Workly" is a temporary working name; keep the wordmark in this file only.
export type LogoSize = "md" | "lg";

const SIZE_CLASSES: Record<LogoSize, string> = {
  md: "text-2xl",
  lg: "text-4xl",
};

type LogoProps = Omit<ComponentProps<"span">, "children"> & {
  size?: LogoSize;
};

export function Logo({ size = "md", className, ...props }: LogoProps) {
  return (
    <span
      className={cn(
        "font-display font-extrabold tracking-tight text-fg",
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      Workly
    </span>
  );
}
