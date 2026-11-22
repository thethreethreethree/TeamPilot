"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * Protection → Transcription vocabulary (Gong F8.9, 0306). Names speech-to-text should get right — products, plans,
 * competitors — used for every recording transcribed for the company and both sides of live calls. Opt-in, because
 * the provider charges 20% more for transcription that uses it; an empty list turns it off.
 */
type Vocab = { terms: string[]; canManage: boolean; max: number; setAt?: string | null; notReady?: string };

export function VocabularySettings() {
  const [v, setV] = useState<Vocab | null>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/coach/remote/settings/vocabulary").catch(() => null);
    if (r?.ok) {
      const j = (await r.json()) as Vocab;
      setV(j);
      setText(j.terms.join("\n"));
    } else {
      setNote("Couldn't load the vocabulary.");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const terms = text.split("\n").map((t) => t.trim()).filter(Boolean);
  const changed = v ? terms.join("\n") !== v.terms.join("\n") : false;

  const save = async () => {
    setSaving(true);
    setNote(null);
    try {
      const r = await fetch("/api/coach/remote/settings/vocabulary", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ terms }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string; terms?: string[] };
      if (!r.ok) {
        setNote(j.error ?? "Couldn't save it.");
        return;
      }
      setNote(j.terms?.length ? `Saved ${j.terms.length} terms. Recordings transcribed from now on use them.` : "Vocabulary turned off.");
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
                placeholder={"AT&T Fiber\nSpectrum\nInternet 1000"}
                className="w-full rounded-lg border border-default bg-base p-2 text-xs text-primary"
              />
              <p className="text-[11px] text-muted">
                One per line — up to {v.max}, each at most 5 words and 50 characters.
              </p>
              <button
                type="button"
                disabled={!changed || saving}
                onClick={() => void save()}
                className="rounded-lg bg-ember-400 px-3 py-1.5 text-xs font-semibold text-ink-950 disabled:opacity-50"
              >
                {saving ? "Saving…" : terms.length ? "Save" : "Turn off"}
              </button>
            </>
          ) : (
            v.terms.length > 0 && <p className="text-xs text-secondary">{v.terms.join(" · ")}</p>
          )}
          {note && <p className="text-xs text-secondary" role="status">{note}</p>}
        </div>
      )}
    </section>
  );
}
