"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PasswordInput } from "@/components/auth/password-input";
import { PASSWORD_MIN_LENGTH, validateNewPassword } from "@/components/auth/validation";
import { Alert } from "@/components/ui/alert";
import { Button, buttonClasses } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Link } from "@/i18n/navigation";
import { resetPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

// done: the password was changed and every session ended. invalid: the link
// is unknown, used or expired (one answer; a new one can be requested).
// error: network or server problem; the member can try again.
type Status = "editing" | "submitting" | "done" | "invalid" | "error";
// Message keys, translated at render: auth.resetPassword.password.*
type PasswordError = "errorEmpty" | "errorTooShort" | "errorTooLong";

const API_CODE_TO_KEY: Record<string, PasswordError> = {
  REQUIRED: "errorEmpty",
  TOO_SHORT: "errorTooShort",
  TOO_LONG: "errorTooLong",
};

export function ResetPasswordForm({ token }: { token: string }) {
  const t = useTranslations("auth.resetPassword");
  const tCommon = useTranslations("common");

  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<PasswordError>();
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<Status>(token ? "editing" : "invalid");
  const passwordRef = useRef<HTMLInputElement>(null);

  // The token stays in memory only: off the address bar and the history entry.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("token")) {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
  }, []);

  function showError(error: PasswordError | undefined) {
    setPasswordError(error);
    if (error) passwordRef.current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    setAttempted(true);
    const error = validateNewPassword(password);
    showError(error);
    if (error) {
      setStatus("editing");
      return;
    }

    setStatus("submitting");
    try {
      await resetPassword(token, password);
      setPassword("");
      setShowPassword(false);
      setStatus("done");
    } catch (error) {
      if (error instanceof ApiError) {
        const fieldError = error.fieldErrors.find(
          (each) => each.field === "password" && API_CODE_TO_KEY[each.code],
        );
        if (fieldError) {
          setStatus("editing");
          showError(API_CODE_TO_KEY[fieldError.code]);
          return;
        }
        // A malformed token (VALIDATION_FAILED on "token") is just an invalid link.
        if (error.code === "PASSWORD_RESET_TOKEN_INVALID" || error.code === "VALIDATION_FAILED") {
          setStatus("invalid");
          return;
        }
      }
      setStatus("error");
    }
  }

  const editing = status === "editing" || status === "submitting" || status === "error";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{t("title")}</h1>
        {editing && <p className="text-fg-muted">{t("subtitle")}</p>}
      </div>

      {status === "done" && (
        <>
          <Alert variant="success" title={t("success.title")}>
            {t("success.body")}
          </Alert>
          <Link href="/login" className={buttonClasses({ size: "lg", fullWidth: true })}>
            {t("toLogin")}
          </Link>
        </>
      )}

      {status === "invalid" && (
        <>
          <Alert variant="danger" title={t("invalid.title")}>
            {t("invalid.body")}
          </Alert>
          <Link
            href="/forgot-password"
            className="inline-flex min-h-11 items-center font-medium text-accent-text underline underline-offset-2"
          >
            {t("requestNew")}
          </Link>
        </>
      )}

      {editing && (
        <form noValidate onSubmit={handleSubmit} className="space-y-5">
          {status === "error" && (
            <Alert variant="danger" title={tCommon("errorGeneric.title")}>
              {tCommon("errorGeneric.body")}
            </Alert>
          )}

          <FormField
            label={t("password.label")}
            hint={t("password.hint", { min: PASSWORD_MIN_LENGTH })}
            error={passwordError ? t(`password.${passwordError}`, { min: PASSWORD_MIN_LENGTH }) : undefined}
            required
          >
            {(control) => (
              <PasswordInput
                ref={passwordRef}
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (attempted) setPasswordError(validateNewPassword(event.target.value));
                }}
                visible={showPassword}
                onVisibleChange={setShowPassword}
                {...control}
              />
            )}
          </FormField>

          <Button type="submit" size="lg" fullWidth loading={status === "submitting"}>
            {status === "submitting" ? t("submitting") : t("submit")}
          </Button>
        </form>
      )}
    </div>
  );
}
