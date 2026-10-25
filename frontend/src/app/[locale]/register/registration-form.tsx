"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRef, useState, type FormEvent } from "react";
import { PasswordInput } from "@/components/auth/password-input";
import { RateLimitedAlert } from "@/components/auth/rate-limited-alert";
import {
  DISPLAY_NAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  validateDisplayName,
  validateEmail,
  validateNewPassword,
} from "@/components/auth/validation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { Input } from "@/components/ui/input";
import { Link, useRouter } from "@/i18n/navigation";
import { register } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

// Message keys, translated at render: auth.register.name.* / common.email.* /
// auth.register.email.errorTaken / auth.register.password.*
type FieldErrors = {
  displayName?: "errorEmpty" | "errorTooLong";
  email?: "errorEmpty" | "errorInvalid" | "errorTaken";
  password?: "errorEmpty" | "errorTooShort" | "errorTooLong";
};
type Field = keyof FieldErrors;
type Status = "editing" | "submitting";

function validate(displayName: string, email: string, password: string): FieldErrors {
  const errors: FieldErrors = {};
  const nameError = validateDisplayName(displayName);
  if (nameError) errors.displayName = nameError;
  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;
  const passwordError = validateNewPassword(password);
  if (passwordError) errors.password = passwordError;
  return errors;
}

// API field codes (VALIDATION_FAILED) as this form's message keys.
const API_CODE_TO_KEY: Record<string, string> = {
  REQUIRED: "errorEmpty",
  INVALID_EMAIL: "errorInvalid",
  TOO_SHORT: "errorTooShort",
  TOO_LONG: "errorTooLong",
};

function fromApiErrors(error: ApiError): FieldErrors {
  const errors: Record<string, string> = {};
  for (const { field, code } of error.fieldErrors) {
    const key = API_CODE_TO_KEY[code];
    if (key && (field === "displayName" || field === "email" || field === "password")) errors[field] = key;
  }
  return errors as FieldErrors;
}

export function RegistrationForm() {
  const t = useTranslations("auth.register");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<Status>("editing");
  // Request failed for a reason the user cannot fix in a field (network, server).
  const [failed, setFailed] = useState(false);
  // Too many registrations from this address (429); the wait in seconds, if known.
  const [rateLimited, setRateLimited] = useState<{ retryAfterSeconds?: number } | null>(null);

  const refs = {
    displayName: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
  };

  const hasErrors = Boolean(errors.displayName || errors.email || errors.password);

  // Shows the errors and focuses the first invalid field, in form order.
  function showErrors(next: FieldErrors) {
    setErrors(next);
    const first = (["displayName", "email", "password"] as Field[]).find((field) => next[field]);
    if (first) refs[first].current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    setAttempted(true);
    setFailed(false);
    setRateLimited(null);
    const nextErrors = validate(displayName, email, password);
    showErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setStatus("submitting");
    try {
      await register({ displayName: displayName.trim(), email: email.trim(), password, locale });
      // Signed in: go to the feed in the current language. The button keeps
      // its loading state until the page changes.
      router.replace("/feed");
    } catch (error) {
      setStatus("editing");
      if (error instanceof ApiError && error.code === "EMAIL_TAKEN") {
        showErrors({ email: "errorTaken" });
        return;
      }
      if (error instanceof ApiError && error.code === "RATE_LIMITED") {
        setRateLimited({ retryAfterSeconds: error.retryAfterSeconds });
        return;
      }
      const apiErrors = error instanceof ApiError ? fromApiErrors(error) : {};
      if (Object.keys(apiErrors).length > 0) {
        showErrors(apiErrors);
        return;
      }
      setFailed(true);
    }
  }

  // After a failed submit, errors follow the input live.
  function revalidate(next: { displayName?: string; email?: string; password?: string }) {
    if (!attempted) return;
    setErrors(
      validate(next.displayName ?? displayName, next.email ?? email, next.password ?? password),
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
        {rateLimited && !hasErrors && <RateLimitedAlert retryAfterSeconds={rateLimited.retryAfterSeconds} />}
        {failed && !hasErrors && (
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
          label={t("name.label")}
          error={
            errors.displayName
              ? t(`name.${errors.displayName}`, { max: DISPLAY_NAME_MAX_LENGTH })
              : undefined
          }
          required
        >
          {(control) => (
            <Input
              ref={refs.displayName}
              name="displayName"
              autoComplete="name"
              value={displayName}
              onChange={(event) => {
                setDisplayName(event.target.value);
                revalidate({ displayName: event.target.value });
              }}
              {...control}
            />
          )}
        </FormField>

        <FormField
          label={tCommon("email.label")}
          hint={t("email.hint")}
          error={
            errors.email === "errorTaken"
              ? t("email.errorTaken")
              : errors.email
                ? tCommon(`email.${errors.email}`)
                : undefined
          }
          required
        >
          {(control) => (
            <Input
              ref={refs.email}
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              spellCheck={false}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                revalidate({ email: event.target.value });
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
            <PasswordInput
              ref={refs.password}
              name="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                revalidate({ password: event.target.value });
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

      <p className="border-t border-line pt-5 text-center text-sm text-fg-muted">
        {t.rich("signInPrompt", {
          link: (chunks) => (
            <Link
              href="/login"
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
