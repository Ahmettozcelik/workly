// Browser client for the Workly API (same origin: /api is proxied to Spring
// Boot, see next.config.ts). The session cookie is HttpOnly and travels on its
// own; state-changing requests echo the XSRF-TOKEN cookie as X-XSRF-TOKEN.

const CSRF_COOKIE = "XSRF-TOKEN";
const CSRF_HEADER = "X-XSRF-TOKEN";
const TIMEOUT_MS = 15_000;

export type ApiFieldError = { field: string; code: string };

// A failed request. `code` is the API's machine-readable code (EMAIL_TAKEN,
// VALIDATION_FAILED, ...), NETWORK_ERROR when there was no response, or
// UNEXPECTED for a response without a code. Never show server text to users.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly fieldErrors: ApiFieldError[] = [],
  ) {
    super(code);
    this.name = "ApiError";
  }
}

function readCsrfToken(): string | undefined {
  const prefix = `${CSRF_COOKIE}=`;
  const cookie = document.cookie.split("; ").find((each) => each.startsWith(prefix));
  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined;
}

async function send(method: "GET" | "POST", path: string, body?: unknown, csrfToken?: string) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (csrfToken) headers[CSRF_HEADER] = csrfToken;
  try {
    return await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    // Offline, DNS, aborted by the timeout, ...
    throw new ApiError(0, "NETWORK_ERROR");
  }
}

// Asks the API for a CSRF cookie and reads it back.
async function fetchCsrfToken() {
  const response = await send("GET", "/api/auth/csrf");
  if (!response.ok) throw await toApiError(response);
  return readCsrfToken();
}

async function toApiError(response: Response) {
  let code = "UNEXPECTED";
  let fieldErrors: ApiFieldError[] = [];
  try {
    const problem = await response.json();
    if (typeof problem?.code === "string") code = problem.code;
    if (Array.isArray(problem?.errors)) fieldErrors = problem.errors;
  } catch {
    // Not a problem-details body (e.g. a proxy error page).
  }
  return new ApiError(response.status, code, fieldErrors);
}

// POSTs JSON with the CSRF token. A rejected token (it rotates on sign-in) is
// refreshed and the request retried once.
export async function postJson<T>(path: string, body: unknown): Promise<T> {
  let response = await send("POST", path, body, readCsrfToken() ?? (await fetchCsrfToken()));
  if (response.status === 403) {
    const error = await toApiError(response);
    if (error.code !== "CSRF_INVALID") throw error;
    response = await send("POST", path, body, await fetchCsrfToken());
  }
  if (!response.ok) throw await toApiError(response);
  return (response.status === 204 ? undefined : await response.json()) as T;
}
