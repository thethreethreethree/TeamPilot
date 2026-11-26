"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ListPlus, Loader2, RefreshCw, Sparkles } from "lucide-react";
import type { DealBriefBody, Point } from "@/lib/coach/remote/revenue/dealBrief";

/**
 * A deal's brief (revenue Phase 3c, 0374; Gong F20.3 Briefs, F20.4 suggested updates), inside the deal panel: where it
 * stands, what happened, the risks the customer raised, and the next steps — each point linking to the lines it rests
 * on. A next step becomes a to-do on the deal in one click. When a call is added or a transcript corrected, the brief
 * says it's out of date and offers a fresh one.
 */
const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

function Cites({ p }: { p: Point }) {
  return (
    <span className="ml-1 inline-flex flex-wrap gap-1">
      {p.cites.map((c) => (
        <Link key={`${c.sessionId}-${c.seq}`} href={`/dashboard/remote-sales/calls/${c.sessionId}${c.atMs != null ? `?t=${Math.floor(c.atMs / 1000)}` : ""}`} className="text-[10px] text-muted underline-offset-2 hover:text-primary hover:underline">
          [{c.atMs != null ? mmss(c.atMs) : `line ${c.seq}`}]
        </Link>
      ))}
    </span>
  );
}

export function DealBrief({ dealId, addTodo }: { dealId: string; addTodo: (title: string) => Promise<boolean> }) {
  const [data, setData] = useState<{ available: boolean; brief: DealBriefBody | null; stale?: boolean; createdAt?: string } | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const r = await fetch(`/api/coach/remote/prospects/${dealId}/brief`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setData(await r.json());
    } catch {
      setFailed(true);
    }
  }, [dealId]);
  useEffect(() => {
    void load();
  }, [load]);

  const write = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/coach/remote/prospects/${dealId}/brief`, { method: "POST" });
      const j = (await r.json().catch(() => ({}))) as { error?: string; brief?: DealBriefBody; createdAt?: string };
      if (!r.ok || !j.brief) throw new Error(j.error ?? "Couldn't write the brief.");
      setData({ available: true, brief: j.brief, createdAt: j.createdAt, stale: false });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't write the brief.");
    } finally {
      setBusy(false);
    }
  };

  if (failed) return <p className="text-xs text-muted">Couldn&apos;t load this deal&apos;s brief.</p>;
  if (!data || !data.available) return null;
  const b = data.brief;
  const empty = b && !b.happened.length && !b.risks.length && !b.next.length;
  const section = (title: string, ps: Point[], todo?: boolean) =>
    ps.length > 0 && (
      <div>
        <p className="text-[11px] font-semibold text-muted">{title}</p>
        <ul className="mt-0.5 space-y-1">
          {ps.map((p, i) => (
            <li key={i} className="flex flex-wrap items-start gap-1 text-xs text-primary">
              <span className="min-w-0">{p.text}<Cites p={p} /></span>
              {todo && (
                <button
                  type="button"
                  disabled={added.has(p.text)}
                  onClick={async () => { if (await addTodo(p.text.slice(0, 200))) setAdded((s) => new Set(s).add(p.text)); }}
                  className="inline-flex items-center gap-0.5 text-[11px] text-secondary underline-offset-2 hover:text-primary hover:underline disabled:no-underline disabled:opacity-60"
                >
                  <ListPlus className="h-3 w-3" aria-hidden /> {added.has(p.text) ? "Added" : "Add as to-do"}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Brief</p>
        {(!b || data.stale) && (
          <button type="button" disabled={busy} onClick={() => void write()} className="inline-flex items-center gap-1 rounded-lg border border-default px-2 py-1 text-[11px] text-primary disabled:opacity-50">
            {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : b ? <RefreshCw className="h-3 w-3" aria-hidden /> : <Sparkles className="h-3 w-3 text-brand" aria-hidden />}
            {b ? "Write a fresh brief" : "Write a brief"}
          </button>
        )}
      </div>
      {!b ? (
        <p className="text-xs text-secondary">A brief reads this deal&apos;s latest calls: where it stands, what happened, the risks and the next steps.</p>
      ) : (
        <div className="space-y-2 rounded-lg border border-default p-2">
          {data.stale && <p className="text-[11px] text-amber-700 dark:text-amber-300">The deal&apos;s calls changed since this brief was written.</p>}
          {empty ? (
            <p className="text-xs text-secondary">The calls don&apos;t show enough yet to brief this deal.</p>
          ) : (
            <>
              {b.standing && <p className="text-xs font-medium text-primary">{b.standing}</p>}
              {section("What happened", b.happened)}
              {section("Risks", b.risks)}
              {section("Next steps", b.next, true)}
            </>
          )}
          {data.createdAt && <p className="text-[10px] text-muted">Written {new Date(data.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</p>}
        </div>
      )}
      {msg && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{msg}</p>}
    </div>
  );
}
