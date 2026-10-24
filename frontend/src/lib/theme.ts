export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "workly-theme";
export const DARK_MEDIA_QUERY = "(prefers-color-scheme: dark)";

const THEME_ORDER: readonly ThemePreference[] = ["system", "light", "dark"];
const CHANGE_EVENT = "workly-theme-change";

// Used only when localStorage is unavailable (e.g. blocked in private mode).
let memoryPreference: ThemePreference = "system";

export function parsePreference(value: string | null): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}

export function readPreference(): ThemePreference {
  try {
    return parsePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return memoryPreference;
  }
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference !== "system") return preference;
  return window.matchMedia(DARK_MEDIA_QUERY).matches ? "dark" : "light";
}

export function applyTheme(preference: ThemePreference) {
  document.documentElement.dataset.theme = resolveTheme(preference);
}

export function nextPreference(preference: ThemePreference): ThemePreference {
  return THEME_ORDER[(THEME_ORDER.indexOf(preference) + 1) % THEME_ORDER.length];
}

// "system" is stored as an absent key so it behaves exactly like a first visit.
export function setPreference(preference: ThemePreference) {
  memoryPreference = preference;
  try {
    if (preference === "system") localStorage.removeItem(THEME_STORAGE_KEY);
    else localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Storage unavailable: the choice lasts for this page only.
  }
  applyTheme(preference);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

// Notifies on changes from this tab (custom event) and other tabs (storage event).
export function subscribePreference(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

// Runs in <head> before first paint. Must stay a static string (no per-request
// values) so a future CSP can allow it by nonce or by hash.
export const themeInitScript = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});var d=p==="dark"||(p!=="light"&&window.matchMedia(${JSON.stringify(
  DARK_MEDIA_QUERY,
)}).matches);document.documentElement.dataset.theme=d?"dark":"light"}catch(e){}})()`;
