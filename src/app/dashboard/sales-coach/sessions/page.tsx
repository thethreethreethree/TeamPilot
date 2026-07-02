"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Search,
  Video,
  MapPin,
  Sparkles,
  FileText,
  Star,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { outcomeLabel } from "@/lib/coach/v5/outcomeLabels";
import { DeckCard, DeckPill } from "@/components/sales-coach/ui/deck";

/**
 * Sales Coach → Sessions (Phase 1). The full, filterable session history.
 * Staff see their own; managers see the company's with which agent ran each
 * — coaching visibility, chronological, NEVER ranked (§A18). Rows jump into
 * the existing session detail (§A21 — reuses it). Existing data only.
 * §3.4 — honest empty / degraded states.
 */

type Row = {
  id: string;
  clientLabel: string | null;
  context: "in_person" | "video";
  status: "active" | "ended" | "reviewed";
  startedAt: string;
  endedAt: string | null;
  territory: string | null;
  offer: string | null;
  outcome: string | null;
  agentName: string | null;
  hasDissect: boolean;
  hasSummary: boolean;
  hasReview: boolean;
};


function duration(start: string, end: string | null): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return "—";
  const min = Math.round(ms / 60000);
  return min < 1 ? "<1m" : `${min}m`;
}

export default function SalesCoachSessionsPage() {
  const [sessions, setSessions] = useState<Row[] | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [loading, setLoading] = useState(true);
  const [degraded, setDegraded] = useState(false);
  // F3: a permission/auth error is NOT transient — shown distinctly.
  const [noAccess, setNoAccess] = useState(false);
  // F1: when the badge query failed, we don't claim "no dissect" — we say
  // the review/dissect status is unavailable.
  const [badgesAvailable, setBadgesAvailable] = useState(true);

  const [search, setSearch] = useState("");
  const [context, setContext] = useState<"all" | "in_person" | "video">("all");
  const [status, setStatus] = useState<
    "all" | "active" | "ended" | "reviewed"
  >("all");
  const [period, setPeriod] = useState<"all" | "30d" | "7d">("all");

  const load = useCallback(async () => {
    setLoading(true);
    // Server-side filters (backlog): context/status/period go to the DB query
    // so filtering isn't trapped inside the 300-row cap. Text search stays
    // client-side (matches client + agent name) — see `filtered`.
    const qs = new URLSearchParams();
    if (context !== "all") qs.set("context", context);
    if (status !== "all") qs.set("status", status);
    if (period !== "all") qs.set("period", period);
    try {
      const res = await fetch(
        `/api/coach/sales-session/list?${qs.toString()}`
      ).catch(() => null);
      if (res && res.ok) {
        const d = await res.json();
        if (d.degraded) setDegraded(true);
        else {
          setDegraded(false);
          setSessions(d.sessions ?? []);
          setIsManager(!!d.isManager);
          setBadgesAvailable(d.badgesAvailable !== false);
        }
      } else if (res && (res.status === 401 || res.status === 403)) {
        // Permission/auth — retrying won't help (§3.4: not "transient").
        setNoAccess(true);
      } else {
        setDegraded(true);
      }
    } finally {
      setLoading(false);
    }
  }, [context, status, period]);

  useEffect(() => {
    void load();
  }, [load]);

  // context/status/period are applied SERVER-SIDE now (see load). Only the
  // text search (client + agent name) remains a client-side refinement.
  const filtered = useMemo(() => {
    return (sessions ?? []).filter((s) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${s.clientLabel ?? ""} ${s.agentName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sessions, search]);

  const anyFilter =
    search.trim() !== "" ||
    context !== "all" ||
    status !== "all" ||
    period !== "all";

  return (
    <>
      <TopBar title="Sessions" subtitle="Your coaching history" />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-5xl mx-auto w-full space-y-4 bg-base">
        {/* Filter bar */}
        <DeckCard className="p-2.5 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted"
              aria-hidden
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isManager ? "Search client or agent…" : "Search client…"}
              className="w-full bg-black/30 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50"
            />
          </div>
          <Select
            value={context}
            onChange={(v) => setContext(v as typeof context)}
            options={[
              ["all", "All contexts"],
              ["in_person", "In-person"],
              ["video", "Video"],
            ]}
          />
          <Select
            value={status}
            onChange={(v) => setStatus(v as typeof status)}
            options={[
              ["all", "All status"],
              ["active", "Active"],
              ["ended", "Ended"],
              ["reviewed", "Reviewed"],
            ]}
          />
          <Select
            value={period}
            onChange={(v) => setPeriod(v as typeof period)}
            options={[
              ["all", "All time"],
              ["30d", "Last 30 days"],
              ["7d", "Last 7 days"],
            ]}
          />
        </DeckCard>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        ) : noAccess ? (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm p-4">
            <p className="text-xs text-secondary">
              You don&apos;t have access to a Sales Coach workspace here. Ask an
              admin if this looks wrong.
            </p>
          </div>
        ) : degraded ? (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/5 p-4">
            <p className="text-xs text-amber-300">
              Couldn&apos;t load your sessions right now — this is an error, not
              an empty history. Try again shortly.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted py-12 text-center">
            {(sessions ?? []).length === 0
              ? "No sessions yet. Start one from Home."
              : "No sessions match these filters."}
          </p>
        ) : (
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-sm divide-y divide-default overflow-hidden">
            {filtered.map((s) => (
              <Link
                key={s.id}
                href={`/dashboard/sales-coach/${s.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
              >
                <span className="shrink-0 text-muted">
                  {s.context === "video" ? (
                    <Video className="w-4 h-4" aria-hidden />
                  ) : (
                    <MapPin className="w-4 h-4" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm text-primary truncate">
                    {s.clientLabel ?? "Untitled session"}
                  </span>
                  <span className="block text-[10px] text-muted">
                    {new Date(s.startedAt).toLocaleString()} ·{" "}
                    {duration(s.startedAt, s.endedAt)} · {s.status}
                    {s.territory ? ` · ${s.territory}` : ""}
                    {isManager && s.agentName ? ` · ${s.agentName}` : ""}
                  </span>
                </span>
                {s.outcome && (
                  <span className="shrink-0">
                    <DeckPill>{outcomeLabel(s.outcome)}</DeckPill>
                  </span>
                )}
                {badgesAvailable && (
                  <span className="hidden sm:flex items-center gap-1.5 shrink-0">
                    {s.hasReview && <Badge icon={Star} label="Review" />}
                    {s.hasDissect && <Badge icon={Sparkles} label="Dissect" />}
                    {s.hasSummary && <Badge icon={FileText} label="Summary" />}
                  </span>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* F1: don't claim "no dissect" when the badge query failed. */}
        {!loading && !noAccess && !degraded && !badgesAvailable && (
          <p className="text-[10px] text-amber-300/80 text-center">
            Review / dissect status is unavailable right now.
          </p>
        )}

        {/* F4: the cap is real — say so, and that filtering happens WITHIN it. */}
        {!loading && !noAccess && !degraded && (sessions ?? []).length >= 300 && (
          <p className="text-[10px] text-muted text-center">
            {anyFilter
              ? "Filtered on the server — up to the 300 most recent matches (text search refines within them)."
              : "Showing the 300 most recent sessions."}
          </p>
        )}

        {/* F2 (§A10): disclose upward visibility to the agent (not to managers,
            who are the coach). */}
        {!loading && !noAccess && !degraded && !isManager && (
          <p className="text-[10px] text-muted text-center">
            Your coach can see your sessions — for coaching, not ranking.
          </p>
        )}
      </div>
    </>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-black/30 border border-white/10 rounded-xl px-2.5 py-2 text-xs text-secondary focus:outline-none focus:border-ember-400/50"
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}

function Badge({ icon: Icon, label }: { icon: typeof Star; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-secondary border border-default rounded-full px-2 py-0.5">
      <Icon className="w-2.5 h-2.5" aria-hidden />
      {label}
    </span>
  );
}
