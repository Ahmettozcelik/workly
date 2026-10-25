import { useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";

// Too many attempts (429 RATE_LIMITED). The wait comes from Retry-After,
// rounded up to whole minutes; without it the message just says "later".
export function RateLimitedAlert({ retryAfterSeconds }: { retryAfterSeconds?: number }) {
  const t = useTranslations("common.errorRateLimited");
  const minutes = retryAfterSeconds ? Math.ceil(retryAfterSeconds / 60) : undefined;
  return (
    <Alert variant="danger" title={t("title")}>
      {minutes ? t("body", { minutes }) : t("bodySoon")}
    </Alert>
  );
}
