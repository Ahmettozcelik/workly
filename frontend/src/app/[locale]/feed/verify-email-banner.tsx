"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { RateLimitedAlert } from "@/components/auth/rate-limited-alert";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { resendVerificationEmail } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

type Status = "idle" | "sending" | "sent" | "rateLimited" | "error";

// For members whose email is not verified yet: where the link went and a way
// to get a new one (limited per member by the API: 429 RATE_LIMITED).
export function VerifyEmailBanner({ email }: { email: string }) {
  const t = useTranslations("feed.verifyBanner");
  const tCommon = useTranslations("common");
  const [status, setStatus] = useState<Status>("idle");
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number>();

  async function handleResend() {
    if (status === "sending") return;
    setStatus("sending");
    try {
      await resendVerificationEmail();
      setStatus("sent");
    } catch (error) {
      if (error instanceof ApiError && error.code === "RATE_LIMITED") {
        setRetryAfterSeconds(error.retryAfterSeconds);
        setStatus("rateLimited");
      } else {
        setStatus("error");
      }
    }
  }

  return (
    <section aria-labelledby="verify-email-banner-heading">
      <Card padding="sm" className="space-y-3">
        <div className="space-y-1">
          <h2 id="verify-email-banner-heading" className="font-display text-base font-bold">
            {t("title")}
          </h2>
          <p className="break-words text-sm text-fg-muted">{t("body", { email })}</p>
        </div>

        {status === "sent" && (
          <Alert variant="success" title={t("sent.title")}>
            {t("sent.body")}
          </Alert>
        )}
        {status === "rateLimited" && <RateLimitedAlert retryAfterSeconds={retryAfterSeconds} />}
        {status === "error" && (
          <Alert variant="danger" title={tCommon("errorGeneric.title")}>
            {tCommon("errorGeneric.body")}
          </Alert>
        )}

        <Button variant="secondary" loading={status === "sending"} onClick={handleResend}>
          {status === "sending" ? t("resending") : t("resend")}
        </Button>
      </Card>
    </section>
  );
}
