// Shared look for Input, Textarea and Select — keep them visually identical.
export const controlClasses = [
  "w-full rounded-control border border-line-strong bg-surface px-4 text-base text-fg",
  "placeholder:text-fg-muted transition-colors ease-standard",
  "enabled:hover:not-aria-invalid:border-fg-muted aria-invalid:border-danger",
  "disabled:cursor-not-allowed disabled:opacity-50",
  "autofill:shadow-[inset_0_0_0_1000px_var(--surface)] autofill:[-webkit-text-fill-color:var(--fg)]",
].join(" ");

// Only for text-entry controls: <select> always matches :read-only.
export const textControlClasses = "read-only:bg-canvas";
