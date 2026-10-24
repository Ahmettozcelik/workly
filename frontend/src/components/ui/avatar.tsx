import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export type AvatarSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: "size-8 text-xs",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
};

// First letter of the first and last word, uppercased for the given locale
// ("tr": i -> İ, ı -> I).
export function getInitials(name: string, locale = "tr") {
  const words = name.normalize("NFC").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = Array.from(words[0])[0];
  const last = words.length > 1 ? Array.from(words[words.length - 1])[0] : "";
  return (first + last).toLocaleUpperCase(locale);
}

type AvatarProps = Omit<ComponentProps<"span">, "children"> & {
  name: string;
  size?: AvatarSize;
  /** Locale for uppercasing initials; Step 3 passes the active locale. */
  locale?: string;
  /** Hide from assistive technology when the name is visible next to it. */
  decorative?: boolean;
};

// Initials only for now; image support arrives with the file-storage decision.
export function Avatar({
  name,
  size = "md",
  locale = "tr",
  decorative = false,
  className,
  ...props
}: AvatarProps) {
  const label = name.trim();
  const initials = getInitials(label, locale);
  const hidden = decorative || label === "";

  return (
    <span
      role={hidden ? undefined : "img"}
      aria-label={hidden ? undefined : label}
      aria-hidden={hidden || undefined}
      className={cn(
        "inline-flex shrink-0 select-none items-center justify-center rounded-full bg-primary font-semibold text-primary-fg",
        SIZE_CLASSES[size],
        className,
      )}
      {...props}
    >
      {initials || <PersonIcon />}
    </span>
  );
}

function PersonIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-1/2"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </svg>
  );
}
