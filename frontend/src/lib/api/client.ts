// Browser client for the Workly API (same origin: /api is proxied to Spring
// Boot, see next.config.ts). The session cookie is HttpOnly and travels on its
// own; state-changing requests echo the XSRF-TOKEN cookie as X-XSRF-TOKEN.

const CSRF_COOKIE = "XSRF-TOKEN";
const CSRF_HEADER = "X-XSRF-TOKEN";
const TIMEOUT_MS = 15_000;

export type ApiFieldError = { field: string; code: string };

// A failed request. `code` is the API's machine-readable code (VALIDATION_FAILED,
// RATE_LIMITED, ...), NETWORK_ERROR when there was no response, or
// UNEXPECTED for a response without a code. Never show server text to users.
// retryAfterSeconds: from Retry-After (RATE_LIMITED), when the API sent it.
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly fieldErrors: ApiFieldError[] = [],
    readonly retryAfterSeconds?: number,
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

async function send(method: "GET" | "POST" | "DELETE", path: string, body?: unknown, csrfToken?: string) {
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
  // The API sends whole seconds; an HTTP date or anything else is ignored.
  const retryAfter = Number(response.headers.get("Retry-After"));
  const retryAfterSeconds = Number.isInteger(retryAfter) && retryAfter > 0 ? retryAfter : undefined;
  return new ApiError(response.status, code, fieldErrors, retryAfterSeconds);
}

// The body as JSON; 204, and 202 from register, have none.
async function readBody<T>(response: Response): Promise<T> {
  if (!response.ok) throw await toApiError(response);
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

// A state-changing request with the CSRF token. A rejected token (it rotates
// on sign-in) is refreshed and the request retried once.
async function sendWithCsrf<T>(method: "POST" | "DELETE", path: string, body?: unknown): Promise<T> {
  let response = await send(method, path, body, readCsrfToken() ?? (await fetchCsrfToken()));
  if (response.status === 403) {
    const error = await toApiError(response);
    if (error.code !== "CSRF_INVALID") throw error;
    response = await send(method, path, body, await fetchCsrfToken());
  }
  return readBody<T>(response);
}

// POSTs JSON with the CSRF token.
export function postJson<T>(path: string, body: unknown): Promise<T> {
  return sendWithCsrf<T>("POST", path, body);
}

// DELETE with the CSRF token.
export function deleteJson<T>(path: string): Promise<T> {
  return sendWithCsrf<T>("DELETE", path);
}

// GETs JSON (no CSRF token needed).
export async function getJson<T>(path: string): Promise<T> {
  return readBody<T>(await send("GET", path));
}
