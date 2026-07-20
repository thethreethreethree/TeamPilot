"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MessageCircle, Send, X } from "lucide-react";
import { LearningBulb } from "./LearningBulb";
import { useLearningMode } from "./LearningModeProvider";

type Turn =
  | { role: "user"; content: string }
  | { role: "jeff"; content: string };

/**
 * Slide-out panel that opens when a user clicks "Ask Jeff what this
 * does" on a LearningHint. Jeff has the hint's full context
 * (title / whatItIs / why / how / principle / category) pre-loaded;
 * the user can ask follow-up questions and Jeff answers in the same
 * teaching voice as the structured hint, with depth.
 *
 * Per CLAUDE.md §3.3 — Jeff teaches, doesn't direct.
 * Per CLAUDE.md §3.4 — answers route through Brain so the control
 * window applies; the panel surfaces the suppression honestly when
 * it fires.
 */
export function AskJeffPanel() {
  const { askJeffContext, closeAskJeff } = useLearningMode();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  // Reset state when a new feature is opened.
  useEffect(() => {
    if (askJeffContext) {
      setTurns([]);
      setInput("");
      setError(null);
    }
  }, [askJeffContext]);

  // Scroll the conversation to the bottom on every new turn.
  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [turns, busy]);

  // Escape to close.
  useEffect(() => {
    if (!askJeffContext) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAskJeff();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [askJeffContext, closeAskJeff]);

  if (!askJeffContext) return null;

  const submit = async () => {
    const trimmed = input.trim();
    if (!trimmed || busy) return;
    const nextTurns: Turn[] = [...turns, { role: "user", content: trimmed }];
    setTurns(nextTurns);
    setInput("");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/me/ask-jeff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          featureContext: askJeffContext,
          history: nextTurns,
          userQuestion: trimmed,
        }),
      });
      if (!res.ok) {
        setError("Jeff couldn't reach the server. Try again.");
        return;
      }
      const data = await res.json();
      if (data.suppressed) {
        setTurns((t) => [...t, { role: "jeff", content: data.answer }]);
        return;
      }
      if (typeof data.answer === "string" && data.answer.length > 0) {
        setTurns((t) => [...t, { role: "jeff", content: data.answer }]);
      } else {
        setError("Jeff returned an empty response. Try rephrasing.");
      }
    } catch {
      setError("Jeff couldn't reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      // z-[70]: floats above the z-[60] product shells (Care/SalesCoach), matching the palette + toasts. At
      // z-[60] it was equal to the shells and relied on DOM paint order; z-[70] makes the Ask-Jeff slide-out
      // robustly appear over both product surfaces.
      className="fixed inset-0 z-[70] bg-black/40 flex justify-end"
      onClick={closeAskJeff}
    >
      <div
        // h-dvh keeps the drawer bound to the dynamic viewport so the
        // iOS keyboard doesn't push content beyond the screen edge.
        className="w-full max-w-md bg-base border-l border-ember-400/30 h-dvh flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — Jeff's identity + the feature being discussed.
            pt-[max(0.75rem,env(safe-area-inset-top))] pushes the
            title + close X below the iOS status bar / Dynamic Island
            on phones with a notch. Without it the panel header sat
            under the system clock and the close button was untappable. */}
        <div
          className="px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] border-b border-default flex items-start gap-3 bg-base flex-shrink-0"
        >
          <div className="w-10 h-10 rounded-md bg-ember-400/10 border border-ember-400/40 flex items-center justify-center flex-shrink-0">
            <LearningBulb size={26} glowing priority />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary">Ask Jeff</p>
            <p className="text-[11px] text-muted">
              About <span className="text-secondary">{askJeffContext.title}</span>
              {askJeffContext.category && (
                <>
                  {" "}
                  <span className="text-muted">·</span>{" "}
                  <span className="text-ember-300 uppercase tracking-widest text-[9px] font-bold">
                    {askJeffContext.category}
                  </span>
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={closeAskJeff}
            aria-label="Close"
            className="text-muted hover:text-primary p-2 rounded hover:bg-surface-raised flex-shrink-0"
          >
            <X className="w-4 h-4" aria-hidden />
          </button>
        </div>

        {/* Body — conversation history */}
        <div
          ref={bodyRef}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-3"
        >
          {/* Always show the structured context Jeff is working from
              so the user can re-read the hint without flipping back. */}
          <div className="rounded-md border border-default bg-surface-raised p-3 text-[11px] space-y-2">
            <p className="font-semibold text-primary">{askJeffContext.title}</p>
            <p className="text-secondary leading-relaxed">
              {askJeffContext.whatItIs}
            </p>
            <p className="text-secondary leading-relaxed">
              <span className="text-muted">Why: </span>
              {askJeffContext.why}
            </p>
            <p className="text-secondary leading-relaxed">
              <span className="text-muted">How: </span>
              {askJeffContext.how}
            </p>
            {askJeffContext.principle && (
              <p className="text-primary leading-relaxed italic">
                {askJeffContext.principle}
              </p>
            )}
          </div>

          {turns.length === 0 && !busy && (
            <p className="text-xs text-muted italic">
              Jeff is ready. Ask anything about this feature — how it
              connects to other parts of the System, when to reach for
              it vs. an alternative, what failure mode it was built to
              defeat. He&apos;ll teach, never tell you what to click.
            </p>
          )}

          {turns.map((t, i) => (
            <div key={i} className="text-xs leading-relaxed">
              {t.role === "user" ? (
                <div>
                  <span className="text-[9px] uppercase tracking-widest font-bold text-muted">
                    You
                  </span>
                  <p className="text-secondary mt-0.5">{t.content}</p>
                </div>
              ) : (
                <div>
                  <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-widest font-bold text-ember-300">
                    <MessageCircle className="w-2.5 h-2.5" aria-hidden /> Jeff
                  </span>
                  <p className="text-primary mt-0.5 whitespace-pre-wrap">
                    {t.content}
                  </p>
                </div>
              )}
            </div>
          ))}

          {busy && (
            <div className="text-[11px] text-muted inline-flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
              Jeff is thinking…
            </div>
          )}

          {error && (
            <p className="text-[11px] text-ember-300">{error}</p>
          )}
        </div>

        {/* Composer */}
        <form
          className="px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-default flex items-center gap-2 flex-shrink-0"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Jeff about this feature…"
            disabled={busy}
            autoComplete="off"
            aria-label="Ask Jeff about this feature"
            className="flex-1 min-w-0 bg-base border border-default focus:border-ember-400/60 rounded-md px-3 py-2 text-sm md:text-xs text-primary placeholder:text-muted focus:outline-none"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Send message to Jeff"
            className="shrink-0 inline-flex items-center justify-center bg-ember-400/10 hover:bg-ember-400/20 disabled:opacity-40 text-ember-300 border border-ember-400/40 rounded-md w-10 h-10"
          >
            <Send className="w-4 h-4" aria-hidden />
          </button>
        </form>
      </div>
    </div>
  );
}
