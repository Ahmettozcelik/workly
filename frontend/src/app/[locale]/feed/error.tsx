"use client";

import { useTranslations } from "next-intl";
import { Logo } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";

// Shown when the feed cannot be rendered, e.g. the session check could not
// reach the backend. Not a redirect to login: the member may still be signed
// in. retry() re-runs the server render (and the session check).
export default function FeedError({ retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("feed.error");

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <div className="w-full max-w-md space-y-6 text-center">
        <Logo />
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-fg-muted">{t("body")}</p>
        </div>
        <Button size="lg" onClick={() => retry()}>
          {t("retry")}
        </Button>
      </div>
    </main>
  );
}
