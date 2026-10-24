"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";

// Prototype only: no API call, no account, no email. Validation rules here are
// placeholders, not the final security policy.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_MIN_LENGTH = 8;
const SIMULATED_DELAY_MS = 1200;

// Message keys, translated at render: common.email.* / auth.register.password.*
type FieldErrors = {
  email?: "errorEmpty" | "errorInvalid";
  password?: "errorEmpty" | "errorTooShort";
};
type Status = "editing" | "submitting" | "success";

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  const trimmed = email.trim();
  if (!trimmed) errors.email = "errorEmpty";
  else if (!EMAIL_PATTERN.test(trimmed)) errors.email = "errorInvalid";
  if (!password) errors.password = "errorEmpty";
  else if (password.length < PASSWORD_MIN_LENGTH) {
    errors.password = "errorTooShort";
  }
  return errors;
}

export function RegistrationForm() {
  const t = useTranslations("auth.register");
  const tCommon = useTranslations("common");
  const tPrototype = useTranslations("prototype");

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
    timerRef.current = window.setTimeout(() => setStatus("success"), SIMULATED_DELAY_MS);
  }

  function handleUseDifferentEmail() {
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
        <Alert variant="success">{t("success.sentTo", { email: email.trim() })}</Alert>
        <p className="text-fg-muted">{t("success.nextSteps")}</p>
        <p className="border-t border-line pt-4 text-sm text-fg-muted">
          {tPrototype("registerNotice")}
        </p>
        <Button variant="secondary" size="lg" fullWidth onClick={handleUseDifferentEmail}>
          {t("success.useDifferentEmail")}
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

        <p className="text-sm text-fg-muted">
          <span aria-hidden="true" className="text-danger">
            *
          </span>{" "}
          {tCommon("requiredNote")}
        </p>

        <FormField
          label={tCommon("email.label")}
          hint={t("email.hint")}
          error={errors.email ? tCommon(`email.${errors.email}`) : undefined}
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
                if (attempted) setErrors(validate(event.target.value, password));
              }}
              {...control}
            />
          )}
        </FormField>

        <FormField
          label={tCommon("password.label")}
          hint={t("password.hint", { min: PASSWORD_MIN_LENGTH })}
          error={
            errors.password
              ? t(`password.${errors.password}`, { min: PASSWORD_MIN_LENGTH })
              : undefined
          }
          required
        >
          {(control) => (
            <div className="relative">
              <Input
                ref={passwordRef}
                type={showPassword ? "text" : "password"}
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  if (attempted) setErrors(validate(email, event.target.value));
                }}
                className="pe-14"
                {...control}
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-pressed={showPassword}
                aria-controls={control.id}
                aria-label={tCommon("password.show")}
                title={tCommon("password.show")}
                className="absolute end-0.5 top-1/2 inline-flex size-11 -translate-y-1/2 items-center justify-center rounded-control text-fg-muted transition-colors hover:text-fg"
              >
                <EyeIcon crossed={showPassword} />
              </button>
            </div>
          )}
        </FormField>

        <Button type="submit" size="lg" fullWidth loading={status === "submitting"}>
          {status === "submitting" ? t("submitting") : t("submit")}
        </Button>

        {/* PLACEHOLDER: wording and documents need legal review (incl. KVKK)
            before launch. The linked documents do not exist yet. */}
        <p className="text-sm text-fg-muted">
          {t.rich("legal", {
            terms: (chunks) => (
              <a
                href="#kullanim-kosullari"
                className="font-medium text-accent-text underline underline-offset-2"
              >
                {chunks}
              </a>
            ),
            privacy: (chunks) => (
              <a
                href="#aydinlatma-metni"
                className="font-medium text-accent-text underline underline-offset-2"
              >
                {chunks}
              </a>
            ),
          })}
        </p>
      </form>

      {/* Plain text until the sign-in screen exists. */}
      <p className="border-t border-line pt-5 text-center text-sm text-fg-muted">
        {t("signInPrompt")}
      </p>
    </div>
  );
}

function EyeIcon({ crossed }: { crossed: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="M4 4l16 16" />}
    </svg>
  );
}
