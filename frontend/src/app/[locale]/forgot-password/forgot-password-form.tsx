"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { RateLimitedAlert } from "@/components/auth/rate-limited-alert";
import { validateEmail } from "@/components/auth/validation";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";
import { requestPasswordReset } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

// sent: the API accepted the request. It answers the same whether or not the
// email has an account, so the page says "if" and cannot tell either.
// rateLimited: too many requests from this address (429). error: network or server.
type Status = "editing" | "submitting" | "sent" | "rateLimited" | "error";
// Message keys, translated at render: common.email.*
type EmailError = "errorEmpty" | "errorInvalid";

const API_CODE_TO_KEY: Record<string, EmailError> = {
  REQUIRED: "errorEmpty",
  INVALID_EMAIL: "errorInvalid",
  TOO_LONG: "errorInvalid",
};

export function ForgotPasswordForm() {
  const t = useTranslations("auth.forgotPassword");
  const tCommon = useTranslations("common");

  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<EmailError>();
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<Status>("editing");
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number>();
  const emailRef = useRef<HTMLInputElement>(null);
  const sentHeading = useRef<HTMLHeadingElement>(null);

  // The form is replaced: move focus to the new heading so it is announced.
  useEffect(() => {
    if (status === "sent") sentHeading.current?.focus();
  }, [status]);

  function showError(error: EmailError | undefined) {
    setEmailError(error);
    if (error) emailRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    setAttempted(true);
    const error = validateEmail(email);
    showError(error);
    if (error) {
      setStatus("editing");
      return;
    }

    setStatus("submitting");
    try {
      await requestPasswordReset(email.trim());
      setStatus("sent");
    } catch (error) {
      if (error instanceof ApiError && error.code === "RATE_LIMITED") {
        setRetryAfterSeconds(error.retryAfterSeconds);
        setStatus("rateLimited");
        return;
      }
      const fieldError =
        error instanceof ApiError
          ? error.fieldErrors.find((each) => each.field === "email" && API_CODE_TO_KEY[each.code])
          : undefined;
      if (fieldError) {
        setStatus("editing");
        showError(API_CODE_TO_KEY[fieldError.code]);
        return;
      }
      setStatus("error");
    }
  }

  if (status === "sent") {
    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <h1
            ref={sentHeading}
            tabIndex={-1}
            className="font-display text-3xl font-bold tracking-tight outline-none sm:text-4xl"
          >
            {t("sent.title")}
          </h1>
          <p className="break-words text-fg-muted">
            {t.rich("sent.body", {
              email: email.trim(),
              strong: (chunks) => <strong className="font-semibold text-fg">{chunks}</strong>,
            })}
          </p>
        </div>
        <p className="text-sm text-fg-muted">{t("sent.spam")}</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link href="/login" className={buttonClasses({ size: "lg", className: "sm:flex-1" })}>
            {t("sent.toLogin")}
          </Link>
          <Button
            variant="secondary"
            size="lg"
            className="sm:flex-1"
            onClick={() => {
              setAttempted(false);
              setStatus("editing");
            }}
          >
            {t("sent.useAnotherEmail")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
        <p className="text-fg-muted">{t("subtitle")}</p>
      </div>

      <form noValidate onSubmit={handleSubmit} className="space-y-5">
        {status === "rateLimited" && <RateLimitedAlert retryAfterSeconds={retryAfterSeconds} />}
        {status === "error" && (
          <Alert variant="danger" title={tCommon("errorGeneric.title")}>
            {tCommon("errorGeneric.body")}
          </Alert>
        )}

        <FormField
          label={tCommon("email.label")}
          error={emailError ? tCommon(`email.${emailError}`) : undefined}
          required
        >
          {(control) => (
            <Input
              ref={emailRef}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (attempted) setEmailError(validateEmail(event.target.value));
              }}
              {...control}
            />
          )}
        </FormField>

        <Button type="submit" size="lg" fullWidth loading={status === "submitting"}>
          {status === "submitting" ? t("submitting") : t("submit")}
        </Button>
      </form>

      <p className="border-t border-line pt-5 text-center text-sm text-fg-muted">
        {t.rich("signInPrompt", {
          link: (chunks) => (
            <Link href="/login" className="font-medium text-accent-text underline underline-offset-2">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
