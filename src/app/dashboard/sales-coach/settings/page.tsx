"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  User,
  BookOpen,
  CheckCircle2,
  Hourglass,
  Save,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useToast } from "@/components/ui/toast";

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
                <CorpusEditor />

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

type CorpusData = {
  content: string;
  isCustom: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
  effectiveSource: "custom" | "books" | "starter";
};

const SOURCE_LABEL: Record<CorpusData["effectiveSource"], string> = {
  custom: "your team's own corpus",
  books: "the built-in books (SPIN, Challenger, Voss, Navigate 2.0)",
  starter: "the built-in starter methodology",
};

/**
 * Editable methodology corpus (migration 0074). An admin writes/saves a
 * company-specific methodology the post-call REVIEW coach reasons from,
 * overriding the built-in books/starter (§5). Append-only: each save is a
 * new version (§3.1). Honest about which source is ACTUALLY in use (§3.4).
 */
function CorpusEditor() {
  const toast = useToast();
  const [data, setData] = useState<CorpusData | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/coach/sales-session/corpus").catch(
        () => null
      );
      if (res && res.ok) {
        const d: CorpusData = await res.json();
        setData(d);
        setText(d.content ?? "");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = data
    ? text.trim() !== (data.content ?? "").trim()
    : text.trim().length > 0;

  const save = async () => {
    if (!text.trim() || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/coach/sales-session/corpus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error ?? "failed");
      }
      toast.success("Methodology saved", "Future reviews will use it.");
      await load();
    } catch (e) {
      toast.error("Couldn't save", e instanceof Error ? e.message : undefined);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-default bg-white/[0.01] p-4 space-y-3">
      <div className="flex items-center gap-1.5">
        <BookOpen className="w-3.5 h-3.5 text-brand" aria-hidden />
        <h2 className="text-sm font-semibold text-primary">
          Coaching methodology
        </h2>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs text-muted py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : (
        <>
          <p className="inline-flex items-center gap-1.5 text-xs text-secondary">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-300" aria-hidden />
            Reviews currently use{" "}
            {SOURCE_LABEL[data?.effectiveSource ?? "starter"]}.
          </p>
          {data?.isCustom && data.updatedAt && (
            <p className="text-[11px] text-muted">
              Last saved {new Date(data.updatedAt).toLocaleString()}
              {data.updatedByName ? ` by ${data.updatedByName}` : ""}.
            </p>
          )}

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={14}
            placeholder="Paste or write your team's sales methodology — the principles, moves, and language you want the post-call coach to reason from. Saving it overrides the built-in methodology for your team."
            className="w-full bg-surface border border-default rounded-lg px-3 py-2.5 text-xs text-primary placeholder:text-muted font-mono leading-relaxed focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 transition-colors resize-y"
          />

          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted">
              {data?.effectiveSource === "custom"
                ? "Saving appends a new version (history is kept). Shapes the post-call review, not live cues."
                : "Saving your own corpus overrides the built-in. Shapes the post-call review, not live cues."}
            </p>
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || !text.trim() || !dirty}
              className="inline-flex items-center gap-1.5 shrink-0 bg-ember-400 hover:bg-ember-500 disabled:opacity-50 disabled:cursor-not-allowed text-[#09090B] text-xs font-semibold px-3 py-2 rounded-lg transition-colors"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              ) : (
                <Save className="w-3.5 h-3.5" aria-hidden />
              )}
              {saving ? "Saving…" : "Save methodology"}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
