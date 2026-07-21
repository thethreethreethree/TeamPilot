"use client";

/**
 * C.A.R.E interactive walkthrough — the "click-by-click" demo (ask 3).
 *
 * A self-contained state machine a salesperson drives in front of a
 * prospect. NO backend, NO auth, NO live AI cost — pure client state, so
 * it can never fail live in the room. It SIMULATES the real product flow
 * (AI first-responder → honest handoff → context capture → armed agent →
 * internal tools → resolution); the copy is grounded in the actual
 * behavior mapped from the codebase, not an idealized mockup.
 *
 * Two panels advance together on Next ▸:
 *   left  = what the CUSTOMER sees (the Jeff chat widget)
 *   right = what the AGENT sees (the inbox)
 * Each step carries a caption ("what just happened") + a why ("why it
 * matters"). The four internal tools shown — Coach, Co-Pilot, Summarize,
 * Formulate — are the real C.A.R.E agent tools (NOT "Dissect", which is a
 * separate ELOSTATE feature).
 */

import { useState } from "react";
import {
  MessageCircle,
  Phone,
  Paperclip,
  Send,
  Bot,
  User,
  Sparkles,
  GraduationCap,
  ScrollText,
  PenLine,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

type Speaker = "customer" | "jeff" | "agent" | "system";

type Bubble = { from: Speaker; text: string };

type CapturedField = { label: string; value: string };

type ToolKey = "coach" | "copilot" | "summarize" | "formulate";

type InboxState = {
  status: string;
  statusTone: "quiet" | "ai" | "needs" | "live" | "resolved";
  captured: CapturedField[] | null;
  transcriptNote: string;
  activeTool: ToolKey | null;
  toolNote: string | null;
};

type Step = {
  phase: string;
  best?: boolean;
  chat: Bubble[];
  showCard?: boolean;
  showWaiting?: boolean;
  inbox: InboxState;
  caption: string;
  why: string;
};

// The concern topic and order number a prospect would recognise from a
// real e-commerce handoff (mirrors the real ecommerce topic set).
const STEPS: Step[] = [
  {
    phase: "11:04pm — a customer reaches out",
    chat: [
      {
        from: "customer",
        text: "Hi — my order still hasn't shipped and it's been over a week. Order #10432.",
      },
    ],
    inbox: {
      status: "No agent online",
      statusTone: "quiet",
      captured: null,
      transcriptNote: "Nothing in the queue yet — it's the middle of the night.",
      activeTool: null,
      toolNote: null,
    },
    caption: "A customer reaches out at 11pm. Not a single agent is online.",
    why: "Most tools make them wait for business hours or bury them in a FAQ. C.A.R.E answers now — this is the default, out of the box.",
  },
  {
    phase: "Jeff answers in seconds",
    chat: [
      {
        from: "customer",
        text: "Hi — my order still hasn't shipped and it's been over a week. Order #10432.",
      },
      {
        from: "jeff",
        text: "Hi, I'm Jeff. So sorry about the wait on #10432 — that's frustrating. Let me take a look. Was this shipping to the address on the order, or a new one?",
      },
    ],
    inbox: {
      status: "AI responding",
      statusTone: "ai",
      captured: null,
      transcriptNote: "Jeff is handling it live. No agent action needed.",
      activeTool: null,
      toolNote: null,
    },
    caption: "Jeff — the AI first-responder — replies instantly, 24/7.",
    why: "The customer is heard in seconds, not queued. Jeff is grounded in this business's own product context, so the answer is on-brand, not generic.",
  },
  {
    phase: "Jeff knows what it can't do",
    chat: [
      {
        from: "customer",
        text: "I just want a refund at this point, honestly.",
      },
      {
        from: "jeff",
        text: "Completely understand — and I want to make that right. A refund needs a teammate who can action your account, so let me bring one in right here. One moment.",
      },
    ],
    inbox: {
      status: "Needs an agent",
      statusTone: "needs",
      captured: null,
      transcriptNote: "Conversation flips from 'AI responding' → 'Needs agent'. A soft chime hits the inbox.",
      activeTool: null,
      toolNote: null,
    },
    caption: "Jeff recognises its limit and hands off honestly — instead of guessing.",
    why: "No hallucinated refund, no dead-end. The handoff is detected reliably by a sentinel the AI emits — not by hoping it phrased the sentence a certain way.",
  },
  {
    phase: "The customer is told — and asked once",
    chat: [
      {
        from: "system",
        text: "You're being connected with a member of our support team. They'll pick up right here and have everything you've shared so far.",
      },
    ],
    showCard: true,
    inbox: {
      status: "Needs an agent",
      statusTone: "needs",
      captured: null,
      transcriptNote: "The details the customer enters will land in the header — before the agent even opens the chat.",
      activeTool: null,
      toolNote: null,
    },
    caption: "The customer is told a human is coming, and gives their details once.",
    why: "This is the exact moment every other tool wastes — making the customer re-explain to a second responder. C.A.R.E captures it here, so they never repeat themselves.",
  },
  {
    phase: "The agent walks in already armed",
    best: true,
    chat: [
      {
        from: "system",
        text: "You're being connected with a member of our support team. They'll pick up right here and have everything you've shared so far.",
      },
      { from: "agent", text: "Hi, this is Maria — I've got your order right here, give me one sec." },
    ],
    inbox: {
      status: "Live with Maria",
      statusTone: "live",
      captured: [
        { label: "Concern", value: "Order tracking — not shipped" },
        { label: "Order #", value: "10432" },
        { label: "Name", value: "Devan Okoro" },
        { label: "Email", value: "devan@…" },
      ],
      transcriptNote: "The full Jeff transcript sits above the reply box. Maria has read nothing yet and already knows everything.",
      activeTool: null,
      toolNote: null,
    },
    caption: "The agent opens the chat and it's all already there — name, email, concern, order number, and the entire AI conversation.",
    why: "The agent starts at \"let me fix this,\" not \"let me understand this.\" The handoff is diagnostic, not a cold transfer — that is the whole product in one screen.",
  },
  {
    phase: "Four tools make a good agent superhuman",
    chat: [
      { from: "agent", text: "Hi, this is Maria — I've got your order right here, give me one sec." },
      {
        from: "agent",
        text: "Okay — #10432 got stuck at our warehouse. I've refunded it in full and it'll show in 3–5 days. I've also flagged your account so the next order ships priority, on us.",
      },
    ],
    inbox: {
      status: "Live with Maria",
      statusTone: "live",
      captured: [
        { label: "Concern", value: "Order tracking — not shipped" },
        { label: "Order #", value: "10432" },
        { label: "Name", value: "Devan Okoro" },
        { label: "Email", value: "devan@…" },
      ],
      transcriptNote: "Maria typed her intent in one line. Co-Pilot shaped the reply; Coach graded it before she sent.",
      activeTool: "copilot",
      toolNote: "Co-Pilot drafted the full reply and named the move (\"repair + proactive goodwill\"). Coach graded it A- for clarity and resolution-orientation.",
    },
    caption: "Four built-in tools work the thread with the agent — Coach, Co-Pilot, Summarize, Formulate.",
    why: "Efficiency and quality at once: shorter handle time AND warmer, more consistent answers. The mechanism is better individual communication; the result is faster resolution.",
  },
  {
    phase: "Resolved — and the system gets smarter",
    chat: [
      {
        from: "agent",
        text: "Okay — #10432 got stuck at our warehouse. I've refunded it in full and it'll show in 3–5 days. I've also flagged your account so the next order ships priority, on us.",
      },
      { from: "customer", text: "Oh wow — thank you, that's more than I expected. Really appreciate it." },
    ],
    inbox: {
      status: "Resolved",
      statusTone: "resolved",
      captured: [
        { label: "Concern", value: "Order tracking — not shipped" },
        { label: "Order #", value: "10432" },
        { label: "Outcome", value: "Refund + priority reship" },
        { label: "Handle time", value: "6 min" },
      ],
      transcriptNote: "The captured concern rides along on the resolution record — feeding pattern detection over time.",
      activeTool: null,
      toolNote: null,
    },
    caption: "Resolved fast — and the concern is recorded, not thrown away.",
    why: "Recurring concerns surface as patterns; the system learns THIS business with every conversation. Nothing is discarded — the loop closes.",
  },
];

const TOOLS: { key: ToolKey; name: string; icon: typeof GraduationCap; blurb: string }[] = [
  {
    key: "coach",
    name: "Coach",
    icon: GraduationCap,
    blurb: "Grades every agent reply on clarity, observation-vs-accusation phrasing, and resolution-orientation — and grades a draft before it's sent.",
  },
  {
    key: "copilot",
    name: "Co-Pilot",
    icon: Sparkles,
    blurb: "Drafts a full reply unprompted and names the communication move behind it. The reasoning is internal — the customer only sees the polished message.",
  },
  {
    key: "summarize",
    name: "Summarize",
    icon: ScrollText,
    blurb: "A 3–5 sentence catch-up — the ask, what's been tried, what's open, the tone — plus prior similar resolutions worth reusing.",
  },
  {
    key: "formulate",
    name: "Formulate",
    icon: PenLine,
    blurb: "Takes the agent's own one-line intent and shapes it into a warm, on-brand reply. The agent stays in the driver's seat; the system edits.",
  },
];

const TONE_STYLES: Record<InboxState["statusTone"], string> = {
  quiet: "bg-ink-800/60 text-zinc-400 border-ink-800",
  ai: "bg-ember-400/10 text-brand border-ember-400/30",
  needs: "bg-amber-500/15 text-amber-300 border-amber-500/40",
  live: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  resolved: "bg-emerald-500/20 text-emerald-200 border-emerald-500/50",
};

export function CareDemoWalkthrough() {
  const [i, setI] = useState(0);
  const step = STEPS[i];
  const atEnd = i === STEPS.length - 1;

  if (!step) return null; // narrows Step|undefined (noUncheckedIndexedAccess)

  return (
    <div className="rounded-2xl p-4 md:p-6 border border-ink-800 bg-ink-950 shadow-glow-ember-soft">
      {/* Stepper header */}
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
              step.best
                ? "bg-ember-400/15 text-brand border-ember-400/40"
                : "bg-ink-800/60 text-zinc-500 border-ink-800"
            }`}
          >
            {step.best ? "★ the key feature" : `step ${i + 1} of ${STEPS.length}`}
          </span>
          <span className="text-sm font-semibold text-zinc-100 truncate">{step.phase}</span>
        </div>
        <div className="flex items-center gap-1.5" aria-hidden>
          {STEPS.map((_, idx) => (
            <span
              key={idx}
              className={`h-1.5 rounded-full transition-all ${
                idx === i ? "w-6 bg-ember-400" : idx < i ? "w-1.5 bg-ember-400/50" : "w-1.5 bg-ink-700"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Two panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* LEFT — customer widget */}
        <div className="rounded-xl border border-ink-800 bg-ink-950/60 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2.5 bg-ember-400 text-[#09090B]">
            <div className="w-7 h-7 rounded-full bg-[#09090B]/10 flex items-center justify-center">
              <Bot className="w-4 h-4" aria-hidden />
            </div>
            <div className="leading-tight">
              <p className="text-xs font-bold">Jeff</p>
              <p className="text-[10px] opacity-70">Typical reply: a few seconds</p>
            </div>
            <span className="ml-auto text-[10px] font-semibold flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 inline-block" /> Online
            </span>
          </div>

          <div className="p-3 space-y-2.5 min-h-[248px] flex-1">
            {step.chat.map((b, idx) => (
              <ChatBubble key={idx} bubble={b} />
            ))}
            {step.showCard && <HandoffCardMock />}
            {step.showWaiting && (
              <p className="text-[10px] text-center text-zinc-500 italic">
                A member of our team will reply right here…
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 px-3 py-2 border-t border-ink-800 bg-ink-900/60">
            <Paperclip className="w-3.5 h-3.5 text-zinc-500" aria-hidden />
            <span className="flex-1 text-[11px] text-zinc-500">Message…</span>
            <Phone className="w-3.5 h-3.5 text-zinc-500" aria-hidden />
            <Send className="w-3.5 h-3.5 text-brand" aria-hidden />
          </div>
        </div>

        {/* RIGHT — agent inbox */}
        <div className="rounded-xl border border-ink-800 bg-ink-950/60 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-ink-800 bg-ink-900/60">
            <MessageCircle className="w-4 h-4 text-brand" aria-hidden />
            <p className="text-xs font-bold text-zinc-100">Agent inbox</p>
            <span
              className={`ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                TONE_STYLES[step.inbox.statusTone]
              }`}
            >
              {step.inbox.status}
            </span>
          </div>

          <div className="p-3 min-h-[248px] flex-1 flex flex-col gap-2.5">
            {/* Captured header — the payoff */}
            {step.inbox.captured ? (
              <div
                className={`rounded-lg border p-2.5 ${
                  step.best
                    ? "border-ember-400/50 bg-ember-400/[0.06] shadow-glow-ember-soft"
                    : "border-ink-800 bg-ink-900/50"
                }`}
              >
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  {step.inbox.captured.map((f) => (
                    <div key={f.label} className="min-w-0">
                      <p className="text-[9px] uppercase tracking-wider text-zinc-500">{f.label}</p>
                      <p className="text-[11px] font-semibold text-zinc-100 truncate">{f.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-ink-800/60 p-2.5 text-[10px] text-zinc-500 italic">
                No customer context captured yet.
              </div>
            )}

            <p className="text-[11px] text-zinc-400 leading-relaxed flex-1">
              {step.inbox.transcriptNote}
            </p>

            {/* Tool row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {TOOLS.map((t) => {
                const Icon = t.icon;
                const active = step.inbox.activeTool === t.key;
                return (
                  <span
                    key={t.key}
                    className={`text-[10px] font-medium px-2 py-1 rounded-md border flex items-center gap-1 transition-colors ${
                      active
                        ? "bg-ember-400 text-[#09090B] border-ember-400"
                        : "bg-ink-800/60 text-zinc-400 border-ink-800"
                    }`}
                  >
                    <Icon className="w-3 h-3" aria-hidden /> {t.name}
                  </span>
                );
              })}
            </div>

            {step.inbox.toolNote && (
              <div className="rounded-lg border border-ember-400/30 bg-ember-400/[0.05] p-2.5">
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  <Sparkles className="w-3 h-3 text-brand inline mr-1 -mt-0.5" aria-hidden />
                  {step.inbox.toolNote}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Caption + why */}
      <div className="mt-4 rounded-xl border border-ink-800 bg-ink-900/40 p-4">
        <p className="text-sm font-semibold text-zinc-100 flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-brand mt-0.5 shrink-0" aria-hidden />
          {step.caption}
        </p>
        <p className="text-xs text-zinc-400 leading-relaxed mt-1.5 pl-6">
          <span className="text-brand font-semibold">Why it matters — </span>
          {step.why}
        </p>
      </div>

      {/* Controls */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setI((v) => Math.max(0, v - 1))}
          disabled={i === 0}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-ink-800 text-zinc-400 hover:text-zinc-100 hover:border-ink-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" aria-hidden /> Back
        </button>

        <span className="text-[11px] font-mono text-zinc-500">
          {i + 1} / {STEPS.length}
        </span>

        {atEnd ? (
          <button
            type="button"
            onClick={() => setI(0)}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg border border-ink-800 text-zinc-400 hover:text-zinc-100 hover:border-ink-600 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden /> Replay
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setI((v) => Math.min(STEPS.length - 1, v + 1))}
            className="flex items-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-lg bg-ember-400 hover:bg-ember-500 text-[#09090B] shadow-glow transition-all"
          >
            Next <ArrowRight className="w-3.5 h-3.5" aria-hidden />
          </button>
        )}
      </div>

      {/* Tool legend under the walkthrough */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {TOOLS.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.key} className="rounded-lg border border-ink-800 bg-ink-900/30 p-3">
              <p className="text-xs font-semibold text-zinc-100 flex items-center gap-1.5 mb-1">
                <Icon className="w-3.5 h-3.5 text-brand" aria-hidden /> {t.name}
              </p>
              <p className="text-[11px] text-zinc-400 leading-relaxed">{t.blurb}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChatBubble({ bubble }: { bubble: Bubble }) {
  if (bubble.from === "system") {
    return (
      <p className="text-[10px] text-center text-zinc-500 italic px-4 leading-relaxed">
        {bubble.text}
      </p>
    );
  }
  const isCustomer = bubble.from === "customer";
  const Icon = bubble.from === "jeff" ? Bot : bubble.from === "agent" ? User : User;
  const label = bubble.from === "jeff" ? "Jeff" : bubble.from === "agent" ? "Maria" : "";
  return (
    <div className={`flex ${isCustomer ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] ${isCustomer ? "order-2" : ""}`}>
        {!isCustomer && (
          <p className="text-[9px] text-zinc-500 mb-0.5 flex items-center gap-1">
            <Icon className="w-2.5 h-2.5" aria-hidden /> {label}
          </p>
        )}
        <div
          className={`text-[11px] leading-relaxed px-2.5 py-1.5 rounded-lg ${
            isCustomer
              ? "bg-ember-400 text-[#09090B] rounded-br-sm"
              : bubble.from === "agent"
                ? "bg-emerald-500/15 text-emerald-100 border border-emerald-500/30 rounded-bl-sm"
                : "bg-ink-800 text-zinc-100 border border-ink-800 rounded-bl-sm"
          }`}
        >
          {bubble.text}
        </div>
      </div>
    </div>
  );
}

/** A compact mock of the real HandoffCard (name/email/concern/order#). */
function HandoffCardMock() {
  return (
    <div className="rounded-lg border border-ember-400/30 bg-ink-900/70 p-2.5 space-y-1.5">
      <p className="text-[10px] font-semibold text-zinc-100 flex items-center gap-1">
        <ShieldCheck className="w-3 h-3 text-brand" aria-hidden /> Help us connect you
      </p>
      <MockField label="Name" value="Devan Okoro" />
      <MockField label="Email (optional)" value="devan@…" />
      <MockField label="What's this about?" value="Order tracking — not shipped ▾" />
      <MockField label="Order #" value="10432" />
      <div className="flex items-center gap-1.5 pt-0.5">
        <span className="text-[10px] font-semibold px-2.5 py-1 rounded-md bg-ember-400 text-[#09090B]">
          Connect me
        </span>
        <span className="text-[10px] text-zinc-500 px-2 py-1">Skip</span>
      </div>
    </div>
  );
}

function MockField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-zinc-500">{label}</p>
      <div className="text-[11px] text-zinc-100 bg-ink-950/60 border border-ink-800 rounded px-2 py-1 mt-0.5">
        {value}
      </div>
    </div>
  );
}
