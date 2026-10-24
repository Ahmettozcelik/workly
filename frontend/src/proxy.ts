import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Skip Next.js internals, API routes and files with an extension
  // (static assets, favicon, optimised images).
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
