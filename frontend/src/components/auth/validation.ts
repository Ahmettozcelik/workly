// Field rules shared by the auth forms, so Register and Login cannot drift.
// They mirror the backend (AuthRequests.java); the server checks them again.
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN_LENGTH = 8;
// bcrypt only uses 72 bytes; a Turkish letter such as "ş" is two of them.
export const PASSWORD_MAX_BYTES = 72;
export const DISPLAY_NAME_MAX_LENGTH = 100;

// Returns the message key for an invalid email (common.email.*), or undefined.
// Surrounding whitespace is ignored.
export function validateEmail(value: string): "errorEmpty" | "errorInvalid" | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "errorEmpty";
  if (!EMAIL_PATTERN.test(trimmed)) return "errorInvalid";
  return undefined;
}

// Password for a new account (auth.register.password.*).
export function validateNewPassword(
  value: string,
): "errorEmpty" | "errorTooShort" | "errorTooLong" | undefined {
  if (!value) return "errorEmpty";
  if (value.length < PASSWORD_MIN_LENGTH) return "errorTooShort";
  if (new TextEncoder().encode(value).length > PASSWORD_MAX_BYTES) return "errorTooLong";
  return undefined;
}

// Full name (auth.register.name.*). Surrounding whitespace is ignored.
export function validateDisplayName(value: string): "errorEmpty" | "errorTooLong" | undefined {
  const trimmed = value.trim();
  if (!trimmed) return "errorEmpty";
  if (trimmed.length > DISPLAY_NAME_MAX_LENGTH) return "errorTooLong";
  return undefined;
}
