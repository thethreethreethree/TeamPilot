"use client";

/**
 * "Talk to Jeff" — LIVE demo of the AI first-responder (founder 2026-07-22: wired to the real engine).
 *
 * Calls POST /api/care/demo/ask, which runs the EXACT production Care path (buildCareSystemPrompt with
 * the ELOSTATE product context + generateCareReply) — the same AI response system as the real widget,
 * not a script. It hands off honestly on account/billing actions (the real [[HANDOFF]] sentinel is
 * detected + stripped server-side; the endpoint returns { handoff }). Public + rate-limited server-side.
 */

import { useEffect, useRef, useState } from "react";
import { Bot, Send, User, ArrowRightLeft } from "lucide-react";

type Msg = { from: "customer" | "jeff" | "system"; text: string };

// Starter prompts a prospect can click. These are just examples — Jeff answers ANY typed question live.
const SUGGESTIONS: string[] = [
  "What makes this different from just using ChatGPT?",
  "How does C.A.R.E help my support agents work better?",
  "Does this actually help my team make decisions?",
  "Can I get a refund on a double charge?",
];

const HANDOFF_NOTICE =
  "You're being connected with a member of our support team. They'll pick up right here and have everything you've shared so far.";

const ERROR_REPLY =
  "I couldn't reach my brain just then — mind trying that again? A real person on the ELOSTATE team can also pick this up from a booked demo.";

export function JeffLiveChat() {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      from: "jeff",
      text: "Hi, I'm Jeff — the real AI that answers first for teams running C.A.R.E. This is the live engine, not a script. Ask me anything: pricing, how it works, or how it helps your support agents.",
    },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [handedOff, setHandedOff] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs, pending]);

  async function send(text: string) {
    const clean = text.trim();
    if (!clean || pending || handedOff) return;
    setInput("");
    // Snapshot history BEFORE adding the new turn, mapped to the endpoint's {role, content} shape.
    const history = msgs
      .filter((m) => m.from !== "system")
      .slice(-12)
      .map((m) => ({
        role: (m.from === "customer" ? "user" : "assistant") as "user" | "assistant",
        content: m.text,
      }));
    setMsgs((m) => [...m, { from: "customer", text: clean }]);
    setPending(true);
    try {
      const res = await fetch("/api/care/demo/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: clean, history }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        reply?: string;
        handoff?: boolean;
        error?: string;
      };
      const reply = res.ok && data.reply ? data.reply : ERROR_REPLY;
      setMsgs((m) => [...m, { from: "jeff", text: reply }]);
      if (res.ok && data.handoff) {
        setMsgs((m) => [...m, { from: "system", text: HANDOFF_NOTICE }]);
        setHandedOff(true);
      }
    } catch {
      setMsgs((m) => [...m, { from: "jeff", text: ERROR_REPLY }]);
    } finally {
      setPending(false);
    }
  }

  const suggestions = SUGGESTIONS.filter(
    (q) => !msgs.some((m) => m.from === "customer" && m.text === q)
  );

  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-950 overflow-hidden flex flex-col max-w-md w-full mx-auto shadow-glow-ember-soft">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-ember-400 text-[#09090B]">
        <div className="w-7 h-7 rounded-full bg-[#09090B]/10 flex items-center justify-center">
          <Bot className="w-4 h-4" aria-hidden />
        </div>
        <div className="leading-tight">
          <p className="text-xs font-bold">Jeff</p>
          <p className="text-[10px] opacity-70">AI first-responder · answers in seconds</p>
        </div>
        <span className="ml-auto text-[10px] font-semibold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" /> Online
        </span>
      </div>

      <div className="p-3 space-y-2.5 flex-1 min-h-[240px] max-h-[300px] overflow-y-auto">
        {msgs.map((m, i) =>
          m.from === "system" ? (
            <p key={i} className="text-[10px] text-center text-zinc-500 italic px-3 leading-relaxed flex items-center gap-1.5 justify-center">
              <ArrowRightLeft className="w-3 h-3 shrink-0" aria-hidden /> {m.text}
            </p>
          ) : (
            <div key={i} className={`flex ${m.from === "customer" ? "justify-end" : "justify-start"}`}>
              <div className="max-w-[85%]">
                {m.from === "jeff" && (
                  <p className="text-[9px] text-zinc-500 mb-0.5 flex items-center gap-1">
                    <Bot className="w-2.5 h-2.5" aria-hidden /> Jeff
                  </p>
                )}
                <div
                  className={`text-[11px] leading-relaxed px-2.5 py-1.5 rounded-lg ${
                    m.from === "customer"
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

      {/* Suggestions */}
      {!handedOff && suggestions.length > 0 && (
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
        {handedOff ? (
          <p className="flex-1 text-[11px] text-zinc-500 italic flex items-center gap-1.5">
            <User className="w-3 h-3" aria-hidden /> A specialist is joining — this is where the handoff card would capture your details.
          </p>
        ) : (
          <>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Jeff anything…"
              aria-label="Ask Jeff"
              className="flex-1 bg-transparent text-[11px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
            />
            <button type="submit" disabled={pending || !input.trim()} aria-label="Send" className="disabled:opacity-40">
              <Send className="w-3.5 h-3.5 text-ember-400" aria-hidden />
            </button>
          </>
        )}
      </form>
    </div>
  );
}
