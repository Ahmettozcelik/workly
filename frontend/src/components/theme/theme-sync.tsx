"use client";

import { useLayoutEffect } from "react";
import {
  applyTheme,
  DARK_MEDIA_QUERY,
  readPreference,
  THEME_STORAGE_KEY,
} from "@/lib/theme";

// Keeps data-theme correct after the initial script has run:
// - follows OS changes while the preference is "system"
// - applies changes made in other tabs (storage event)
// - re-applies after React's development remount, which resets <html> attributes
export function ThemeSync() {
  useLayoutEffect(() => {
    applyTheme(readPreference());

    const media = window.matchMedia(DARK_MEDIA_QUERY);
    const onMediaChange = () => {
      if (readPreference() === "system") applyTheme("system");
    };
    const onStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY || event.key === null) {
        applyTheme(readPreference());
      }
    };

    media.addEventListener("change", onMediaChange);
    window.addEventListener("storage", onStorage);
    return () => {
      media.removeEventListener("change", onMediaChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return null;
}
