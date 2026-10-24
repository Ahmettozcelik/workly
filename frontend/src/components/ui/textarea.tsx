import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { controlClasses, textControlClasses } from "./control-styles";

export function Textarea({
  rows = 4,
  className,
  ...props
}: ComponentProps<"textarea">) {
  return (
    <textarea
      rows={rows}
      className={cn(
        controlClasses,
        textControlClasses,
        "resize-y py-3",
        className,
      )}
      {...props}
    />
  );
}
