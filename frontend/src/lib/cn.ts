// Joins class names, skipping falsy values. Does not resolve Tailwind
// conflicts, so a component's className prop is for layout only.
export function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}
