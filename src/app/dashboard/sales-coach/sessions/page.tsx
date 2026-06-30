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

  const [search, setSearch] = useState("");
  const [context, setContext] = useState<"all" | "in_person" | "video">("all");
  const [status, setStatus] = useState<
    "all" | "active" | "ended" | "reviewed"
  >("all");
  const [period, setPeriod] = useState<"all" | "30d" | "7d">("all");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/coach/sales-session/list").catch(() => null);
      if (res && res.ok) {
        const d = await res.json();
        if (d.degraded) setDegraded(true);
        else {
          setSessions(d.sessions ?? []);
          setIsManager(!!d.isManager);
        }
      } else {
        setDegraded(true);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    return (sessions ?? []).filter((s) => {
      if (context !== "all" && s.context !== context) return false;
      if (status !== "all" && s.status !== status) return false;
      if (period !== "all") {
        const days = period === "7d" ? 7 : 30;
        if (new Date(s.startedAt).getTime() < Date.now() - days * 86_400_000)
          return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${s.clientLabel ?? ""} ${s.agentName ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sessions, context, status, period, search]);

  return (
    <>
      <TopBar title="Sessions" subtitle="Your coaching history" />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-5xl mx-auto w-full space-y-4">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px]">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted"
              aria-hidden
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={isManager ? "Search client or agent…" : "Search client…"}
              className="w-full bg-surface border border-default rounded-lg pl-8 pr-3 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50"
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
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
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
          <div className="rounded-xl border border-default bg-white/[0.01] divide-y divide-default overflow-hidden">
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
                    {isManager && s.agentName ? ` · ${s.agentName}` : ""}
                  </span>
                </span>
                <span className="hidden sm:flex items-center gap-1.5 shrink-0">
                  {s.hasReview && <Badge icon={Star} label="Review" />}
                  {s.hasDissect && <Badge icon={Sparkles} label="Dissect" />}
                  {s.hasSummary && <Badge icon={FileText} label="Summary" />}
                </span>
              </Link>
            ))}
          </div>
        )}

        {!loading && !degraded && (sessions ?? []).length >= 300 && (
          <p className="text-[10px] text-muted text-center">
            Showing the 300 most recent sessions.
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
      className="bg-surface border border-default rounded-lg px-2.5 py-2 text-xs text-secondary focus:outline-none focus:border-ember-400/50"
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
