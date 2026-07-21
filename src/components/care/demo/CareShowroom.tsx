"use client";

/**
 * C.A.R.E interactive showroom — the agent workstation (founder 2026-07-22 rebuild).
 *
 * SPEC (founder, answered via AskUserQuestion): scripted-interactive (self-contained, no backend, faithful
 * to the real output shapes), agent-workstation structure (one sample conversation the prospect runs the
 * tools ON), the six named features only. Deployed in-product at elostate.com/care/demo — NOT an artifact.
 *
 * GOVERNED (read this session from the actual files):
 *  - AMD-006 four layers: L1 structure (this component owns the mock + faithful data; page composes it),
 *    L2 effectivity (every tool button produces its result — verified by interaction/screenshot, not just
 *    typecheck), L3 composition / §A16 (all five agent tools operate on the SAME thread and their outputs
 *    are mutually consistent — e.g. Co-Pilot's precedent == Summarize's priorSimilar), L4 UI (theme-aware,
 *    on-brand, both light+dark verified).
 *  - §A11: Coach is shown as an OBSERVATION (classification) + a cited book principle + a suggested
 *    revision + the why — coaching, not a bare "good/bad" verdict.
 *  - §3.4: only the 7 VERIFIED books are cited (Voss, Cialdini, Crucial Conversations, Rosenberg, Heath,
 *    Zinsser, TED/Anderson). Carnegie/Gladwell/Stone-Patton-Heen are NOT cited (unverified in the KB).
 *  - The output SHAPES mirror the real routes (ask-coach, co-pilot, formulate, summarize, dissect) exactly.
 *
 * All data below is a faithful SIMULATION of real output — not live model calls.
 */

import { useState } from "react";
import {
  MessageCircle,
  ScrollText,
  Sparkles,
  PenLine,
  GraduationCap,
  Stethoscope,
  BookOpen,
  Quote,
  Eye,
  Lightbulb,
  ArrowRight,
  Loader2,
  User,
  Check,
} from "lucide-react";

// ── The one shared conversation every tool operates on (A16 composition) ──────────────
type Turn = { from: "customer" | "agent" | "jeff"; name?: string; text: string };
const THREAD: Turn[] = [
  {
    from: "customer",
    name: "Priya M.",
    text: "Hi — I've just been charged $49 twice this month, both on the 14th. I actually emailed about this three days ago and never heard back. Can someone please sort it out?",
  },
  {
    from: "jeff",
    text: "Hi, I'm Jeff. I'm really sorry about the double charge — and about the wait on your earlier email. I can see two $49 charges on the 14th. Let me bring in a teammate who can action the refund on your account right away.",
  },
  {
    from: "customer",
    name: "Priya M.",
    text: "Thank you. I just want the duplicate refunded — it's the silence that's frustrating, honestly.",
  },
];

// ── Faithful scripted outputs (shapes mirror the real routes) ─────────────────────────

// Summarize route → { summary (3-5 sentences), priorSimilar: [{id, issueSummary, category}] }
const SUMMARIZE = {
  summary:
    "Priya was charged $49 twice on the 14th and is asking for the duplicate to be refunded. She had already emailed about this three days ago and got no reply, so the wait is now part of the problem. Jeff has acknowledged both the charge and the delay and handed off for a refund. What's still open is actually issuing the refund and closing the loop on why her first email went unanswered. Her tone is polite but tired — a fast, concrete fix matters here.",
  priorSimilar: [
    { id: "res_9f2a", issueSummary: "Duplicate charge on renewal", category: "billing" },
    { id: "res_71c4", issueSummary: "Refund + written confirmation for double bill", category: "billing" },
  ],
};

// Co-Pilot route → { draft, reasoning (INTERNAL), precedents: [{id, issueSummary, category, whatWorked}], precedentsUsed }
const COPILOT = {
  draft:
    "Priya, I'm sorry — a double charge and a missed email is not the experience we want you to have. I can see both $49 charges from the 14th, and I've just refunded the duplicate; you'll see it back on your card in 5–7 business days. I'll also email you the confirmation the moment it clears so you have it in writing.",
  reasoning:
    "Applied the [refund-within-7-days + written confirmation] precedent — same shape as the case from 4 days ago. Led with acknowledgment of BOTH the charge and the ignored email, because Priya named the silence as the real frustration.",
  precedents: [
    {
      id: "res_9f2a",
      issueSummary: "Duplicate charge on renewal",
      category: "billing",
      whatWorked: "Refunded the duplicate same-day, sent written confirmation, no escalation needed.",
    },
  ],
  precedentsUsed: 1,
};

// Formulate route → { draft, reasoning } from an agent intent. A few presets + the shape.
const FORMULATE_PRESETS: { label: string; intent: string; draft: string; reasoning: string }[] = [
  {
    label: "Refund + timing, be warm",
    intent: "tell her I'm refunding the duplicate and it takes 5-7 days, and be warm about the wait",
    draft:
      "You're completely right to want this sorted, Priya — I'm sorry it took a nudge. I've refunded the duplicate $49 just now; it'll land back on your card within 5–7 business days, and I'll send you the confirmation in writing so you're not left wondering again.",
    reasoning:
      "Turned your 'refund + timing' intent into an answer that also repairs the silence she flagged, and ended with a concrete written follow-up so the 'no reply' doesn't repeat.",
  },
  {
    label: "Explain why the 1st email slipped",
    intent: "be honest that her first email got missed and we're fixing how that happens",
    draft:
      "I also want to be straight with you: your first email slipped through a routing gap on our side, and that's on us, not you. I've flagged it so billing questions like yours get picked up faster. In the meantime the duplicate is refunded and the confirmation is on its way.",
    reasoning:
      "Owned the miss plainly (no excuses), named a concrete fix, then closed on the resolution — honesty first, then the reassurance.",
  },
];

// Ask-Coach route → CoachAnalysisResponse. Demo shows a rough agent draft being coached.
const COACH_DRAFT =
  "You were only charged once, the second one is just a pending authorization. You'd see that if you checked your statement properly.";
const COACH = {
  classification: "negative" as const,
  needsImprovement: true,
  improvement: {
    suggestedRevision:
      "I hear you — being charged twice is stressful. Looking now, one of the two is a pending authorization that should drop off, but I don't want you carrying that uncertainty: I'll refund the duplicate outright and confirm in writing so you're covered either way.",
    principleCited: { name: "Contrasting Statement", book: "Crucial Conversations", sectionRef: "2.6" },
    secondaryPrinciple: { name: "Clarity, Simplicity, Brevity, Humanity", book: "On Writing Well", sectionRef: "1.1" },
    whyContext:
      "Priya already said the silence is what's frustrating her — telling her to 'check her statement properly' reads as blame at exactly the moment she needs to feel helped.",
    whySentence:
      "Swapping the correction for an acknowledgment + a concrete refund removes the accusation while keeping your real point (one charge may be a pending auth) — and it ends the uncertainty instead of arguing about it.",
  },
  conversationStarters: [
    "Show me a shorter version",
    "What would Voss's labeling look like here?",
    "Why Contrasting Statement and not OFNR?",
  ],
};

// Dissect route → ConversationDissect (faithful type).
const DISSECT = {
  hasSignal: true,
  summary:
    "A customer reported a duplicate $49 charge and, more pointedly, that an earlier email about it went unanswered for three days. The AI acknowledged both and handed off for a refund; the customer's own words locate the real damage in the silence, not the charge.",
  problem: {
    statement: "The customer's frustration is driven by being ignored, not by the duplicate charge itself.",
    whyItMatters:
      "The charge is a two-minute refund; the unanswered email is the thing that put the relationship at risk. Fixing only the charge leaves the actual wound open.",
  },
  evidence: [
    { observation: "The customer foregrounds the delay, not the money", excerpt: "I actually emailed about this three days ago and never heard back" },
    { observation: "She names the silence as the real problem herself", excerpt: "it's the silence that's frustrating, honestly" },
  ],
  rootCause:
    "Her first billing email wasn't routed to a human, so it sat unanswered — the charge was always fixable, but the missing acknowledgment is what escalated it.",
  outsideView:
    "A neutral observer sees a trivial billing fix wrapped in a support-process gap: the team could resolve the money in seconds, but from the customer's seat, three days of nothing said 'you don't matter.'",
  anglesToConsider: [
    { angle: "Refund AND explicitly address the missed email, not just the charge", why: "The silence is what she flagged; ignoring it 'fixes' the wrong problem." },
    { angle: "Check why the first email never reached a human", why: "If billing emails can go unrouted, the next Priya is already in the queue." },
  ],
  guidingQuestion:
    "The refund is easy — what would have had to happen in the first 24 hours for Priya to never have felt ignored at all?",
};

type ToolKey = "summarize" | "copilot" | "formulate" | "coach" | "dissect";
const TOOLS: { key: ToolKey; name: string; icon: typeof ScrollText; blurb: string }[] = [
  { key: "summarize", name: "Summarize", icon: ScrollText, blurb: "Catch up on the thread in 3–5 sentences" },
  { key: "copilot", name: "Co-Pilot", icon: Sparkles, blurb: "Draft the reply + name the move" },
  { key: "formulate", name: "Formulate", icon: PenLine, blurb: "Shape your own intent into a reply" },
  { key: "coach", name: "Coach", icon: GraduationCap, blurb: "Grade a draft against the books" },
  { key: "dissect", name: "Dissect", icon: Stethoscope, blurb: "Diagnose the real problem" },
];

export function CareShowroom() {
  // Default to a live result (not an empty "pick a tool" state) — a prospect lands on a working tool,
  // then the buttons invite running the others (Layer-2 effectivity is visible immediately).
  const [active, setActive] = useState<ToolKey | null>("summarize");
  const [thinking, setThinking] = useState(false);
  const [formulateIdx, setFormulateIdx] = useState(0);

  function run(tool: ToolKey) {
    if (thinking) return;
    setActive(tool);
    setThinking(true);
    // brief "working" beat so it feels like the tool is running, then reveal.
    window.setTimeout(() => setThinking(false), 620);
  }

  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-950 shadow-glow-ember-soft overflow-hidden">
      {/* Workstation chrome */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-ink-800 bg-ink-900/70">
        <MessageCircle className="w-4 h-4 text-ember-400" aria-hidden />
        <span className="text-xs font-bold text-zinc-100">C.A.R.E agent workstation</span>
        <span className="ml-auto text-[10px] font-mono text-zinc-500">billing · #10432 · live-style demo</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
        {/* LEFT — the shared conversation */}
        <div className="p-4 border-b lg:border-b-0 lg:border-r border-ink-800 min-h-[360px]">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">The conversation your tools work on</p>
          <div className="space-y-3">
            {THREAD.map((t, i) => (
              <ThreadBubble key={i} turn={t} />
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-ink-800 bg-ink-900/60 px-3 py-2">
            <span className="text-[11px] text-zinc-500 flex-1">Your reply…</span>
            <span className="text-[10px] text-zinc-600">the tools help you write it →</span>
          </div>
        </div>

        {/* RIGHT — tools + result */}
        <div className="p-4 flex flex-col min-h-[360px]">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">
            Click a tool — watch it work this thread
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {TOOLS.map((t) => {
              const Icon = t.icon;
              const on = active === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => run(t.key)}
                  aria-pressed={on}
                  className={`text-left rounded-lg border p-2.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-400/60 ${
                    on
                      ? "border-ember-400 bg-ember-400/10"
                      : "border-ink-800 bg-ink-900/40 hover:border-ink-600"
                  }`}
                >
                  <span className={`flex items-center gap-1.5 text-xs font-bold ${on ? "text-ember-300" : "text-zinc-100"}`}>
                    <Icon className="w-3.5 h-3.5" aria-hidden /> {t.name}
                  </span>
                  <span className="block text-[10px] text-zinc-500 mt-0.5 leading-tight">{t.blurb}</span>
                </button>
              );
            })}
          </div>

          {/* Result */}
          <div className="flex-1 rounded-xl border border-ink-800 bg-ink-900/40 p-3.5 overflow-hidden">
            {active === null ? (
              <div className="h-full flex flex-col items-center justify-center text-center gap-2 py-8">
                <Sparkles className="w-5 h-5 text-zinc-600" aria-hidden />
                <p className="text-[11px] text-zinc-500 max-w-[220px]">
                  Pick a tool above. Each one runs on Priya&apos;s conversation — the same thread, five different
                  jobs.
                </p>
              </div>
            ) : thinking ? (
              <div className="h-full flex items-center justify-center gap-2 text-zinc-500 text-xs">
                <Loader2 className="w-4 h-4 animate-spin text-ember-400" aria-hidden />
                {active === "coach" ? "Grading against the books…" : active === "dissect" ? "Diagnosing…" : "Working the thread…"}
              </div>
            ) : (
              <div className="fade-in-result">
                {active === "summarize" && <SummarizePanel />}
                {active === "copilot" && <CopilotPanel />}
                {active === "formulate" && (
                  <FormulatePanel idx={formulateIdx} setIdx={setFormulateIdx} />
                )}
                {active === "coach" && <CoachPanel />}
                {active === "dissect" && <DissectPanel />}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`.fade-in-result{animation:careFade .28s ease-out}@keyframes careFade{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}`}</style>
    </div>
  );
}

function ThreadBubble({ turn }: { turn: Turn }) {
  const isCust = turn.from === "customer";
  return (
    <div className={`flex ${isCust ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[88%] ${isCust ? "" : "text-right"}`}>
        <p className="text-[9px] text-zinc-500 mb-0.5 flex items-center gap-1">
          {isCust ? <User className="w-2.5 h-2.5" aria-hidden /> : null}
          {turn.from === "customer" ? turn.name : turn.from === "jeff" ? "Jeff · AI" : "Agent"}
        </p>
        <div
          className={`inline-block text-left text-[11px] leading-relaxed px-2.5 py-1.5 rounded-lg ${
            isCust
              ? "bg-ink-800 text-zinc-100 border border-ink-700"
              : turn.from === "jeff"
                ? "bg-ember-400/10 text-ember-100 border border-ember-400/25"
                : "bg-emerald-500/12 text-emerald-100 border border-emerald-500/30"
          }`}
        >
          {turn.text}
        </div>
      </div>
    </div>
  );
}

function ResultHeader({ icon: Icon, title }: { icon: typeof ScrollText; title: string }) {
  return (
    <p className="text-xs font-bold text-ember-300 flex items-center gap-1.5 mb-2">
      <Icon className="w-3.5 h-3.5" aria-hidden /> {title}
    </p>
  );
}

function SummarizePanel() {
  return (
    <div>
      <ResultHeader icon={ScrollText} title="Summarize" />
      <p className="text-[12px] text-zinc-200 leading-relaxed">{SUMMARIZE.summary}</p>
      <p className="text-[10px] uppercase tracking-widest text-zinc-500 mt-3 mb-1.5">Prior similar resolutions</p>
      <div className="space-y-1.5">
        {SUMMARIZE.priorSimilar.map((p) => (
          <div key={p.id} className="flex items-center gap-2 text-[11px]">
            <BookOpen className="w-3 h-3 text-zinc-500 shrink-0" aria-hidden />
            <span className="text-zinc-200">{p.issueSummary}</span>
            <span className="text-[9px] text-zinc-500 border border-ink-700 rounded px-1.5 py-0.5">{p.category}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function CopilotPanel() {
  return (
    <div>
      <ResultHeader icon={Sparkles} title="Co-Pilot · drafted for you" />
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.07] p-2.5">
        <p className="text-[12px] text-emerald-50 leading-relaxed">{COPILOT.draft}</p>
      </div>
      <div className="mt-2.5 rounded-lg border border-ember-400/25 bg-ember-400/[0.05] p-2.5">
        <p className="text-[9px] uppercase tracking-widest text-ember-300 mb-1 flex items-center gap-1">
          <Sparkles className="w-2.5 h-2.5" aria-hidden /> The move (internal — the customer never sees this)
        </p>
        <p className="text-[11px] text-zinc-300 leading-relaxed">{COPILOT.reasoning}</p>
      </div>
      <p className="text-[10px] text-zinc-500 mt-2">
        Built on {COPILOT.precedentsUsed} precedent — <span className="text-zinc-300">{COPILOT.precedents[0]!.issueSummary}</span>:{" "}
        <span className="italic">{COPILOT.precedents[0]!.whatWorked}</span>
      </p>
    </div>
  );
}

function FormulatePanel({ idx, setIdx }: { idx: number; setIdx: (n: number) => void }) {
  const preset = FORMULATE_PRESETS[idx]!;
  return (
    <div>
      <ResultHeader icon={PenLine} title="Formulate · you lead, it shapes" />
      <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">Your intent — pick one</p>
      <div className="flex flex-wrap gap-1.5 mb-2.5">
        {FORMULATE_PRESETS.map((p, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setIdx(i)}
            className={`text-[10px] px-2 py-1 rounded-md border transition-colors ${
              i === idx ? "border-ember-400 bg-ember-400/10 text-ember-300" : "border-ink-700 bg-ink-900/40 text-zinc-400 hover:text-zinc-100"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <p className="text-[11px] text-zinc-400 italic mb-2.5 border-l-2 border-ink-700 pl-2">
        &ldquo;{preset.intent}&rdquo;
      </p>
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.07] p-2.5">
        <p className="text-[9px] uppercase tracking-widest text-emerald-300 mb-1 flex items-center gap-1">
          <ArrowRight className="w-2.5 h-2.5" aria-hidden /> Shaped into
        </p>
        <p className="text-[12px] text-emerald-50 leading-relaxed">{preset.draft}</p>
      </div>
      <p className="text-[11px] text-zinc-400 mt-2 leading-relaxed">
        <span className="text-ember-300 font-semibold">Why — </span>
        {preset.reasoning}
      </p>
    </div>
  );
}

function CoachPanel() {
  const c = COACH;
  return (
    <div>
      <ResultHeader icon={GraduationCap} title="Coach · graded against the books" />
      {/* The rough draft being coached */}
      <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Your draft</p>
      <p className="text-[11px] text-zinc-400 italic border-l-2 border-amber-500/50 pl-2 mb-2.5">
        &ldquo;{COACH_DRAFT}&rdquo;
      </p>
      {/* A11: observation (classification) + guidance, not a bare verdict */}
      <div className="flex items-center gap-2 mb-2.5">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/15 text-amber-300">
          reads as: {c.classification}
        </span>
        <span className="text-[10px] text-zinc-500">— here&apos;s the fix, and why</span>
      </div>
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/[0.07] p-2.5 mb-2.5">
        <p className="text-[9px] uppercase tracking-widest text-emerald-300 mb-1">Suggested revision</p>
        <p className="text-[12px] text-emerald-50 leading-relaxed">{c.improvement.suggestedRevision}</p>
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        <PrincipleChip name={c.improvement.principleCited.name} book={c.improvement.principleCited.book} />
        <PrincipleChip name={c.improvement.secondaryPrinciple.name} book={c.improvement.secondaryPrinciple.book} />
      </div>
      <p className="text-[11px] text-zinc-300 leading-relaxed">{c.improvement.whySentence}</p>
    </div>
  );
}

function PrincipleChip({ name, book }: { name: string; book: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-[10px] rounded-md border border-ember-400/30 bg-ember-400/[0.06] px-2 py-1">
      <BookOpen className="w-2.5 h-2.5 text-ember-300 shrink-0" aria-hidden />
      <span className="text-ember-200 font-semibold">{name}</span>
      <span className="text-zinc-500">· {book}</span>
    </span>
  );
}

function DissectPanel() {
  const d = DISSECT;
  return (
    <div className="space-y-2.5">
      <ResultHeader icon={Stethoscope} title="Dissect · the real problem" />
      <div className="rounded-lg border border-ember-400/30 bg-ember-400/[0.06] p-2.5">
        <p className="text-[9px] uppercase tracking-widest text-ember-300 mb-1">The problem</p>
        <p className="text-[12px] font-semibold text-zinc-100">{d.problem.statement}</p>
        <p className="text-[11px] text-zinc-400 mt-1">{d.problem.whyItMatters}</p>
      </div>
      <div>
        <p className="text-[9px] uppercase tracking-widest text-zinc-500 mb-1 flex items-center gap-1">
          <Quote className="w-2.5 h-2.5" aria-hidden /> Evidence from the thread
        </p>
        {d.evidence.map((e, i) => (
          <div key={i} className="mb-1.5">
            <p className="text-[11px] text-zinc-300">{e.observation}</p>
            <p className="text-[10px] text-zinc-500 italic border-l-2 border-ink-700 pl-2">&ldquo;{e.excerpt}&rdquo;</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="rounded-lg border border-ink-800 bg-ink-950/60 p-2">
          <p className="text-[9px] uppercase tracking-widest text-zinc-500 mb-0.5">Root cause</p>
          <p className="text-[11px] text-zinc-300 leading-relaxed">{d.rootCause}</p>
        </div>
        <div className="rounded-lg border border-ink-800 bg-ink-950/60 p-2">
          <p className="text-[9px] uppercase tracking-widest text-zinc-500 mb-0.5 flex items-center gap-1">
            <Eye className="w-2.5 h-2.5" aria-hidden /> Outside view
          </p>
          <p className="text-[11px] text-zinc-300 leading-relaxed">{d.outsideView}</p>
        </div>
      </div>
      <div className="rounded-lg border border-ink-800 bg-ink-950/60 p-2">
        <p className="text-[9px] uppercase tracking-widest text-zinc-500 mb-1 flex items-center gap-1">
          <Lightbulb className="w-2.5 h-2.5" aria-hidden /> Angles to consider — you decide
        </p>
        {d.anglesToConsider.map((a, i) => (
          <p key={i} className="text-[11px] text-zinc-300 leading-relaxed mb-0.5">
            <span className="text-zinc-100 font-medium">{a.angle}</span> — <span className="text-zinc-500">{a.why}</span>
          </p>
        ))}
      </div>
      <p className="text-[11px] text-ember-200 italic flex items-start gap-1.5">
        <Check className="w-3 h-3 mt-0.5 shrink-0" aria-hidden /> {d.guidingQuestion}
      </p>
    </div>
  );
}
