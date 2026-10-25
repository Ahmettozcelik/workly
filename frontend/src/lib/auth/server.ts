import "server-only";
import type { Locale } from "next-intl";
import { cookies } from "next/headers";
import { cache } from "react";
import { redirect } from "@/i18n/navigation";
import type { ApiUser } from "@/lib/api/auth";

// The session check for server-rendered pages (Data Access Layer). The backend
// is the authority: the HttpOnly session cookie is forwarded to /api/auth/me,
// and only its answer decides who is signed in. Never decide from the cookie's
// presence alone (it may have expired).

const SESSION_COOKIE = "WORKLY_SESSION";
const TIMEOUT_MS = 5_000;

// The signed-in member, or null when there is no valid session (401). Throws
// when the backend cannot answer (network, 5xx), so callers can tell "signed
// out" from "unknown". Cached per request: layout and page share one call.
export const getCurrentUser = cache(async (): Promise<ApiUser | null> => {
  const session = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!session) return null;

  // Read at request time (unlike the /api rewrite, which is fixed at build).
  const backendUrl = process.env.BACKEND_URL ?? "http://localhost:8080";
  const response = await fetch(`${backendUrl}/api/auth/me`, {
    // Only the session cookie, to a fixed backend URL.
    headers: { Accept: "application/json", Cookie: `${SESSION_COOKIE}=${session}` },
    cache: "no-store",
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Session check failed with HTTP ${response.status}`);
  return (await response.json()) as ApiUser;
});

// For the login and register pages: a signed-in member goes to the feed. If
// the backend cannot answer, the page is shown as usual (never block signing in).
export async function redirectSignedInToFeed(locale: Locale) {
  const user = await getCurrentUser().catch(() => null);
  if (user) redirect({ href: "/feed", locale });
}
