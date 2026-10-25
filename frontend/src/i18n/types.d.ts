import type messages from "../../messages/tr.json";
import type { routing } from "./routing";

// Typed locales and message keys: an unknown key fails type checking.
// Turkish is the reference language; message-parity.ts keeps en.json in sync.
declare module "next-intl" {
  interface AppConfig {
    Locale: (typeof routing.locales)[number];
    Messages: typeof messages;
  }
}
