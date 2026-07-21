"use client";

/**
 * "Talk to Jeff" — scripted demo of the AI first-responder (founder 2026-07-22 rebuild).
 *
 * Faithful to the real Jeff (src/lib/care/prompt.ts): plain prose, warm, 1–4 sentences, grounded in the
 * ELOSTATE product context, and it HANDS OFF honestly on account/billing actions (the real prompt appends
 * a [[HANDOFF]] sentinel that the route strips + then posts a handoff notice — modeled here). Scripted, not
 * a live model call (founder chose scripted-interactive). §3.4: Jeff's answers only claim real features.
 */

import { useEffect, useRef, useState } from "react";
import { Bot, Send, User, ArrowRightLeft } from "lucide-react";

type Msg = { from: "customer" | "jeff" | "system"; text: string };

type Canned = { q: string; a: string; handoff?: boolean };

// Faithful scripted answers. The handoff one models the real [[HANDOFF]] behavior (sentinel stripped,
// ai_responding -> false, handoff notice posted).
const CANNED: Canned[] = [
  {
    q: "does this actually help my team make decisions, or is it just another chat app?",
    a: "Yeah, it does — that's one of the core things it's built for. There's a guided flow called Decision Dialogues that walks your team through a real decision: laying out the situation, surfacing options, capturing each person's take, and recording both the choice and the reasoning behind it. So the next time a similar call comes up, you can see why you decided what you did.",
  },
  {
    q: "what makes this different from just using ChatGPT?",
    a: "Fair question. ChatGPT is a smart assistant for one person that forgets you when you close the tab. ELOSTATE is a team-level layer: it captures your team's reasoning as it happens, surfaces patterns across people and time, and coaches individuals to communicate more clearly — grounded in this company's own history, not a blank slate every time.",
  },
  {
    q: "can I get a refund on a double charge?",
    handoff: true,
    a: "I'm really sorry about the double charge — that's exactly the kind of thing we make right. A refund needs a teammate who can action your account, so let me bring one in right here. One moment.",
  },
  {
    q: "how much does it cost?",
    handoff: true,
    a: "Great question — we're pilot-stage and invite-only right now, so pricing is handled case by case. Let me bring in a teammate who can give you the specifics for your team.",
  },
];

const HANDOFF_NOTICE =
  "You're being connected with a member of our support team. They'll pick up right here and have everything you've shared so far.";

export function JeffLiveChat() {
  const [msgs, setMsgs] = useState<Msg[]>([
    {
      from: "jeff",
      text: "Hi, I'm Jeff. Ask anything — pricing, how it works, whether we're a fit. A real person sees these too.",
    },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [handedOff, setHandedOff] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [msgs, pending]);

  function match(text: string): Canned {
    const t = text.toLowerCase();
    if (/(refund|charge|charged|billing|invoice|cancel|account)/.test(t)) return CANNED[2]!;
    if (/(price|pricing|cost|how much|\$)/.test(t)) return CANNED[3]!;
    if (/(chatgpt|gpt|different|difference|vs|compare)/.test(t)) return CANNED[1]!;
    if (/(decision|decide|meeting|make )/.test(t)) return CANNED[0]!;
    return CANNED[1]!; // sensible default: the differentiation answer
  }

  function send(text: string) {
    const clean = text.trim();
    if (!clean || pending || handedOff) return;
    setInput("");
    setMsgs((m) => [...m, { from: "customer", text: clean }]);
    setPending(true);
    const reply = match(clean);
    window.setTimeout(() => {
      setMsgs((m) => [...m, { from: "jeff", text: reply.a }]);
      if (reply.handoff) {
        window.setTimeout(() => {
          setMsgs((m) => [...m, { from: "system", text: HANDOFF_NOTICE }]);
          setHandedOff(true);
        }, 650);
      }
      setPending(false);
    }, 720);
  }

  const suggestions = CANNED.filter((c) => !msgs.some((m) => m.from === "customer" && m.text === c.q));

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
              onClick={() => send(s.q)}
              disabled={pending}
              className="text-[10px] text-left px-2 py-1 rounded-md border border-ink-700 bg-ink-900/50 text-zinc-400 hover:text-zinc-100 hover:border-ink-600 transition-colors disabled:opacity-50"
            >
              {s.q}
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
