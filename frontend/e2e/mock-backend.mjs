// Test-only stand-in for the Spring Boot API, started by playwright.config.ts.
// Next.js calls it server-side (the session check in src/lib/auth/server.ts)
// and the browser reaches it through the /api rewrite. The real API is covered
// by the backend's integration tests; this only answers what the UI needs.
//
// Who is signed in is encoded in the WORKLY_SESSION cookie value (see
// e2e/support.ts): "valid-tr" / "valid-en" (unverified member), "verified",
// "backend-error" (/me answers 500), "logout-error" (logout answers 500).
// Anything else, or no cookie, is an expired / missing session (401).
import { createServer } from "node:http";

const PORT = Number(process.env.MOCK_BACKEND_PORT ?? 3101);
const CSRF_TOKEN = "mock-csrf-token";

const member = (locale, emailVerified = false) => ({
  id: "6f1c1e0a-1111-4c9b-9f1a-000000000001",
  email: "deniz.arslan@example.com",
  displayName: "Deniz Arslan",
  locale,
  emailVerified,
});

const SESSIONS = {
  "valid-tr": member("tr"),
  "valid-en": member("en"),
  "logout-error": member("tr"),
  verified: member("tr", true),
};

function cookiesOf(request) {
  return Object.fromEntries(
    (request.headers.cookie ?? "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([name]) => name)
      .map(([name, ...value]) => [name, value.join("=")]),
  );
}

function send(response, status, body, headers = {}) {
  const json = body === undefined ? undefined : JSON.stringify(body);
  response.writeHead(status, {
    ...(json ? { "Content-Type": status >= 400 ? "application/problem+json" : "application/json" } : {}),
    ...headers,
  });
  response.end(json);
}

const problem = (status, code) => ({ type: "about:blank", title: "Error", status, code });

createServer((request, response) => {
  const { pathname } = new URL(request.url, "http://localhost");
  const cookies = cookiesOf(request);
  const session = cookies.WORKLY_SESSION;

  if (request.method === "GET" && pathname === "/health") return send(response, 200, { status: "UP" });

  if (request.method === "GET" && pathname === "/api/auth/csrf") {
    return send(response, 204, undefined, { "Set-Cookie": `XSRF-TOKEN=${CSRF_TOKEN}; Path=/` });
  }

  if (request.method === "GET" && pathname === "/api/auth/me") {
    if (session === "backend-error") return send(response, 500, problem(500, "INTERNAL_ERROR"));
    const user = SESSIONS[session];
    return user ? send(response, 200, user) : send(response, 401, problem(401, "UNAUTHENTICATED"));
  }

  if (request.method === "POST" && pathname === "/api/auth/logout") {
    // Same CSRF rule as the backend: the header must echo the cookie.
    if (!cookies["XSRF-TOKEN"] || request.headers["x-xsrf-token"] !== cookies["XSRF-TOKEN"]) {
      return send(response, 403, problem(403, "CSRF_INVALID"));
    }
    if (session === "logout-error") return send(response, 500, problem(500, "INTERNAL_ERROR"));
    return send(response, 204, undefined, {
      "Set-Cookie": "WORKLY_SESSION=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax",
    });
  }

  return send(response, 404, problem(404, "NOT_FOUND"));
}).listen(PORT, () => console.log(`mock backend on http://localhost:${PORT}`));
