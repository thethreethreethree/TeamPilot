"use client";

/**
 * /sales/demo — "Practice on a live prospect" (founder 2026-07-22; mirrors JeffLiveChat, wired live).
 *
 * The visitor is the SALESPERSON; the AI plays a real prospect (Dana, VP Ops) AND a live coach cue
 * lands on each of the visitor's lines — the Sales Coach's differentiator (coaching WHILE you sell).
 * Calls POST /api/sales/demo/roleplay (rate-limited, stateless). Fixed-dark console (theme-audit
 * allowlisted). §3.4: this is the live engine, not a script; the cue is generated per line.
 */

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Target, User } from "lucide-react";

type Msg =
  | { from: "prospect"; text: string }
  | { from: "rep"; text: string }
  | { from: "cue"; text: string };

const OPENERS: string[] = [
  "Hi Dana — before I pitch anything, what's the most frustrating part of your team's day right now?",
  "We help ops teams stop work from falling through the cracks. Worth 15 minutes?",
  "I'll be quick — what tools does your team already live in?",
];

const ERROR_REPLY =
  "Sorry, I lost you for a second there — can you say that again?";

export function SalesRoleplay() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { from: "prospect", text: "You've got 15 minutes. I'm Dana, VP of Ops — and I'm skeptical, just so we're clear. Go." },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs, pending]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || pending) return;
    setInput("");
    // history: prior rep/prospect turns (skip cues), mapped to the endpoint shape.
    const history = msgs
      .filter((m): m is Extract<Msg, { from: "rep" | "prospect" }> => m.from === "rep" || m.from === "prospect")
      .slice(-12)
      .map((m) => ({ role: (m.from === "rep" ? "rep" : "prospect") as "rep" | "prospect", content: m.text }));
    setMsgs((m) => [...m, { from: "rep", text: clean }]);
    setPending(true);
    try {
      const res = await fetch("/api/sales/demo/roleplay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: clean, history }),
      });
      const data = (await res.json().catch(() => ({}))) as { prospect?: string; cue?: string };
      const next: Msg[] = [];
      if (res.ok && data.cue) next.push({ from: "cue", text: data.cue });
      next.push({ from: "prospect", text: res.ok && data.prospect ? data.prospect : ERROR_REPLY });
      setMsgs((m) => [...m, ...next]);
    } catch {
      setMsgs((m) => [...m, { from: "prospect", text: ERROR_REPLY }]);
    } finally {
      setPending(false);
    }
  }

  const suggestions = OPENERS.filter((q) => !msgs.some((m) => m.from === "rep" && m.text === q));
  // §1.5.1 continuity: after a few turns, surface the next action so the roleplay doesn't dead-end
  // (audit L3 fix — mirrors how JeffLiveChat converges to a next step).
  const repTurns = msgs.filter((m) => m.from === "rep").length;
  const showNudge = repTurns >= 4;

  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-950 overflow-hidden flex flex-col max-w-md w-full mx-auto shadow-glow-ember-soft">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-ember-400 text-[#09090B]">
        <div className="w-7 h-7 rounded-full bg-[#09090B]/10 flex items-center justify-center">
          <User className="w-4 h-4" aria-hidden />
        </div>
        <div className="leading-tight">
          <p className="text-xs font-bold">Dana Cole · VP Operations</p>
          <p className="text-[10px] opacity-70">Live roleplay · you&apos;re the salesperson</p>
        </div>
        <span className="ml-auto text-[10px] font-semibold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" /> Live
        </span>
      </div>

      <div className="p-3 space-y-2.5 flex-1 min-h-[260px] max-h-[320px] overflow-y-auto">
        {msgs.map((m, i) =>
          m.from === "cue" ? (
            <div key={i} className="flex justify-end">
              <p className="text-[10px] text-ember-200/90 bg-ember-400/10 border border-ember-400/25 rounded-md px-2 py-1 max-w-[85%] flex items-start gap-1.5">
                <Target className="w-3 h-3 shrink-0 mt-0.5" aria-hidden /> <span><span className="font-bold uppercase tracking-wider text-[9px]">Coach cue</span> — {m.text}</span>
              </p>
            </div>
          ) : (
            <div key={i} className={`flex ${m.from === "rep" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[85%]">
                <p className="text-[9px] text-zinc-500 mb-0.5">{m.from === "rep" ? "You" : "Dana"}</p>
                <div
                  className={`text-[11px] leading-relaxed px-2.5 py-1.5 rounded-lg ${
                    m.from === "rep"
                      ? "bg-ember-400 text-[#09090B] rounded-br-sm"
                      : "bg-ink-800 text-zinc-100 border border-ink-700 rounded-bl-sm"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            </div>
          )
        )}
        {pending && (
          <div className="flex justify-start">
            <div className="bg-ink-800 border border-ink-700 rounded-lg rounded-bl-sm px-2.5 py-2 flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "120ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "240ms" }} />
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {suggestions.length > 0 && (
        <div className="px-3 pb-2 flex flex-wrap gap-1.5">
          {suggestions.slice(0, 2).map((s, i) => (
            <button
              key={i}
              type="button"
              onClick={() => send(s)}
              disabled={pending}
              className="text-[10px] text-left px-2 py-1 rounded-md border border-ink-700 bg-ink-900/50 text-zinc-400 hover:text-zinc-100 hover:border-ink-600 transition-colors disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex items-center gap-2 px-3 py-2 border-t border-ink-800 bg-ink-900/60"
      >
        <Sparkles className="w-3.5 h-3.5 text-ember-400 shrink-0" aria-hidden />
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your line to Dana…"
          aria-label="Your line to the prospect"
          className="flex-1 bg-transparent text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
        />
        <button type="submit" disabled={pending || !input.trim()} aria-label="Send" className="disabled:opacity-40">
          <Send className="w-3.5 h-3.5 text-ember-400" aria-hidden />
        </button>
      </form>

      {showNudge && (
        <a
          href="#book"
          className="block text-center text-[10px] text-ember-200/90 bg-ember-400/10 border-t border-ember-400/20 px-3 py-2 hover:bg-ember-400/15 transition-colors"
        >
          This is what every rep&apos;s calls could sound like — see it on yours →
        </a>
      )}
    </div>
  );
}
