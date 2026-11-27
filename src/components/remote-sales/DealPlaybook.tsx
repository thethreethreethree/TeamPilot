"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import type { Element, NoteState, NoteView } from "@/lib/coach/remote/revenue/playbook";

/**
 * A deal's playbook (revenue Phase 3b, 0373; Gong F20.6 letters, F20.7 AI Deal Reviewer), inside the deal panel. One
 * letter per element, its state in form and in words: empty (outlined), evidence found (outlined, dot), noted (filled),
 * validated (brand, tick). Open a letter to see the reviewer's evidence with links to the lines, write the note, and —
 * the deal's rep or their manager — validate it. "Review with AI" reads the deal's latest calls.
 */
const STATE_WORD: Record<NoteState, string> = { empty: "nothing yet", ai_found: "evidence found", noted: "noted", validated: "validated" };
const mmss = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor((ms % 60000) / 1000)).padStart(2, "0")}`;

export function DealPlaybook({ dealId }: { dealId: string }) {
  const [data, setData] = useState<{ available: boolean; playbook: { name: string; elements: Element[] } | null; notes: NoteView[]; canValidate?: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const r = await fetch(`/api/coach/remote/prospects/${dealId}/playbook`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setData(await r.json());
    } catch {
      setFailed(true);
    }
  }, [dealId]);
  useEffect(() => {
    void load();
  }, [load]);

  const post = async (body: Record<string, unknown>) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(`/api/coach/remote/prospects/${dealId}/playbook`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { error?: string; found?: number; of?: number; calls?: number };
      if (!r.ok) throw new Error(j.error ?? "Couldn't save that.");
      if (body.action === "review") setMsg(`Read ${j.calls} call${j.calls === 1 ? "" : "s"}: evidence for ${j.found} of ${j.of} elements.`);
      await load();
      return true;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't save that.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  if (failed) return <p className="text-xs text-muted">Couldn&apos;t load this deal&apos;s playbook.</p>;
  if (!data) return null;
  if (!data.available) return null;
  if (!data.playbook) {
    return (
      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Playbook</p>
        <p className="text-xs text-secondary">Your company hasn&apos;t chosen a playbook yet. A manager can pick MEDDICC, BANT, SPICED or your own on the Board, under Playbook.</p>
      </div>
    );
  }
  const els = data.playbook.elements;
  const sel = open !== null ? data.notes[open] : null;
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">{data.playbook.name}</p>
        <button type="button" disabled={busy} onClick={() => void post({ action: "review" })} className="inline-flex items-center gap-1 rounded-lg border border-default px-2 py-1 text-[11px] text-primary disabled:opacity-50">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <Sparkles className="h-3 w-3 text-brand" aria-hidden />} Review with AI
        </button>
      </div>
      <div role="group" aria-label="Playbook elements" className="flex flex-wrap gap-1.5">
        {els.map((e, i) => {
          const st = data.notes[i]?.state ?? "empty";
          const tone = st === "validated" ? "border-brand bg-brand text-black" : st === "noted" ? "border-brand/60 bg-brand/15 text-primary" : "border-default text-secondary";
          return (
            <button
              key={i}
              type="button"
              aria-pressed={open === i}
              aria-label={`${e.name}: ${STATE_WORD[st]}`}
              title={`${e.name}: ${STATE_WORD[st]}`}
              onClick={() => { setOpen(open === i ? null : i); setDraft(data.notes[i]?.note ?? data.notes[i]?.ai?.answer ?? ""); setMsg(null); }}
              className={`relative min-w-8 rounded-md border px-2 py-1 text-xs font-semibold ${tone} ${open === i ? "ring-2 ring-brand/50" : ""}`}
            >
              {e.letter}
              {st === "ai_found" && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-brand" aria-hidden />}
              {st === "validated" && <CheckCircle2 className="absolute -right-1 -top-1 h-3 w-3 text-brand" aria-hidden />}
            </button>
          );
        })}
      </div>
      {open !== null && sel && (
        <div className="mt-2 space-y-2 rounded-lg border border-default p-2 text-xs">
          <p className="font-semibold text-primary">{els[open]!.name}</p>
          <p className="text-secondary">{els[open]!.question}</p>
          {sel.ai && (
            <div className="rounded-md bg-base p-2">
              <p className="text-[11px] font-semibold text-muted">From the calls</p>
              <p className="text-primary">{sel.ai.answer}</p>
              <p className="mt-1 flex flex-wrap gap-1.5">
                {sel.ai.cites.map((c) => (
                  <Link key={`${c.sessionId}-${c.seq}`} href={`/dashboard/remote-sales/calls/${c.sessionId}${c.atMs != null ? `?t=${Math.floor(c.atMs / 1000)}` : ""}`} className="text-[11px] text-primary underline-offset-2 hover:underline">
                    line {c.seq}{c.atMs != null ? ` · ${mmss(c.atMs)}` : ""}
                  </Link>
                ))}
              </p>
            </div>
          )}
          <textarea value={draft} onChange={(e) => setDraft(e.currentTarget.value)} maxLength={1000} rows={3} aria-label={`Note for ${els[open]!.name}`} placeholder="Write the note the team should see" className="w-full rounded-lg border border-default bg-base px-2 py-1 text-xs text-primary" />
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={busy || !draft.trim() || draft.trim() === (sel.note ?? "")} onClick={() => void post({ action: "write", element: open, note: draft.trim() })} className="rounded-lg border border-default px-2 py-1 text-primary disabled:opacity-50">Save note</button>
            {data.canValidate && sel.state === "noted" && (
              <button type="button" disabled={busy} onClick={() => void post({ action: "validate", element: open })} className="rounded-lg bg-brand px-2 py-1 font-semibold text-black disabled:opacity-50">Validate</button>
            )}
            {sel.state !== "empty" && (
              <button type="button" disabled={busy} onClick={() => void post({ action: "clear", element: open })} className="px-1 text-muted hover:text-primary">Clear</button>
            )}
            <span className="text-[11px] text-muted">{STATE_WORD[sel.state]}</span>
          </div>
        </div>
      )}
      {msg && <p className="mt-1 text-xs text-secondary">{msg}</p>}
    </div>
  );
}
