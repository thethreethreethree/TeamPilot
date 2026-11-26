"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { parseVocabularyLines, VocabularyError, type Correction } from "@/lib/coach/remote/vocabulary";

/**
 * Protection → Transcription vocabulary (Gong F8.9, 0306). Names speech-to-text should get right — products, plans,
 * competitors — used for every recording transcribed for the company and both sides of live calls. Opt-in, because
 * the provider charges 20% more for transcription that uses it; an empty list turns it off.
 */
type Vocab = { terms: string[]; corrections?: Correction[]; canManage: boolean; max: number; setAt?: string | null; notReady?: string };

/** One line per term; "Term = heard, heard" when it has known mis-hearings (0354). */
const toLines = (v: Pick<Vocab, "terms" | "corrections">) =>
  v.terms.map((t) => {
    const c = (v.corrections ?? []).find((x) => x.term === t);
    return c && c.heard.length ? `${t} = ${c.heard.join(", ")}` : t;
  });

export function VocabularySettings() {
  const [v, setV] = useState<Vocab | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  // Past calls (founder picker 2026-11-26: "On request, with a count"): the count first, then fix on a confirm.
  const [past, setPast] = useState<{ calls: number; lines: number; scanned: number; capped: boolean; batch: number } | null>(null);
  const [pastBusy, setPastBusy] = useState(false);
  const [pastNote, setPastNote] = useState<string | null>(null);
  const reapply = async (apply: boolean) => {
    setPastBusy(true);
    setPastNote(null);
    try {
      const r = await fetch("/api/coach/remote/settings/vocabulary/reapply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apply }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string; calls?: number; lines?: number; scanned?: number; capped?: boolean; batch?: number; fixed?: number; skipped?: number; remaining?: number };
      if (!r.ok) {
        setPast(null);
        return setPastNote(j.error ?? "Couldn't check past calls.");
      }
      if (!apply) return setPast({ calls: j.calls ?? 0, lines: j.lines ?? 0, scanned: j.scanned ?? 0, capped: j.capped === true, batch: j.batch ?? 0 });
      setPast(null);
      setPastNote(
        `Fixed ${j.fixed ?? 0} ${j.fixed === 1 ? "call" : "calls"}; their notes are being redone now.${j.skipped ? ` ${j.skipped} changed in the meantime — check again to include them.` : ""}${j.remaining ? ` ${j.remaining} more to fix — check again.` : ""}`,
      );
    } catch {
      setPastNote("Couldn't reach the server.");
    } finally {
      setPastBusy(false);
    }
  };

  const load = useCallback(async () => {
    const r = await fetch("/api/coach/remote/settings/vocabulary").catch(() => null);
    if (r?.ok) {
      const j = (await r.json()) as Vocab;
      setV(j);
      setText(toLines(j).join("\n"));
    } else {
      setNote("Couldn't load the vocabulary.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  // Parsed with the same rules the server applies, so a mistake shows before saving.
  let parsed: { terms: string[]; corrections: Correction[] } = { terms: [], corrections: [] };
  let parseError: string | null = null;
  try {
    parsed = parseVocabularyLines(text.split("\n"));
  } catch (e) {
    parseError = e instanceof VocabularyError ? e.message : "That list can't be read.";
  }
  const terms = parsed.terms;
  const changed = v ? toLines(parsed).join("\n") !== toLines(v).join("\n") : false;

  const save = async () => {
    setSaving(true);
    setNote(null);
    try {
      const r = await fetch("/api/coach/remote/settings/vocabulary", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms, corrections: parsed.corrections }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; terms?: string[] };
      if (!r.ok) {
        setNote(j.error ?? "Couldn't save it.");
        return;
      }
      const fixes = parsed.corrections.reduce((n, c) => n + c.heard.length, 0);
      setNote(
        j.terms?.length
          ? `Saved ${j.terms.length} terms${fixes ? ` and ${fixes} mis-hearing${fixes === 1 ? "" : "s"} to fix` : ""}. Calls transcribed from now on use them.`
          : "Vocabulary turned off.",
      );
      await load();
    } catch {
      setNote("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-default bg-surface p-4" aria-label="Transcription vocabulary">
      <h3 className="text-sm font-semibold text-primary">Transcription vocabulary</h3>
      <p className="mt-1 text-xs text-secondary">
        Names transcription should get right — your products and plans, competitors, place names. Used for every recording
        transcribed for your company and both sides of live calls. It makes transcription cost about 20% more, so leave it
        empty unless names are coming out wrong.
      </p>
      {!v ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted">
          {note ?? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…
            </>
          )}
        </p>
      ) : v.notReady ? (
        <p className="mt-3 text-xs text-muted">{v.notReady}</p>
      ) : (
        <div className="mt-3 space-y-2">
          <p className="text-xs text-primary">
            {v.terms.length ? `Now: ${v.terms.length} ${v.terms.length === 1 ? "term" : "terms"}` : "Now: off"}
          </p>
          {v.canManage ? (
            <>
              <label htmlFor="vocab" className="sr-only">Vocabulary, one per line</label>
              <textarea
                id="vocab"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={5}
                placeholder={"AT&T Fiber\nSpectrum = spec trum, spektrum\nInternet 1000"}
                className="w-full rounded-lg border border-default bg-base p-2 text-xs text-primary"
              />
              <p className="text-[11px] text-muted">
                One per line — up to {v.max}, each at most 5 words and 50 characters. If a name keeps coming out wrong, add
                what it&apos;s heard as after an equals sign — <span className="font-mono">Spectrum = spec trum, spektrum</span> — and
                new lines are stored with the right name (whole words only). Calls already transcribed can be fixed below.
              </p>
              {parseError && <p role="alert" className="text-[11px] text-amber-700 dark:text-amber-300">{parseError}</p>}
              <button
                type="button"
                disabled={!changed || saving || !!parseError}
                onClick={() => void save()}
                className="rounded-lg bg-ember-400 px-3 py-1.5 text-xs font-semibold text-ink-950 disabled:opacity-50"
              >
                {saving ? "Saving…" : terms.length || parseError ? "Save" : "Turn off"}
              </button>
            </>
          ) : (
            v.terms.length > 0 && <p className="text-xs text-secondary">{toLines(v).join(" · ")}</p>
          )}
          {note && <p className="text-xs text-secondary" role="status">{note}</p>}
          {v.canManage && (v.corrections ?? []).length > 0 && (
            <div className="space-y-1 border-t border-default pt-2" aria-label="Fix past calls">
              <p className="text-[11px] text-muted">The mis-hearings above fix new lines. You can also fix calls already transcribed.</p>
              {!past && (
                <button type="button" disabled={pastBusy || changed} onClick={() => void reapply(false)} className="rounded-lg border border-default px-3 py-1 text-xs text-secondary hover:text-primary disabled:opacity-50">
                  {pastBusy ? "Checking…" : changed ? "Save first, then check past calls" : "Check past calls"}
                </button>
              )}
              {past && (
                <div className="space-y-1 text-xs">
                  <p className="text-primary">
                    {past.calls === 0
                      ? `None of the last ${past.scanned} calls would change.`
                      : `${past.calls} ${past.calls === 1 ? "call" : "calls"} (${past.lines} ${past.lines === 1 ? "line" : "lines"}) would change${past.capped ? ` among the newest ${past.scanned}` : ""}. Each fixed call's notes, summary and review are redone — one AI pass per call.`}
                  </p>
                  {past.calls > 0 && (
                    <button
                      type="button"
                      disabled={pastBusy}
                      onClick={() => {
                        if (window.confirm(`Fix ${past.batch} ${past.batch === 1 ? "call" : "calls"} now and redo their AI notes (${past.batch} AI ${past.batch === 1 ? "pass" : "passes"})?`)) void reapply(true);
                      }}
                      className="rounded-lg bg-ember-400 px-3 py-1 text-xs font-semibold text-ink-950 disabled:opacity-50"
                    >
                      {pastBusy ? "Fixing…" : `Fix ${past.batch} ${past.batch === 1 ? "call" : "calls"}`}
                    </button>
                  )}
                  <button type="button" onClick={() => setPast(null)} className="ml-2 text-muted hover:text-primary">Not now</button>
                </div>
              )}
              {pastNote && <p className="text-xs text-secondary" role="status">{pastNote}</p>}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
