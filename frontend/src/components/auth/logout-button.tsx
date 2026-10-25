"use client";

import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { getPathname } from "@/i18n/navigation";
import { postJson } from "@/lib/api/client";

// Ends the session on the server (POST /api/auth/logout with the CSRF token;
// the backend deletes the session and expires the cookie), then loads the
// login page in full, so no signed-in page stays in the client router cache.
// On failure the member stays signed in and sees an error.
export function LogoutButton() {
  const t = useTranslations("auth.logout");
  const locale = useLocale();
  const [status, setStatus] = useState<"idle" | "submitting" | "error">("idle");

  async function handleClick() {
    if (status === "submitting") return;
    setStatus("submitting");
    try {
      await postJson<void>("/api/auth/logout", {});
      window.location.replace(getPathname({ href: "/login", locale }));
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="space-y-2">
      <Button variant="secondary" fullWidth loading={status === "submitting"} onClick={handleClick}>
        {status === "submitting" ? t("submitting") : t("submit")}
      </Button>
      {status === "error" && (
        <p role="alert" className="text-sm font-medium text-danger">
          {t("error")}
        </p>
      )}
    </div>
  );
}
