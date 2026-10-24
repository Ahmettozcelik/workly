import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { controlClasses } from "./control-styles";

// Native single-value <select>. className styles the wrapper (layout only);
// every other prop, including ref, goes to the <select> element.
// Placeholder pattern: <option value="" disabled>Choose…</option>
export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <div className={cn("relative", className)}>
      <select
        className={cn(controlClasses, "peer h-12 appearance-none pe-10")}
        {...props}
      >
        {children}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="pointer-events-none absolute end-3 top-1/2 size-5 -translate-y-1/2 text-fg-muted peer-disabled:opacity-50"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
  );
}
