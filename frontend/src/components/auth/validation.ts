// Email rule shared by the auth forms, so Register and Login cannot drift.
// Prototype only: a basic shape check, not the final validation policy.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Returns the message key for an invalid email (common.email.*), or undefined.
// Surrounding whitespace is ignored.
export function validateEmail(value: string): "errorEmpty" | "errorInvalid" | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "errorEmpty";
  if (!EMAIL_PATTERN.test(trimmed)) return "errorInvalid";
  return undefined;
}
