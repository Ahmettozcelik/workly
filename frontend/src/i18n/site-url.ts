// Resolves SITE_URL, the public origin used for canonical and hreflang URLs.
// Only a bare http(s) origin is accepted (e.g. https://example.com). Errors
// never echo the value, which could contain credentials.
// Only local development may fall back to localhost; production requires it.
export function resolveSiteUrl(
  value: string | undefined,
  nodeEnv: string | undefined,
): URL {
  if (!value) {
    if (nodeEnv === "production") {
      throw new Error(
        "SITE_URL is not set. Set it to the public origin (e.g. https://example.com) for production builds.",
      );
    }
    return new URL("http://localhost:3000");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(
      "SITE_URL is not a valid URL. Use a bare origin such as https://example.com.",
    );
  }

  const isBareOrigin =
    (url.protocol === "https:" || url.protocol === "http:") &&
    url.username === "" &&
    url.password === "" &&
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === "";
  if (!isBareOrigin) {
    throw new Error(
      "SITE_URL must be a bare http(s) origin such as https://example.com (no credentials, path, query or fragment).",
    );
  }
  return new URL(url.origin);
}
