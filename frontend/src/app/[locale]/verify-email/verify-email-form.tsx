"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { verifyEmail } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

// ready: waiting for the member's click. verified: done. invalid: the link is
// unknown, used or expired (one answer; a new one is sent from the feed).
// error: network or server problem; the member can try again.
type Status = "ready" | "submitting" | "verified" | "invalid" | "error";

export function VerifyEmailForm({ token, signedIn }: { token: string; signedIn: boolean }) {
  const t = useTranslations("auth.verifyEmail");
  const tCommon = useTranslations("common");
  const [status, setStatus] = useState<Status>(token ? "ready" : "invalid");

  async function handleConfirm() {
    if (status === "submitting") return;
    setStatus("submitting");
    try {
      await verifyEmail(token);
      setStatus("verified");
    } catch (error) {
      const invalid =
        error instanceof ApiError &&
        (error.code === "VERIFICATION_TOKEN_INVALID" || error.code === "VALIDATION_FAILED");
      setStatus(invalid ? "invalid" : "error");
    }
  }

  // Where to continue: the feed when signed in (it offers a new link), sign-in otherwise.
  const next = signedIn
    ? { href: "/feed", label: t("toFeed") }
    : { href: "/login", label: t("toLogin") };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
        {status !== "verified" && status !== "invalid" && <p className="text-fg-muted">{t("subtitle")}</p>}
      </div>

      {status === "verified" && (
        <Alert variant="success" title={t("success.title")}>
          {t("success.body")}
        </Alert>
      )}
      {status === "invalid" && (
        <Alert variant="danger" title={t("invalid.title")}>
          {t(signedIn ? "invalid.bodySignedIn" : "invalid.bodySignedOut")}
        </Alert>
      )}
      {status === "error" && (
        <Alert variant="danger" title={tCommon("errorGeneric.title")}>
          {tCommon("errorGeneric.body")}
        </Alert>
      )}

      {status === "verified" || status === "invalid" ? (
        <Link
          href={next.href}
          className="inline-flex min-h-11 items-center font-medium text-accent-text underline underline-offset-2"
        >
          {next.label}
        </Link>
      ) : (
        <Button size="lg" fullWidth loading={status === "submitting"} onClick={handleConfirm}>
          {status === "submitting" ? t("confirming") : t("confirm")}
        </Button>
      )}
    </div>
  );
}
