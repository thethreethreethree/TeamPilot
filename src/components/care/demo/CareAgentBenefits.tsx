/**
 * /care/demo — "What your agents actually get" (founder 2026-07-22).
 *
 * The rest of the page shows the TOOLS working. This section answers the buyer's real question: how do
 * my customer agents become more effective, communicate more accurately, and process complaints more
 * efficiently — and what does that mean for my business. Theme-aware (matches the explanatory sections).
 * §3.4: every claim maps to a real, shipped feature (Summarize, Co-Pilot, Formulate, Coach, Dissect,
 * handoff capture, Patterns).
 */

import {
  Gauge,
  MessageSquareQuote,
  Search,
  BookOpen,
  Users,
  Sparkles,
  ArrowRight,
} from "lucide-react";

type Pillar = {
  icon: typeof Gauge;
  eyebrow: string;
  title: string;
  body: string;
  tools: string;
  outcome: string;
};

const PILLARS: Pillar[] = [
  {
    icon: Gauge,
    eyebrow: "Work effectively",
    title: "Your agent never starts from zero.",
    body: "A customer replies to a 30-message thread. Instead of reading all of it, the agent hits Summarize and is caught up in seconds — and any past conversation that solved a similar issue surfaces automatically. The knowledge doesn't live in one veteran's head; it's in the system.",
    tools: "Summarize · prior-resolution recall",
    outcome: "New hires ramp in days, not months. Nobody re-reads threads. When your best agent is out, the next one answers just as well.",
  },
  {
    icon: MessageSquareQuote,
    eyebrow: "Communicate accurately",
    title: "Every reply, as sharp as your best rep's.",
    body: "The agent drafts a reply — or Co-Pilot drafts one for them, grounded in your product, not a generic bot. Formulate shapes their intent into clear language, and Coach grades the draft against seven communication masterworks before it ever sends. It teaches; it never auto-sends behind their back.",
    tools: "Co-Pilot · Formulate · Coach",
    outcome: "Fewer misworded replies, fewer escalations, fewer 'that's not what I meant' cycles — and agents who genuinely get better every week.",
  },
  {
    icon: Search,
    eyebrow: "Resolve efficiently",
    title: "Find the real problem, fast.",
    body: "A complaint is rarely about what the first sentence says. Dissect reads the whole thread and surfaces the actual issue and its root cause. When a human specialist is genuinely needed, the handoff carries the customer's name, order and concern with it — so they never have to repeat themselves.",
    tools: "Dissect · handoff capture",
    outcome: "Shorter handle times, fewer repeat contacts, and complaints that turn into fixes instead of a queue that never empties.",
  },
];

type Step = { label: string; text: string };

const FLOW: Step[] = [
  { label: "Lands", text: "A frustrated message hits the inbox — a double charge, and a wait with no reply." },
  { label: "Catch up", text: "Summarize gives the agent the whole story in one glance; similar past cases attach themselves." },
  { label: "Diagnose", text: "Dissect names the real problem: it isn't only the charge — it's the silence that followed." },
  { label: "Draft + coach", text: "Co-Pilot drafts, Formulate shapes, Coach grades the reply against the books before it sends." },
  { label: "Resolve", text: "Agent sends a clear, human reply — or hands off with full context intact. Nothing repeated." },
];

export function CareAgentBenefits() {
  return (
    <section className="px-6 py-14 max-w-5xl mx-auto scroll-mt-20" id="agents">
      <p className="text-[10px] uppercase tracking-widest text-muted mb-2 text-center flex items-center justify-center gap-1.5">
        <Users className="w-3 h-3" aria-hidden /> For the people answering your customers
      </p>
      <h2 className="text-2xl md:text-4xl font-bold text-primary text-center mb-3 max-w-3xl mx-auto leading-tight">
        Your customers feel it. Your agents do the work.
      </h2>
      <p className="text-sm md:text-base text-secondary leading-relaxed max-w-2xl mx-auto text-center mb-10">
        C.A.R.E isn&apos;t only a bot that talks to customers. It sits beside every agent on your team and
        makes each of them faster, clearer, and sharper on the hard conversations — the ones that decide
        whether a customer stays.
      </p>

      {/* Three benefit pillars */}
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
                <p className="text-[10px] uppercase tracking-widest text-emerald-400/90 font-bold mb-1">
                  What that means for the business
                </p>
                <p className="text-[12px] text-primary leading-relaxed">{p.outcome}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* One complaint, start to finish */}
      <div className="glass-card p-6 md:p-8">
        <p className="text-[10px] uppercase tracking-widest text-muted mb-1 flex items-center gap-1.5">
          <BookOpen className="w-3 h-3" aria-hidden /> One complaint, start to finish
        </p>
        <h3 className="text-lg md:text-xl font-bold text-primary mb-6 leading-snug">
          The same messy conversation — handled in five moves.
        </h3>
        <ol className="space-y-0">
          {FLOW.map((s, i) => (
            <li key={s.label} className="flex gap-4 pb-5 last:pb-0 relative">
              {/* connector line */}
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
        <a
          href="#workstation"
          className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:opacity-80 transition-opacity"
        >
          Run these five moves yourself, above <ArrowRight className="w-3.5 h-3.5" aria-hidden />
        </a>
      </div>
    </section>
  );
}
