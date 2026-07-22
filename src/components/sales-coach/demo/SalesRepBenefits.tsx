/**
 * /sales/demo — "What your reps actually get" (founder 2026-07-22; mirrors CareAgentBenefits).
 *
 * Answers the buyer's real question: how do my salespeople close more, sell more persuasively, and
 * improve measurably — and what does that mean for the business. Theme-aware. §3.4: every claim maps to
 * a shipped Sales Coach feature (live cues, debrief, Dissect, Coach grade, six-skill analytics).
 */

import {
  Zap,
  MessageSquareQuote,
  TrendingUp,
  BookOpen,
  Users,
  Sparkles,
  ArrowRight,
} from "lucide-react";

type Pillar = {
  icon: typeof Zap;
  eyebrow: string;
  title: string;
  body: string;
  tools: string;
  outcome: string;
};

const PILLARS: Pillar[] = [
  {
    icon: Zap,
    eyebrow: "Close more",
    title: "Coaching in the moment — not a month later.",
    body: "Most coaching is a manager watching a recording next week, when the deal is already lost. Sales Coach whispers a short cue DURING the call — 'you're pitching before you found the pain, ask first' — and turns every call into a debrief with one clear thing to fix next time.",
    tools: "Live cues · after-call debrief",
    outcome: "Reps correct in real time instead of repeating the same miss for a quarter. More calls turn into next steps.",
  },
  {
    icon: MessageSquareQuote,
    eyebrow: "Sell persuasively",
    title: "Every rep sells like your best one.",
    body: "The Coach grades a rep's actual lines against seven communication masterworks and names the move — 'label, then ask' — instead of a vague 'be more consultative'. Dissect reads the whole call and finds the real objection under the stated one. It teaches the move; it never puts words in their mouth.",
    tools: "Coach grade · Dissect",
    outcome: "Consistent pitch quality across the team, and new reps ramp to it in weeks by seeing exactly what good looks like.",
  },
  {
    icon: TrendingUp,
    eyebrow: "Improve measurably",
    title: "Growth you can see — against their own past.",
    body: "Six skills, scored out of ten from real calls: discovery, objection handling, listening (talk-ratio — talking more lowers it), framing, closing, rapport. Each rep is measured against a competent-call standard and their own trend, never stack-ranked against each other. A skill with no data reads '—', never a fake zero.",
    tools: "Six-skill analytics · letter grade",
    outcome: "You know exactly who needs which coaching, and reps see themselves getting better — the thing that keeps good salespeople.",
  },
];

type Step = { label: string; text: string };
const FLOW: Step[] = [
  { label: "On the call", text: "A short cue lands mid-conversation the moment the rep pitches before discovering the pain." },
  { label: "Right after", text: "The debrief names one Next Door Focus — the single highest-leverage fix, not a wall of notes." },
  { label: "Dissected", text: "Dissect quotes the exact line that turned the call, and the exact one that cost momentum." },
  { label: "Tracked", text: "Six skill scores update; the rep watches their own trend move against a competent-call standard." },
  { label: "Next call", text: "They walk in with one thing to do differently — and the coach is there again, live." },
];

export function SalesRepBenefits() {
  return (
    <section className="px-6 py-14 max-w-5xl mx-auto scroll-mt-20" id="reps">
      <p className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center flex items-center justify-center gap-1.5">
        <Users className="w-3 h-3" aria-hidden /> For the people carrying your number
      </p>
      <h2 className="text-2xl md:text-4xl font-bold text-primary text-center mb-3 max-w-3xl mx-auto leading-tight">
        Your customers hear a better rep. Your reps get there faster.
      </h2>
      <p className="text-sm md:text-base text-secondary leading-relaxed max-w-2xl mx-auto text-center mb-10">
        Sales Coach isn&apos;t a dashboard you check after the quarter closes. It sits on the call with every
        rep — coaching in the moment, then turning each conversation into the one lesson that makes the next
        call better.
      </p>

      <div className="grid md:grid-cols-3 gap-4 mb-14">
        {PILLARS.map((p) => {
          const Icon = p.icon;
          return (
            <div key={p.eyebrow} className="glass-card p-5 flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-8 h-8 rounded-lg bg-ember-400/10 border border-ember-400/30 text-brand flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4" aria-hidden />
                </span>
                <span className="text-[10px] uppercase tracking-widest text-brand font-bold">{p.eyebrow}</span>
              </div>
              <h3 className="text-base font-bold text-primary mb-2 leading-snug">{p.title}</h3>
              <p className="text-[13px] text-secondary leading-relaxed mb-3">{p.body}</p>
              <p className="text-[11px] text-muted mb-3 flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-brand shrink-0" aria-hidden /> {p.tools}
              </p>
              <div className="mt-auto pt-3 border-t border-default">
                <p className="text-[10px] uppercase tracking-widest text-emerald-400/90 font-bold mb-1">What that means for the business</p>
                <p className="text-[12px] text-primary leading-relaxed">{p.outcome}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="glass-card p-6 md:p-8">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-1 flex items-center gap-1.5">
          <BookOpen className="w-3 h-3" aria-hidden /> One call, start to finish
        </p>
        <h3 className="text-lg md:text-xl font-bold text-primary mb-6 leading-snug">
          The same 15 minutes — turned into the next rep who&apos;s better.
        </h3>
        <ol className="space-y-0">
          {FLOW.map((s, i) => (
            <li key={s.label} className="flex gap-4 pb-5 last:pb-0 relative">
              {i < FLOW.length - 1 && (
                <span aria-hidden className="absolute left-[15px] top-8 bottom-0 w-px bg-default" />
              )}
              <span className="w-8 h-8 rounded-full bg-ember-400/10 border border-ember-400/30 text-brand text-xs font-bold flex items-center justify-center shrink-0 z-10">
                {i + 1}
              </span>
              <div className="pt-1">
                <p className="text-sm font-semibold text-primary">{s.label}</p>
                <p className="text-[13px] text-secondary leading-relaxed">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <a href="#console" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:opacity-80 transition-opacity">
          Run the tools on the call yourself, above <ArrowRight className="w-3.5 h-3.5" aria-hidden />
        </a>
      </div>
    </section>
  );
}
