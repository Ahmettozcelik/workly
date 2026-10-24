"use client";

import { useTranslations } from "next-intl";
import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";

type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type"> & {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
};

// Password field with a show/hide toggle. The form owns `visible`, so it can
// hide the password again (e.g. after a reset). Spread the FormField control
// props onto it; the toggle points at the input through its id.
export function PasswordInput({
  visible,
  onVisibleChange,
  className,
  ...props
}: PasswordInputProps) {
  const t = useTranslations("common");

  return (
    <div className="relative">
      <Input
        type={visible ? "text" : "password"}
        {...props}
        className={cn("pe-14", className)}
      />
      <button
        type="button"
        onClick={() => onVisibleChange(!visible)}
        aria-pressed={visible}
        aria-controls={props.id}
        aria-label={t("password.show")}
        title={t("password.show")}
        className="absolute end-0.5 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-control text-fg-muted transition-colors hover:text-fg"
      >
        <EyeIcon crossed={visible} />
      </button>
    </div>
  );
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="M4 4l16 16" />}
    </svg>
  );
}
