// Placeholders for features that do not exist yet (jobs, messages, ...) are
// focusable buttons with aria-disabled="true" and aria-describedby pointing at
// this one hidden "Coming soon" note, rendered once by AppShell. Same pattern
// as "Forgot your password?" on the login page.
export const COMING_SOON_ID = "coming-soon-note";

export const comingSoonProps = {
  type: "button",
  "aria-disabled": true,
  "aria-describedby": COMING_SOON_ID,
} as const;
