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
import { Link, useRouter } from "@/i18n/navigation";
import { login } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

// Message keys, translated at render: common.email.* / auth.login.password.*
// No minimum length on sign-in: it would reveal the policy and block old passwords.
type FieldErrors = {
  email?: "errorEmpty" | "errorInvalid";
  password?: "errorEmpty";
};
// failure: wrong credentials (one generic message, so the response never
// reveals whether an account exists). error: network or server problem.
type Status = "editing" | "submitting" | "failure" | "error";

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
  const forgotNoteId = useId();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<Status>("editing");

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // After a failed attempt the password is cleared; continue there.
    if (status === "failure") passwordRef.current?.focus();
  }, [status]);

  const hasErrors = Boolean(errors.email || errors.password);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    const nextErrors = validate(email, password);
    setErrors(nextErrors);
    setAttempted(true);

    if (nextErrors.email) return emailRef.current?.focus();
    if (nextErrors.password) return passwordRef.current?.focus();

    setStatus("submitting");
    try {
      await login({ email: email.trim(), password });
      // Signed in: go to the feed in the current language. The button keeps
      // its loading state until the page changes.
      router.replace("/feed");
    } catch (error) {
      if (error instanceof ApiError && error.code === "INVALID_CREDENTIALS") {
        setPassword("");
        setShowPassword(false);
        setStatus("failure");
      } else {
        setStatus("error");
      }
    }
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
        {status === "error" && !hasErrors && (
          <Alert variant="danger" title={tCommon("errorGeneric.title")}>
            {tCommon("errorGeneric.body")}
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
