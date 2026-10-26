"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { listSessions, revokeOtherSessions, revokeSession, type ApiSession } from "@/lib/api/auth";

// loading: the first load (and after "try again"). error: the list could not be
// loaded. Actions report through `notice`, the list stays.
type ListState = { status: "loading" } | { status: "error" } | { status: "loaded"; sessions: ApiSession[] };
type Notice = "revoked" | "othersRevoked" | "actionFailed" | null;

// The member's sessions, loaded in the browser: this device first, then the
// most recently active. Other sessions can be signed out one by one or all at
// once. Times are shown in the browser's time zone.
export function ActiveSessions({ reloadKey }: { reloadKey: number }) {
  const t = useTranslations("settingsSecurity.sessions");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const [state, setState] = useState<ListState>({ status: "loading" });
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState<string | null>(null);
  // Bumped to load the list again (after an action, or "try again").
  const [loads, setLoads] = useState(0);
  const reload = () => setLoads((count) => count + 1);

  useEffect(() => {
    let current = true;
    listSessions().then(
      (sessions) => current && setState({ status: "loaded", sessions }),
      () => current && setState({ status: "error" }),
    );
    // A later load (or leaving the page) wins over this one.
    return () => {
      current = false;
    };
  }, [reloadKey, loads]);

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

  async function run(key: string, action: () => Promise<void>, done: Notice) {
    if (busy) return;
    setBusy(key);
    try {
      await action();
      setNotice(done);
      reload();
    } catch {
      setNotice("actionFailed");
    } finally {
      setBusy(null);
    }
  }

  const others = state.status === "loaded" ? state.sessions.filter((session) => !session.current) : [];

  return (
    <section aria-labelledby="active-sessions-heading">
      <Card className="space-y-4">
        <div className="space-y-1">
          <h2 id="active-sessions-heading" className="font-display text-lg font-bold">
            {t("heading")}
          </h2>
          <p className="text-sm text-fg-muted">{t("description")}</p>
        </div>

        {notice === "revoked" && <Alert variant="success">{t("revoked")}</Alert>}
        {notice === "othersRevoked" && <Alert variant="success">{t("othersRevoked")}</Alert>}
        {notice === "actionFailed" && (
          <Alert variant="danger" title={tCommon("errorGeneric.title")}>
            {tCommon("errorGeneric.body")}
          </Alert>
        )}

        {state.status === "loading" && (
          <p role="status" className="text-sm text-fg-muted">
            {t("loading")}
          </p>
        )}

        {state.status === "error" && (
          <div className="space-y-3">
            <Alert variant="danger" title={tCommon("errorGeneric.title")}>
              {tCommon("errorGeneric.body")}
            </Alert>
            <Button
              variant="secondary"
              onClick={() => {
                setState({ status: "loading" });
                reload();
              }}
            >
              {t("retry")}
            </Button>
          </div>
        )}

        {state.status === "loaded" && (
          <>
            <ul className="divide-y divide-line">
              {state.sessions.map((session) => {
                const device = session.device ?? t("unknownDevice");
                return (
                  <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0 space-y-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium">
                        {device}
                        {session.current && <Badge variant="success">{t("current")}</Badge>}
                      </p>
                      <p className="text-sm text-fg-muted">{t("signedIn", { date: formatDate(session.createdAt) })}</p>
                      <p className="text-sm text-fg-muted">
                        {t("lastActive", { date: formatDate(session.lastActiveAt) })}
                      </p>
                    </div>
                    {!session.current && (
                      <Button
                        variant="secondary"
                        loading={busy === session.id}
                        onClick={() => run(session.id, () => revokeSession(session.id), "revoked")}
                      >
                        {t("revoke")}
                        {/* The accessible name starts with the visible text (WCAG 2.5.3). */}
                        <span className="sr-only"> ({device})</span>
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
            {others.length > 0 ? (
              <Button
                variant="secondary"
                loading={busy === "others"}
                onClick={() => run("others", revokeOtherSessions, "othersRevoked")}
              >
                {t("revokeOthers")}
              </Button>
            ) : (
              <p className="text-sm text-fg-muted">{t("onlyThis")}</p>
            )}
          </>
        )}
      </Card>
    </section>
  );
}
