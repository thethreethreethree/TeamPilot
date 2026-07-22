"use client";

/**
 * /sales/demo — the Sales Coach workstation (founder 2026-07-22, mirrors CareShowroom).
 *
 * One real sales call, five coaching tools you run on it — outputs faithful to the shipped Sales Coach:
 *   - Live Cues    → the real-time cue engine (liveCue.ts) — short whispers delivered DURING the call.
 *   - Debrief      → after-pitch summary (afterPitch.ts) — strengths→growth, the one Next Door Focus, scores.
 *   - Dissect      → salesDissect.ts — strength/growth/strategy with quoted evidence.
 *   - Coach grade  → salesEloGrade.ts — a letter where B = the "competent call" standard (ELO 1500), a
 *                    coaching band, never a stack-rank verdict (§A11/§A18).
 *   - Skills       → skillAnalytics.ts — six skills /10 (talk-ratio measures LISTENING, so a rep who
 *                    talks 100% scores low).
 * Fixed-dark "coaching console" aesthetic (theme-audit allowlisted, like CareShowroom). §3.4: every tool
 * output maps to a real feature; nothing overclaimed. Scripted-interactive (the LIVE model call is the
 * roleplay panel below); these outputs are faithful reconstructions, labelled as such.
 */

import { useState } from "react";
import {
  Radio,
  ClipboardList,
  Stethoscope,
  GraduationCap,
  BarChart3,
  BookOpen,
  Quote,
} from "lucide-react";

type Turn = { who: "rep" | "prospect"; name: string; text: string; cueIdx?: number };

const THREAD: Turn[] = [
  { who: "prospect", name: "Dana (VP Ops)", text: "Look, I've got 15 minutes. We already use Slack and a couple of spreadsheets — why do I need another tool?" },
  { who: "rep", name: "You", text: "Totally fair. Ours does a lot — dashboards, analytics, coaching, the works. It's really powerful once your team's on it.", cueIdx: 0 },
  { who: "prospect", name: "Dana (VP Ops)", text: "That's what everyone says. My team is drowning in tools already." },
  { who: "rep", name: "You", text: "That makes sense — 'drowning in tools' is exactly the problem. Before I show you anything: where does work actually fall through the cracks for your team right now?", cueIdx: 1 },
  { who: "prospect", name: "Dana (VP Ops)", text: "Honestly? Handoffs. A driver issue gets raised in Slack, someone says they'll handle it, and it just… evaporates. Then a customer calls angry." },
];

const LIVE_CUES = [
  { line: "Ours does a lot — dashboards, analytics, coaching…", cue: "Pitching before you've found the pain. Ask what's broken first — you're selling to a blank.", importance: "high" as const },
  { line: "Where does work actually fall through the cracks?", cue: "Good — you labelled 'drowning in tools' and turned it into a discovery question. Keep them talking.", importance: "affirm" as const },
];

const DEBRIEF = {
  strengths: [
    "Recovered fast: after an early feature-dump, you dropped the pitch and asked a real discovery question.",
    "Labelled the prospect's words ('drowning in tools') back to them before redirecting — earned the next question.",
  ],
  growthAreas: [
    "Opened by pitching capability ('does a lot') before establishing the problem. On a 15-minute call that spends trust you don't have yet.",
  ],
  nextDoorFocus: {
    focus: "Lead with the problem, not the product.",
    why: "Your best moment (the handoffs question) is where the call turned. Start there next time instead of recovering to it.",
  },
};

const DISSECT = {
  strengths: [
    { point: "Discovery recovery", example: "\"where does work actually fall through the cracks?\"", why: "Converted a defensive prospect into a talking one — the single highest-value move on the call." },
  ],
  growth: [
    { area: "Premature pitch", example: "\"dashboards, analytics, coaching, the works\"", why: "Listed capabilities before the prospect named a problem they map to. Features land only after the pain is on the table." },
  ],
  strategy: {
    name: "Now tie value to the handoff gap",
    example: "\"So when a driver issue evaporates in Slack — what does that cost you in a week?\"",
    why: "Dana just handed you the problem (handoffs evaporate). Quantify it in her words, then show the one feature that closes it — nothing else yet.",
  },
};

const COACH = {
  line: "That makes sense — 'drowning in tools' is exactly the problem. Before I show you anything: where does work actually fall through the cracks for your team right now?",
  grade: "A−",
  principle: { name: "Label, then ask", book: "Never Split the Difference" },
  why: "You named her emotion ('drowning in tools') to make her feel heard, then replaced your pitch with a calibrated question. That's the move that turns a skeptic into a source. Graded against a competent-call standard — this beats it.",
};

// The real six skills from skillAnalytics.ts SKILL_LABELS (§3.4 — the readout must name the actual skills).
const SKILLS = [
  { name: "Talk / Listen", score: 6, note: "Talked 62% early; recovered." },
  { name: "Questions", score: 7, note: "One sharp question, late — but it landed." },
  { name: "Objection handling", score: 8, note: "Labelled, didn't argue." },
  { name: "Tone", score: 8, note: "Stayed warm under a cold, skeptical open." },
  { name: "Speed of speech", score: 7, note: "Even pace, no rushing." },
  { name: "Closing", score: null as number | null, note: "No ask yet — call still open." },
];

type ToolKey = "cues" | "debrief" | "dissect" | "coach" | "skills";
const TOOLS: { key: ToolKey; label: string; blurb: string; icon: typeof Radio }[] = [
  { key: "cues", label: "Live Cues", blurb: "Whispered during the call", icon: Radio },
  { key: "debrief", label: "Debrief", blurb: "The one thing to work on", icon: ClipboardList },
  { key: "dissect", label: "Dissect", blurb: "Why the deal is where it is", icon: Stethoscope },
  { key: "coach", label: "Grade a line", blurb: "vs the sales books", icon: GraduationCap },
  { key: "skills", label: "Skills", blurb: "Six skills, out of ten", icon: BarChart3 },
];

export function SalesShowroom() {
  const [active, setActive] = useState<ToolKey>("cues");

  return (
    <div className="rounded-2xl border border-ink-800 bg-ink-950 overflow-hidden shadow-glow-ember-soft">
      {/* console header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-ink-800 bg-ink-900/60">
        <Radio className="w-4 h-4 text-ember-400" aria-hidden />
        <span className="text-xs font-bold text-zinc-100">Sales Coach · call console</span>
        <span className="ml-auto text-[10px] font-mono text-zinc-600">discovery call · 15 min · live-style demo</span>
      </div>

      <div className="grid md:grid-cols-2 gap-0">
        {/* left: the call */}
        <div className="p-4 border-b md:border-b-0 md:border-r border-ink-800">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-3">The call your coach is on</p>
          <div className="space-y-2.5">
            {THREAD.map((t, i) => (
              <div key={i} className={`flex ${t.who === "rep" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[88%] ${t.who === "rep" ? "text-right" : ""}`}>
                  <p className="text-[9px] text-zinc-600 mb-0.5">{t.name}</p>
                  <div
                    className={`text-[11px] leading-relaxed px-2.5 py-1.5 rounded-lg inline-block text-left ${
                      t.who === "rep"
                        ? "bg-ember-400/15 text-ember-50 border border-ember-400/30 rounded-br-sm"
                        : "bg-ink-800 text-zinc-200 border border-ink-700 rounded-bl-sm"
                    }`}
                  >
                    {t.text}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-zinc-600 mt-3 italic">A real discovery call — a skeptical buyer, 15 minutes, one moment where it turns.</p>
        </div>

        {/* right: tools */}
        <div className="p-4">
          <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Click a tool — run it on this call</p>
          <div className="grid grid-cols-2 gap-1.5 mb-4">
            {TOOLS.map((t) => {
              const Icon = t.icon;
              const on = active === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActive(t.key)}
                  className={`text-left px-2.5 py-2 rounded-lg border transition-colors ${
                    on ? "bg-ember-400/15 border-ember-400/50" : "bg-ink-900/40 border-ink-700 hover:border-ink-600"
                  }`}
                >
                  <span className={`text-[11px] font-semibold flex items-center gap-1.5 ${on ? "text-ember-200" : "text-zinc-200"}`}>
                    <Icon className="w-3 h-3 shrink-0" aria-hidden /> {t.label}
                  </span>
                  <span className="text-[9px] text-zinc-500 block mt-0.5 leading-tight">{t.blurb}</span>
                </button>
              );
            })}
          </div>

          <div className="rounded-lg border border-ink-800 bg-ink-900/40 p-3 min-h-[220px]">
            {active === "cues" && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-ember-300 font-bold mb-2 flex items-center gap-1.5"><Radio className="w-3 h-3" aria-hidden /> Live cues · delivered mid-call</p>
                <div className="space-y-2.5">
                  {LIVE_CUES.map((c, i) => (
                    <div key={i} className={`rounded-md p-2 border ${c.importance === "affirm" ? "border-emerald-500/30 bg-emerald-500/5" : "border-ember-400/30 bg-ember-400/5"}`}>
                      <p className="text-[10px] text-zinc-500 italic mb-1">on: &ldquo;{c.line}&rdquo;</p>
                      <p className="text-[11px] text-zinc-100 leading-relaxed">{c.cue}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-zinc-600 mt-2.5">Short enough to read without breaking eye contact — the coach decides when a cue is worth the interruption (§3.3).</p>
              </div>
            )}

            {active === "debrief" && (
              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-ember-300 font-bold flex items-center gap-1.5"><ClipboardList className="w-3 h-3" aria-hidden /> After-call debrief</p>
                <div className="rounded-md border border-ember-400/40 bg-ember-400/10 p-2.5">
                  <p className="text-[10px] uppercase tracking-widest text-ember-200 font-bold mb-0.5">Next door focus</p>
                  <p className="text-[12px] text-zinc-100 font-semibold">{DEBRIEF.nextDoorFocus.focus}</p>
                  <p className="text-[11px] text-zinc-300 leading-relaxed mt-1">{DEBRIEF.nextDoorFocus.why}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-emerald-400/90 font-bold mb-1">Strengths</p>
                  <ul className="space-y-1">{DEBRIEF.strengths.map((s, i) => <li key={i} className="text-[11px] text-zinc-300 leading-relaxed">• {s}</li>)}</ul>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-amber-300/90 font-bold mb-1">Growth</p>
                  <ul className="space-y-1">{DEBRIEF.growthAreas.map((s, i) => <li key={i} className="text-[11px] text-zinc-300 leading-relaxed">• {s}</li>)}</ul>
                </div>
              </div>
            )}

            {active === "dissect" && (
              <div className="space-y-3">
                <p className="text-[10px] uppercase tracking-widest text-ember-300 font-bold flex items-center gap-1.5"><Stethoscope className="w-3 h-3" aria-hidden /> Dissect · the real read</p>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-emerald-400/90 font-bold mb-1">Worked</p>
                  {DISSECT.strengths.map((s, i) => (
                    <div key={i} className="mb-1.5"><p className="text-[11px] text-zinc-100 font-semibold">{s.point}</p><p className="text-[10px] text-zinc-500 italic">{s.example}</p><p className="text-[11px] text-zinc-300 leading-relaxed">{s.why}</p></div>
                  ))}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-amber-300/90 font-bold mb-1">Cost you</p>
                  {DISSECT.growth.map((s, i) => (
                    <div key={i} className="mb-1.5"><p className="text-[11px] text-zinc-100 font-semibold">{s.area}</p><p className="text-[10px] text-zinc-500 italic">{s.example}</p><p className="text-[11px] text-zinc-300 leading-relaxed">{s.why}</p></div>
                  ))}
                </div>
                <div className="rounded-md border border-ember-400/30 bg-ember-400/5 p-2">
                  <p className="text-[10px] uppercase tracking-widest text-ember-200 font-bold mb-0.5">Do this next</p>
                  <p className="text-[11px] text-zinc-100 font-semibold">{DISSECT.strategy.name}</p>
                  <p className="text-[10px] text-zinc-400 italic mt-0.5">{DISSECT.strategy.example}</p>
                  <p className="text-[11px] text-zinc-300 leading-relaxed mt-0.5">{DISSECT.strategy.why}</p>
                </div>
              </div>
            )}

            {active === "coach" && (
              <div className="space-y-2.5">
                <p className="text-[10px] uppercase tracking-widest text-ember-300 font-bold flex items-center gap-1.5"><GraduationCap className="w-3 h-3" aria-hidden /> Coach · your best line, graded</p>
                <p className="text-[11px] text-zinc-300 italic leading-relaxed flex gap-1.5"><Quote className="w-3 h-3 shrink-0 mt-0.5 text-zinc-600" aria-hidden />{COACH.line}</p>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-ember-300">{COACH.grade}</span>
                  <div><p className="text-[11px] text-zinc-100 font-semibold">{COACH.principle.name}</p><p className="text-[10px] text-zinc-500 italic">{COACH.principle.book}</p></div>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">{COACH.why}</p>
                <p className="text-[9px] text-zinc-600">B is the competent-call standard, not a curve — the grade invites coaching, never a stack-rank (§A11).</p>
              </div>
            )}

            {active === "skills" && (
              <div>
                <p className="text-[10px] uppercase tracking-widest text-ember-300 font-bold mb-2 flex items-center gap-1.5"><BarChart3 className="w-3 h-3" aria-hidden /> Skills · this call</p>
                <div className="space-y-2">
                  {SKILLS.map((s) => (
                    <div key={s.name}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-200 font-medium">{s.name}</span>
                        <span className="text-zinc-400 font-mono">{s.score === null ? "—" : `${s.score}/10`}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-ink-800 overflow-hidden mt-0.5">
                        <div className="h-full bg-ember-400/70 rounded-full" style={{ width: s.score === null ? "0%" : `${s.score * 10}%` }} />
                      </div>
                      <p className="text-[9px] text-zinc-600 mt-0.5">{s.note}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[9px] text-zinc-600 mt-2.5 flex items-center gap-1"><BookOpen className="w-2.5 h-2.5" aria-hidden /> A skill with no data reads &ldquo;—&rdquo;, never 0 (§3.4). Listening scores the talk/listen balance, so talking more lowers it.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
