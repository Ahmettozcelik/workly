"use client";

import { useTranslations } from "next-intl";
import { useState, useSyncExternalStore } from "react";
import {
  nextPreference,
  readPreference,
  setPreference,
  subscribePreference,
  type ThemePreference,
} from "@/lib/theme";

// Copy lives in messages under "theme": full phrases per mode, since Turkish
// suffixes depend on the word.

// The server cannot know the stored preference, so hydration starts from
// "system" and the icon updates right after hydration (page colours do not).
const getServerPreference = (): ThemePreference => "system";

export function ThemeToggle() {
  const t = useTranslations("theme");
  const preference = useSyncExternalStore(
    subscribePreference,
    readPreference,
    getServerPreference,
  );
  const [announcement, setAnnouncement] = useState("");

  const next = nextPreference(preference);
  const label = t("label", {
    current: t(`name.${preference}`),
    switchTo: t(`switchTo.${next}`),
  });

  function handleClick() {
    setPreference(next);
    setAnnouncement(t(`selected.${next}`));
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        aria-label={label}
        title={label}
        className="inline-flex size-11 items-center justify-center rounded-control border border-line-strong bg-surface text-fg transition-colors hover:bg-canvas"
      >
        <ThemeIcon preference={preference} />
      </button>
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  );
}

function ThemeIcon({ preference }: { preference: ThemePreference }) {
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
      {preference === "system" && (
        <>
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </>
      )}
      {preference === "light" && (
        <>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </>
      )}
      {preference === "dark" && <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />}
    </svg>
  );
}
