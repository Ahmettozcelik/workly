import { useLocale, useTranslations } from "next-intl";
import { LogoutButton } from "@/components/auth/logout-button";
import { VerifiedIcon } from "@/components/app/icons";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import type { ApiUser } from "@/lib/api/auth";

// The signed-in member as the backend knows them: name, email and whether the
// email is verified, plus sign-out. Profile numbers (connections, views,
// completion) return with a profile API; showing sample ones would mislead.
export function ProfileSummary({ user }: { user: ApiUser }) {
  const t = useTranslations("feed.profile");
  const locale = useLocale();

  return (
    <section aria-labelledby="profile-summary-heading">
      <Card padding="sm" className="flex flex-col gap-3 md:gap-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.displayName} locale={locale} size="lg" decorative />
          <div className="min-w-0">
            <h2 id="profile-summary-heading" className="font-display text-lg font-bold leading-tight">
              {user.displayName}
            </h2>
            <p className="break-all text-sm text-fg-muted">{user.email}</p>
          </div>
        </div>

        {user.emailVerified && (
          <Badge variant="success" className="self-start">
            <VerifiedIcon className="size-4" />
            {t("verified")}
          </Badge>
        )}

        <Link
          href="/settings/security"
          className="inline-flex min-h-11 items-center text-sm font-medium text-accent-text underline underline-offset-2"
        >
          {t("security")}
        </Link>

        <LogoutButton />
      </Card>
    </section>
  );
}
