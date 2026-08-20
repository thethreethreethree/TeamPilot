"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Check, AlertTriangle, CheckCircle2 } from "lucide-react";

/**
 * Schedule Management System — the conversational AI assistant PANEL (the chat + command box), reusable so it
 * lives BOTH on its own tab and embedded in the Import flow (the founder's flow: upload a file, then command
 * the AI right there). The manager types a plain instruction; the AI proposes changes to CONFIRM (§3.3) —
 * each proposal has an Apply button, and only then are the events appended via /schedule/events. It never
 * applies anything on its own. Manager-only is enforced by the route.
 *
 * `variant`: "full" fills its parent (the dedicated tab); "embedded" is a bounded, scrollable box (Import).
 */

type Proposal = {
  op: string;
  summary: string;
  events: { type: string; payload: Record<string, unknown> }[];
  impact: string[];
  blocked: boolean;
  reason?: string;
};
type Msg = { role: "user" | "assistant"; content: string; proposals?: Proposal[] };

const DEFAULT_EXAMPLES = [
  "Give Darren Guzman the 09:00 to 17:00 shift on 2026-08-25",
  "Create a 06:00 to 15:00 shift on 2026-08-26 for 2 people",
  "Move the 2026-08-25 09:00 to 17:00 shift to 10:00 to 18:00",
  "Cancel the shift on 2026-08-24",
  "Who's working this week?",
];

export function AssistantPanel({ variant = "full", examples = DEFAULT_EXAMPLES }: { variant?: "full" | "embedded"; examples?: string[] }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<Record<string, "done" | "error">>({});
  const [applying, setApplying] = useState<string | null>(null);
  const applyingRef = useRef(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, applied]);

  const send = async () => {
    const message = input.trim();
    if (!message || busy) return;
    setInput("");
    setError(null);
    const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));
    setMessages((m) => [...m, { role: "user", content: message }]);
    setBusy(true);
    try {
      const res = await fetch("/api/schedule/assistant", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => null))?.error ?? "The assistant couldn't respond. Try again.");
        return;
      }
      const d = (await res.json()) as { reply: string; proposals: Proposal[] };
      setMessages((m) => [...m, { role: "assistant", content: d.reply, proposals: d.proposals }]);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };

  // Apply a proposal: append its events in order. If any event fails, stop and mark it errored — a partial
  // apply is surfaced, never hidden (retry re-runs all events and converges: re-cancel/re-define/re-assign
  // are idempotent on replay).
  const applyProposal = async (key: string, p: Proposal) => {
    if (applyingRef.current || applied[key]) return;
    applyingRef.current = true;
    setApplying(key);
    try {
      for (const ev of p.events) {
        const res = await fetch("/api/schedule/events", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ev),
        });
        if (!res.ok) { setApplied((a) => ({ ...a, [key]: "error" })); return; }
      }
      setApplied((a) => ({ ...a, [key]: "done" }));
    } catch {
      setApplied((a) => ({ ...a, [key]: "error" }));
    } finally {
      applyingRef.current = false;
      setApplying(null);
    }
  };

  const embedded = variant === "embedded";

  return (
    <div className={embedded ? "flex flex-col" : "flex-1 min-h-0 flex flex-col"}>
      <div className={`${embedded ? "max-h-80" : "flex-1 min-h-0"} overflow-y-auto space-y-3 pr-1`}>
        {messages.length === 0 ? (
          <div className="glass-card p-4 space-y-2">
            <div className="text-sm font-semibold text-secondary">Try:</div>
            {examples.map((ex) => (
              <button key={ex} type="button" onClick={() => setInput(ex)}
                className="block w-full text-left text-xs text-secondary bg-surface hover:bg-brand/10 rounded-lg px-3 py-2 border border-white/10">
                &ldquo;{ex}&rdquo;
              </button>
            ))}
          </div>
        ) : (
          messages.map((m, mi) => (
            <div key={mi} className={m.role === "user" ? "flex justify-end" : ""}>
              <div className={m.role === "user"
                ? "bg-brand/15 border border-brand/30 rounded-2xl rounded-br-sm px-3 py-2 text-sm text-primary max-w-[85%]"
                : "bg-surface border border-white/10 rounded-2xl rounded-bl-sm px-3 py-2 text-sm text-secondary max-w-[92%] w-full"}>
                <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                {m.proposals && m.proposals.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {m.proposals.map((p, pi) => {
                      const key = `${mi}:${pi}`;
                      const st = applied[key];
                      return (
                        <div key={pi} className={`rounded-lg border px-3 py-2 ${p.blocked ? "border-white/10 bg-base/40" : "border-brand/30 bg-base/60"}`}>
                          <div className="text-xs font-medium text-primary">{p.summary}</div>
                          {p.blocked ? (
                            <p className="text-[11px] text-muted mt-0.5">{p.reason}</p>
                          ) : (
                            <>
                              {p.impact.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {p.impact.map((w, wi) => (
                                    <p key={wi} className="text-[11px] text-amber-300 flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" aria-hidden />{w}</p>
                                  ))}
                                </div>
                              )}
                              <div className="mt-1.5">
                                {st === "done" ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" aria-hidden /> Applied</span>
                                ) : st === "error" ? (
                                  <button type="button" onClick={() => { setApplied((a) => { const n = { ...a }; delete n[key]; return n; }); void applyProposal(key, p); }}
                                    className="text-[11px] text-red-300 hover:underline">Couldn&apos;t apply. Retry</button>
                                ) : (
                                  <button type="button" onClick={() => void applyProposal(key, p)} disabled={applying === key}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1 text-[11px] font-semibold text-black disabled:opacity-50">
                                    {applying === key ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : <Check className="w-3 h-3" aria-hidden />}
                                    Apply
                                  </button>
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {busy && <div className="flex items-center gap-2 text-xs text-muted"><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Thinking…</div>}
        {error && <p className="text-xs text-red-300">{error}</p>}
        <div ref={endRef} />
      </div>

      <div className="mt-3 flex items-end gap-2">
        <textarea value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
          rows={2} placeholder="Tell me what to schedule, or ask a question…"
          className="flex-1 resize-none rounded-xl bg-surface border border-white/10 px-3 py-2 text-sm text-primary placeholder:text-muted" />
        <button type="button" onClick={() => void send()} disabled={!input.trim() || busy}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-semibold text-black disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Send className="w-4 h-4" aria-hidden />}
        </button>
      </div>
    </div>
  );
}
