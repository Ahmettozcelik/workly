import type { Locale } from "next-intl";
import { deleteJson, getJson, postJson } from "./client";

// The signed-in member as returned by the API.
export type ApiUser = {
  id: string;
  email: string;
  displayName: string;
  locale: Locale;
  emailVerified: boolean;
};

// One of the signed-in member's sessions. `id` is an opaque handle (never the
// session id); `device` is e.g. "Chrome · Windows", null when unknown. Times
// are ISO 8601.
export type ApiSession = {
  id: string;
  current: boolean;
  device: string | null;
  createdAt: string;
  lastActiveAt: string;
};

// Changes the signed-in member's password (204); other sessions end, this one
// stays. Errors: VALIDATION_FAILED (400; currentPassword INCORRECT, newPassword
// SAME_AS_CURRENT, the registration rules), RATE_LIMITED (429), UNAUTHENTICATED (401).
export function changePassword(currentPassword: string, newPassword: string) {
  return postJson<void>("/api/auth/password", { currentPassword, newPassword });
}

// The signed-in member's sessions, this one first. Errors: UNAUTHENTICATED (401).
export function listSessions() {
  return getJson<ApiSession[]>("/api/auth/sessions");
}

// Ends one session (204); ending this one signs out. Errors: NOT_FOUND (404), UNAUTHENTICATED (401).
export function revokeSession(id: string) {
  return deleteJson<void>(`/api/auth/sessions/${encodeURIComponent(id)}`);
}

// Ends every session except this one (204). Errors: UNAUTHENTICATED (401).
export function revokeOtherSessions() {
  return postJson<void>("/api/auth/sessions/revoke-others", {});
}

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

// Mails a password reset link if the email has an account (202, no body). The
// API answers the same for any email. Errors: VALIDATION_FAILED (400), RATE_LIMITED (429).
export function requestPasswordReset(email: string) {
  return postJson<void>("/api/auth/password-reset", { email });
}

// Sets a new password with a reset link's token (204) and signs the member out
// on every device; no new session. Errors: PASSWORD_RESET_TOKEN_INVALID (400:
// unknown, used or expired), VALIDATION_FAILED (400).
export function resetPassword(token: string, password: string) {
  return postJson<void>("/api/auth/password-reset/confirm", { token, password });
}
