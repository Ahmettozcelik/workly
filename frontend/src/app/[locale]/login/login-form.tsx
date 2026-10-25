"use client";

import { useTranslations } from "next-intl";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { PasswordInput } from "@/components/auth/password-input";
import { validateEmail } from "@/components/auth/validation";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Link } from "@/i18n/navigation";

// Prototype only: no API call, no session, no cookie or storage, no redirect.
// Any valid email and non-empty password "succeed" except the address below.
const SIMULATED_DELAY_MS = 1200;
// PROTOTYPE: simulates a failed sign-in. Remove with real authentication.
const DEMO_FAILURE_EMAIL = "fail@example.com";

// Message keys, translated at render: common.email.* / auth.login.password.*
// No minimum length on sign-in: it would reveal the policy and block old passwords.
type FieldErrors = {
  email?: "errorEmpty" | "errorInvalid";
  password?: "errorEmpty";
};
type Status = "editing" | "submitting" | "failure" | "success";

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;
  if (!password) errors.password = "errorEmpty";
  return errors;
}

export function LoginForm() {
  const t = useTranslations("auth.login");
  const tCommon = useTranslations("common");
  const tPrototype = useTranslations("prototype");
  const forgotNoteId = useId();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<Status>("editing");

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const focusEmailOnEdit = useRef(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  useEffect(() => {
    if (status === "success") successHeadingRef.current?.focus();
    // After a failed attempt the password is cleared; continue there.
    if (status === "failure") passwordRef.current?.focus();
    if (status === "editing" && focusEmailOnEdit.current) {
      focusEmailOnEdit.current = false;
      emailRef.current?.focus();
    }
  }, [status]);

  const hasErrors = Boolean(errors.email || errors.password);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    const nextErrors = validate(email, password);
    setErrors(nextErrors);
    setAttempted(true);

    if (nextErrors.email) return emailRef.current?.focus();
    if (nextErrors.password) return passwordRef.current?.focus();

    setStatus("submitting");
    timerRef.current = window.setTimeout(() => {
      // Same delay and the same generic message for every failure, so the
      // response never reveals whether an account exists.
      if (email.trim().toLowerCase() === DEMO_FAILURE_EMAIL) {
        setPassword("");
        setShowPassword(false);
        setStatus("failure");
      } else {
        setStatus("success");
      }
    }, SIMULATED_DELAY_MS);
  }

  function handleBack() {
    setPassword("");
    setShowPassword(false);
    setErrors({});
    setAttempted(false);
    focusEmailOnEdit.current = true;
    setStatus("editing");
  }

  if (status === "success") {
    return (
      <div className="space-y-6">
        <h1
          ref={successHeadingRef}
          tabIndex={-1}
          className="font-display text-3xl font-bold tracking-tight"
        >
          {t("success.title")}
        </h1>
        <Alert variant="success">{t("success.usedEmail", { email: email.trim() })}</Alert>
        <p className="border-t border-line pt-4 text-sm text-fg-muted">
          {tPrototype("loginNotice")}
        </p>
        <Button variant="secondary" size="lg" fullWidth onClick={handleBack}>
          {t("success.back")}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          {t("title")}
        </h1>
        <p className="text-fg-muted">{t("subtitle")}</p>
      </div>

      <form noValidate onSubmit={handleSubmit} className="space-y-5">
        {attempted && hasErrors && (
          <Alert variant="danger" title={tCommon("errorSummary.title")}>
            {tCommon("errorSummary.body")}
          </Alert>
        )}
        {status === "failure" && !hasErrors && (
          <Alert variant="danger" title={t("failure.title")}>
            {t("failure.body")}
          </Alert>
        )}

        <p className="text-sm text-fg-muted">
          <span aria-hidden="true" className="text-danger">
            *
          </span>{" "}
          {tCommon("requiredNote")}
        </p>

        <FormField
          label={tCommon("email.label")}
          error={errors.email ? tCommon(`email.${errors.email}`) : undefined}
          required
        >
          {(control) => (
            <Input
              ref={emailRef}
              type="email"
              name="email"
              autoComplete="username"
              inputMode="email"
              spellCheck={false}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (attempted) setErrors(validate(event.target.value, password));
              }}
              {...control}
            />
          )}
        </FormField>

        <FormField
          label={tCommon("password.label")}
          error={errors.password ? t(`password.${errors.password}`) : undefined}
          required
        >
          {(control) => (
            <PasswordInput
              ref={passwordRef}
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                if (attempted) setErrors(validate(email, event.target.value));
              }}
              visible={showPassword}
              onVisibleChange={setShowPassword}
              {...control}
            />
          )}
        </FormField>

        {/* PLACEHOLDER: password reset does not exist yet. Focusable but
            aria-disabled, so it stays discoverable while doing nothing. */}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            aria-disabled="true"
            aria-describedby={forgotNoteId}
            className="inline-flex min-h-11 cursor-not-allowed items-center text-sm font-medium text-fg-muted"
          >
            {t("forgotPassword")}
          </button>
          <Badge id={forgotNoteId}>{t("forgotPasswordSoon")}</Badge>
        </div>

        <Button type="submit" size="lg" fullWidth loading={status === "submitting"}>
          {status === "submitting" ? t("submitting") : t("submit")}
        </Button>
      </form>

      <p className="border-t border-line pt-5 text-center text-sm text-fg-muted">
        {t.rich("registerPrompt", {
          link: (chunks) => (
            <Link
              href="/register"
              className="font-medium text-accent-text underline underline-offset-2"
            >
              {chunks}
            </Link>
          ),
        })}
      </p>
    </div>
  );
}
