import type { Locale } from "next-intl";
import { postJson } from "./client";

// The signed-in member as returned by the API.
export type ApiUser = {
  id: string;
  email: string;
  displayName: string;
  locale: Locale;
  emailVerified: boolean;
};

// Registers the email (202, no body, no session). The API answers the same
// whether or not the email already has an account; the address gets a mail
// either way. Errors: VALIDATION_FAILED (400), RATE_LIMITED (429).
export function register(input: { displayName: string; email: string; password: string; locale: Locale }) {
  return postJson<void>("/api/auth/register", input);
}

// Starts a session (200). Errors: INVALID_CREDENTIALS (401), VALIDATION_FAILED (400).
export function login(input: { email: string; password: string }) {
  return postJson<ApiUser>("/api/auth/login", input);
}

// Confirms a mailed verification link (204; no session needed).
// Errors: VERIFICATION_TOKEN_INVALID (400: unknown, used or expired), VALIDATION_FAILED (400).
export function verifyEmail(token: string) {
  return postJson<void>("/api/auth/verify-email", { token });
}

// Mails the signed-in member a new verification link (204; nothing if already verified).
// Errors: RATE_LIMITED (429, with Retry-After), UNAUTHENTICATED (401).
export function resendVerificationEmail() {
  return postJson<void>("/api/auth/verification-email", {});
}
