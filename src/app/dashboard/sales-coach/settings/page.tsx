"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, User, BookOpen, CheckCircle2, Hourglass } from "lucide-react";
import TopBar from "@/components/layout/TopBar";

/**
 * Sales Coach → Settings (Phase 4). Role-aware: every staff/admin gets
 * the Account tab; admins also get the Coaching tab (product config).
 * §A10 — your own account + config, shown to you. §3.4 — real state +
 * honest "coming", no fake toggles.
 */

type SettingsCtx = {
  account: {
    fullName: string | null;
    companyRole: string | null;
    salesCoachRole: string | null;
  };
  isManager: boolean;
  corpus: { loaded: boolean; words: number };
};

export default function SalesCoachSettingsPage() {
  const [ctx, setCtx] = useState<SettingsCtx | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"account" | "coaching">("account");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/coach/sales-session/settings").catch(
        () => null
      );
      if (res && res.ok) setCtx(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isManager = ctx?.isManager ?? false;

  return (
    <>
      <TopBar title="Settings" subtitle="Sales Coach" />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-3xl mx-auto w-full">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : (
          <>
            {/* Tabs — Coaching only shown to managers */}
            <div className="flex items-center gap-2 mb-4 border-b border-default">
              <TabButton
                active={tab === "account"}
                onClick={() => setTab("account")}
                icon={User}
                label="Account"
              />
              {isManager && (
                <TabButton
                  active={tab === "coaching"}
                  onClick={() => setTab("coaching")}
                  icon={BookOpen}
                  label="Coaching"
                />
              )}
            </div>

            {tab === "account" && ctx && (
              <div className="space-y-3">
                <Row label="Name" value={ctx.account.fullName ?? "—"} />
                <Row label="Elostate role" value={ctx.account.companyRole ?? "—"} />
                <Row
                  label="Sales Coach role"
                  value={
                    ctx.account.salesCoachRole
                      ? ctx.account.salesCoachRole
                      : "Not a Sales Coach member"
                  }
                />
                <p className="text-[11px] text-muted leading-relaxed pt-1">
                  Your Sales Coach role is set by an admin under Team. More
                  per-staff preferences (default cue mode, notifications) are
                  coming.
                </p>
              </div>
            )}

            {tab === "coaching" && isManager && ctx && (
              <div className="space-y-4">
                <section className="rounded-xl border border-default bg-white/[0.01] p-4">
                  <div className="flex items-center gap-1.5 mb-2">
                    <BookOpen className="w-3.5 h-3.5 text-brand" aria-hidden />
                    <h2 className="text-sm font-semibold text-primary">
                      Coaching methodology
                    </h2>
                  </div>
                  {ctx.corpus.loaded ? (
                    <p className="inline-flex items-center gap-1.5 text-xs text-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
                      Knowledge base loaded · ~{ctx.corpus.words.toLocaleString()} words
                    </p>
                  ) : (
                    <p className="text-xs text-amber-300">
                      No knowledge base loaded — the coach is running on the
                      built-in starter methodology only.
                    </p>
                  )}
                  <p className="text-[11px] text-muted leading-relaxed mt-2">
                    The coach reasons from this corpus (SPIN, Challenger, Voss,
                    Navigate 2.0). In-app editing + swapping in your own
                    books/strategy is coming; today it&apos;s managed in the
                    repo (docs/SALES_KNOWLEDGE_BASE.md).
                  </p>
                </section>

                <section className="rounded-xl border border-default bg-white/[0.01] p-4">
                  <div className="inline-flex items-center gap-1.5 text-[11px] text-muted rounded-md border border-default px-2 py-1 mb-2">
                    <Hourglass className="w-3 h-3" aria-hidden />
                    Coming soon
                  </div>
                  <h2 className="text-sm font-semibold text-primary mb-1">
                    Cue voice
                  </h2>
                  <p className="text-[11px] text-muted leading-relaxed">
                    A Sales-Coach-specific cue voice. (Today the cue voice
                    reuses the C.A.R.E voice setting, so it isn&apos;t exposed
                    here yet — changing it would also change Jeff&apos;s voice.)
                  </p>
                </section>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof User;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 -mb-px border-b-2 transition-colors ${
        active
          ? "border-ember-400 text-brand"
          : "border-transparent text-secondary hover:text-primary"
      }`}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden />
      {label}
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-default bg-white/[0.01] px-4 py-3">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm text-primary capitalize">{value}</span>
    </div>
  );
}
