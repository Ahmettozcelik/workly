import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";
import { controlClasses, textControlClasses } from "./control-styles";

// Text-like inputs only (text, email, password, search, tel, url, ...).
export function Input({ className, ...props }: ComponentProps<"input">) {
  return (
    <input
      className={cn(controlClasses, textControlClasses, "h-12", className)}
      {...props}
    />
  );
}
