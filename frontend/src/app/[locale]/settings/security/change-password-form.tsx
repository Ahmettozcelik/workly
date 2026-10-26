"use client";

import { useTranslations } from "next-intl";
import { useRef, useState, type FormEvent } from "react";
import { PasswordInput } from "@/components/auth/password-input";
import { RateLimitedAlert } from "@/components/auth/rate-limited-alert";
import { PASSWORD_MIN_LENGTH, validateNewPassword } from "@/components/auth/validation";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormField } from "@/components/ui/form-field";
import { changePassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

// Message keys, translated at render: settingsSecurity.changePassword.current.* / .next.*
type FieldErrors = {
  current?: "errorEmpty" | "errorIncorrect";
  next?: "errorEmpty" | "errorTooShort" | "errorTooLong" | "errorSame";
};
// done: changed; the other sessions ended, this one continues.
// rateLimited: too many wrong current passwords (429, like sign-in).
type Status = "editing" | "submitting" | "done" | "rateLimited" | "error";

function validate(current: string, next: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!current) errors.current = "errorEmpty";
  const nextError = validateNewPassword(next);
  if (nextError) errors.next = nextError;
  return errors;
}

// API field errors (VALIDATION_FAILED) as this form's message keys.
function fromApiErrors(error: ApiError): FieldErrors {
  const errors: FieldErrors = {};
  for (const { field, code } of error.fieldErrors) {
    if (field === "currentPassword") {
      if (code === "INCORRECT") errors.current = "errorIncorrect";
      else if (code === "REQUIRED") errors.current = "errorEmpty";
    }
    if (field === "newPassword") {
      const key = ({ REQUIRED: "errorEmpty", TOO_SHORT: "errorTooShort", TOO_LONG: "errorTooLong", SAME_AS_CURRENT: "errorSame" } as const)[
        code as "REQUIRED" | "TOO_SHORT" | "TOO_LONG" | "SAME_AS_CURRENT"
      ];
      if (key) errors.next = key;
    }
  }
  return errors;
}

export function ChangePasswordForm({ onChanged }: { onChanged: () => void }) {
  const t = useTranslations("settingsSecurity.changePassword");
  const tCommon = useTranslations("common");

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [attempted, setAttempted] = useState(false);
  const [status, setStatus] = useState<Status>("editing");
  const [retryAfterSeconds, setRetryAfterSeconds] = useState<number>();
  const refs = { current: useRef<HTMLInputElement>(null), next: useRef<HTMLInputElement>(null) };

  // Shows the errors and focuses the first invalid field, in form order.
  function showErrors(nextErrors: FieldErrors) {
    setErrors(nextErrors);
    if (nextErrors.current) refs.current.current?.focus();
    else if (nextErrors.next) refs.next.current?.focus();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "submitting") return;

    setAttempted(true);
    const nextErrors = validate(current, next);
    showErrors(nextErrors);
    if (nextErrors.current || nextErrors.next) {
      setStatus("editing");
      return;
    }

    setStatus("submitting");
    try {
      await changePassword(current, next);
      setCurrent("");
      setNext("");
      setShowCurrent(false);
      setShowNext(false);
      setAttempted(false);
      setStatus("done");
      onChanged();
    } catch (error) {
      if (error instanceof ApiError && error.code === "RATE_LIMITED") {
        setRetryAfterSeconds(error.retryAfterSeconds);
        setStatus("rateLimited");
        return;
      }
      const apiErrors = error instanceof ApiError ? fromApiErrors(error) : {};
      if (apiErrors.current || apiErrors.next) {
        setStatus("editing");
        // A wrong current password is cleared, like a failed sign-in.
        if (apiErrors.current === "errorIncorrect") setCurrent("");
        showErrors(apiErrors);
        return;
      }
      setStatus("error");
    }
  }

  // After a failed submit, errors follow the input live (server-only ones clear on edit).
  function revalidate(nextCurrent: string, nextNew: string) {
    if (attempted) setErrors(validate(nextCurrent, nextNew));
  }

  return (
    <section aria-labelledby="change-password-heading">
      <Card className="space-y-5">
        <h2 id="change-password-heading" className="font-display text-lg font-bold">
          {t("heading")}
        </h2>

        <form noValidate onSubmit={handleSubmit} className="space-y-5">
          {status === "done" && (
            <Alert variant="success" title={t("success.title")}>
              {t("success.body")}
            </Alert>
          )}
          {status === "rateLimited" && <RateLimitedAlert retryAfterSeconds={retryAfterSeconds} />}
          {status === "error" && (
            <Alert variant="danger" title={tCommon("errorGeneric.title")}>
              {tCommon("errorGeneric.body")}
            </Alert>
          )}

          <FormField
            label={t("current.label")}
            error={errors.current ? t(`current.${errors.current}`) : undefined}
            required
          >
            {(control) => (
              <PasswordInput
                ref={refs.current}
                name="currentPassword"
                autoComplete="current-password"
                value={current}
                onChange={(event) => {
                  setCurrent(event.target.value);
                  revalidate(event.target.value, next);
                }}
                visible={showCurrent}
                onVisibleChange={setShowCurrent}
                {...control}
              />
            )}
          </FormField>

          <FormField
            label={t("next.label")}
            hint={t("next.hint", { min: PASSWORD_MIN_LENGTH })}
            error={errors.next ? t(`next.${errors.next}`, { min: PASSWORD_MIN_LENGTH }) : undefined}
            required
          >
            {(control) => (
              <PasswordInput
                ref={refs.next}
                name="newPassword"
                autoComplete="new-password"
                value={next}
                onChange={(event) => {
                  setNext(event.target.value);
                  revalidate(current, event.target.value);
                }}
                visible={showNext}
                onVisibleChange={setShowNext}
                {...control}
              />
            )}
          </FormField>

          <Button type="submit" loading={status === "submitting"}>
            {status === "submitting" ? t("submitting") : t("submit")}
          </Button>
        </form>
      </Card>
    </section>
  );
}
