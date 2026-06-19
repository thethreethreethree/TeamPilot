"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

/**
 * /dashboard/care/leadership/readouts
 *
 * Phase 7 §4 readouts — the methodology-evolution measurement
 * surface this product is supposed to embody. The Coach v6
 * count-based rubric ships with a §4 readout comparing its
 * durability outcomes against the pre-v6 (v5 / ungraded)
 * baseline.
 *
 * Constitutional sources composed:
 *   - §A2 — this page IS the design-backwards-from-§4 deliverable
 *     for Coach v6. The reframe is now MEASURED against the
 *     alternative.
 *   - §A3 — measures DOWNSTREAM CONSEQUENCE (durability held),
 *     not System agreement (did agents accept Coach grades).
 *   - §A4 — every uncertainty surfaces in the UI itself: sample
 *     sizes, "preliminary" tier for low-N, explicit caveats
 *     about confounds. No pre-decided "v6 wins" verdict.
 *   - §A11 — counts and rates, never verdicts.
 *   - §A18 — cohort labels are descriptive (v6-graded /
 *     pre-v6 / ungraded), never evaluative.
 *
 * §4 read by the user, not asserted by the System.
 */

type ReadoutCohort = {
  conversationCount: number;
  durabilityHeld: number;
  durabilityReopened: number;
  durabilityInconclusive: number;
  durabilityHeldRate: number | null;
};

type CoachRubricReadout = {
  windowDays: number;
  companyId: string;
  cohorts: {
    v6: ReadoutCohort;
    v5: ReadoutCohort;
    ungraded: ReadoutCohort;
  };
};

type CoPilotValueReadout = {
  windowDays: number;
  companyId: string;
  cohorts: {
    coPilotUsed: ReadoutCohort;
    coPilotNotUsed: ReadoutCohort;
  };
};

type VoiceValueReadout = {
  windowDays: number;
  companyId: string;
  cohorts: {
    voiceUsed: ReadoutCohort;
    voiceNotUsed: ReadoutCohort;
  };
};

type RoutingReadout = {
  windowDays: number;
  companyId: string;
  cohorts: {
    autoRouted: ReadoutCohort;
    manualClaim: ReadoutCohort;
    unrouted: ReadoutCohort;
  };
};

type SlaWithDurabilityReadout = {
  windowDays: number;
  companyId: string;
  totalConversations: number;
  firstResponseMet: number;
  firstResponseMetRate: number | null;
  durabilityHeld: number;
  durabilityHeldRate: number | null;
  fullyHonored: number;
  fullyHonoredRate: number | null;
  falseSlaSuccesses: number;
  falseSlaSuccessesRate: number | null;
};

type PatternBucket = {
  conversationCount: number;
  medianTimeToResolveMinutes: number | null;
  durabilityHeld: number;
  durabilityChecked: number;
  durabilityHeldRate: number | null;
};

type PatternResolutionReadout = {
  windowDays: number;
  companyId: string;
  patterns: Array<{
    category: string;
    patternFormedAt: string;
    totalResolutions: number;
    before: PatternBucket;
    after: PatternBucket;
  }>;
};

/** §A4 confidence tier — surfaces sample-size uncertainty
 *  directly in the UI. Thresholds are themselves uncertainties
 *  (5/20/50 is a starting point; refine when §4 evidence
 *  accumulates). */
type ConfidenceTier = "no-signal" | "preliminary" | "developing" | "confident";

function tier(c: ReadoutCohort): ConfidenceTier {
  const n =
    c.durabilityHeld + c.durabilityReopened + c.durabilityInconclusive;
  if (n === 0) return "no-signal";
  if (n < 5) return "no-signal";
  if (n < 20) return "preliminary";
  if (n < 50) return "developing";
  return "confident";
}

export default function CareReadoutsPage() {
  const [readout, setReadout] = useState<CoachRubricReadout | null>(null);
  const [coPilot, setCoPilot] = useState<CoPilotValueReadout | null>(null);
  const [voice, setVoice] = useState<VoiceValueReadout | null>(null);
  const [routing, setRouting] = useState<RoutingReadout | null>(null);
  const [slaWithDurability, setSlaWithDurability] =
    useState<SlaWithDurabilityReadout | null>(null);
  const [patternResolution, setPatternResolution] =
    useState<PatternResolutionReadout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/care/leadership/readouts");
        if (res.status === 403) {
          setError("Readouts are for CEO / COO / admin.");
          return;
        }
        if (!res.ok) {
          setError("Couldn't load.");
          return;
        }
        const data = await res.json();
        setReadout(data.coachRubric ?? null);
        setCoPilot(data.coPilotValue ?? null);
        setVoice(data.voiceValue ?? null);
        setRouting(data.routing ?? null);
        setSlaWithDurability(data.slaWithDurability ?? null);
        setPatternResolution(data.patternResolution ?? null);
      } catch {
        setError("Couldn't reach the server.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <header className="px-4 md:px-8 py-4 border-b border-default bg-base/60">
        <h1 className="text-lg font-semibold text-primary">§4 readouts</h1>
        <p className="text-[11px] text-muted">
          Method evolution gated by outcome · counts, never verdicts ·
          you render the verdict
        </p>
      </header>
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-4xl w-full mx-auto space-y-6">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Computing…
          </div>
        )}
        {error && (
          <div className="bg-red-500/5 border border-red-500/30 rounded-lg p-4">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {readout && (
          <>
            {/* §A2 + §A3 + §A4 preamble — same every visit. */}
            <div className="bg-ember-400/5 border border-ember-400/30 rounded-lg p-3 flex items-start gap-2">
              <ShieldCheck
                className="w-4 h-4 text-brand shrink-0 mt-0.5"
                aria-hidden
              />
              <p className="text-xs text-secondary leading-relaxed">
                The System distrusts its own evolution until results
                prove it (§4). These cohorts compare downstream
                consequence — durability-held — not whether the team
                agreed with the Coach grades. No &quot;v6 wins&quot;
                claim is baked into the data. Read the counts, render
                the verdict yourself.
              </p>
            </div>

            <section>
              <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-1">
                Coach rubric · durability comparison
              </h2>
              <p className="text-[11px] text-secondary leading-relaxed mb-3">
                Last {readout.windowDays} days. Each conversation is
                placed in the highest cohort one of its agent messages
                reached (v6 &gt; v5 &gt; ungraded). Durability is the
                7-day check after resolution — did the customer come
                back with the same issue?
              </p>
              <div className="space-y-3">
                <CohortCard
                  label="v6-graded (count-based)"
                  hint="Coach v6 count-shaped rubric. The reframe."
                  cohort={readout.cohorts.v6}
                  tone="emerald"
                />
                <CohortCard
                  label="Pre-v6 (verdict-shaped enum)"
                  hint="Coach v5 productive/neutral/needs_guidance baseline."
                  cohort={readout.cohorts.v5}
                  tone="amber"
                />
                <CohortCard
                  label="Ungraded"
                  hint="No Coach grading in flight when these resolved."
                  cohort={readout.cohorts.ungraded}
                  tone="muted"
                />
              </div>
            </section>

            {coPilot && (
              <section>
                <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-1">
                  Co-Pilot value · durability comparison
                </h2>
                <p className="text-[11px] text-secondary leading-relaxed mb-3">
                  Last {coPilot.windowDays} days. Conversations are
                  split by whether AT LEAST one of their agent
                  replies was Co-Pilot-assisted. Same caveats as the
                  Coach rubric readout apply — not controlled, not
                  causal, signal not proof.
                </p>
                <div className="space-y-3">
                  <CohortCard
                    label="Co-Pilot-assisted"
                    hint="Agent invoked Co-Pilot for at least one reply."
                    cohort={coPilot.cohorts.coPilotUsed}
                    tone="emerald"
                  />
                  <CohortCard
                    label="Unassisted"
                    hint="Agent typed every reply without Co-Pilot."
                    cohort={coPilot.cohorts.coPilotNotUsed}
                    tone="muted"
                  />
                </div>
              </section>
            )}

            {voice && (
              <section>
                <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-1">
                  Voice · durability comparison
                </h2>
                <p className="text-[11px] text-secondary leading-relaxed mb-3">
                  Last {voice.windowDays} days. Conversations are
                  split by whether ANY of their customer messages
                  arrived via voice (STT). Same caveats apply —
                  customer opt-in is non-random, so this is signal
                  not proof. Worth tracking whether voice-using
                  customers resolve as durably as text-only.
                </p>
                <div className="space-y-3">
                  <CohortCard
                    label="Voice-used"
                    hint="Customer spoke at least once via the widget mic."
                    cohort={voice.cohorts.voiceUsed}
                    tone="emerald"
                  />
                  <CohortCard
                    label="Text-only"
                    hint="All customer messages were typed."
                    cohort={voice.cohorts.voiceNotUsed}
                    tone="muted"
                  />
                </div>
              </section>
            )}

            {routing && (
              <section>
                <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-1">
                  Routing · durability comparison
                </h2>
                <p className="text-[11px] text-secondary leading-relaxed mb-3">
                  Last {routing.windowDays} days. Conversations are
                  split by how they reached an agent. Per §A18 this
                  comparison is across routing METHODS, not agents —
                  the read is "does the routing function produce
                  comparable outcomes to manual claim?", not "which
                  agent is best."
                </p>
                <div className="space-y-3">
                  <CohortCard
                    label="Auto-routed (least-loaded)"
                    hint="Routing function picked an agent at create."
                    cohort={routing.cohorts.autoRouted}
                    tone="emerald"
                  />
                  <CohortCard
                    label="Manually claimed"
                    hint="Agent pulled from inbox OR admin assigned."
                    cohort={routing.cohorts.manualClaim}
                    tone="amber"
                  />
                  <CohortCard
                    label="Unrouted at create"
                    hint="No eligible agent online; AI handled first response, conversation waited."
                    cohort={routing.cohorts.unrouted}
                    tone="muted"
                  />
                </div>
              </section>
            )}

            {slaWithDurability && (
              <section>
                <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-1">
                  SLA + durability backstop
                </h2>
                <p className="text-[11px] text-secondary leading-relaxed mb-3">
                  Last {slaWithDurability.windowDays} days. The
                  category claim: meeting a first-response SLA is
                  incomplete if the resolution reopens. The{" "}
                  <span className="text-primary font-semibold">
                    fully honored
                  </span>{" "}
                  rate (first-response met AND durability held) is
                  the honest measure; the standard SLA metric is the
                  comparison. The{" "}
                  <span className="text-amber-300 font-semibold">
                    false SLA successes
                  </span>{" "}
                  count is the failure mode the standard SLA hides.
                </p>
                <SlaBackstopCard data={slaWithDurability} />
              </section>
            )}

            {patternResolution && patternResolution.patterns.length > 0 && (
              <section>
                <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-1">
                  Pattern formation · before / after comparison
                </h2>
                <p className="text-[11px] text-secondary leading-relaxed mb-3">
                  Last {patternResolution.windowDays} days. For each
                  detected pattern, conversations that resolved
                  BEFORE the category crossed the §3.2 threshold
                  (3rd resolution) vs AFTER (the team had
                  compounding institutional knowledge — past
                  resolutions in the corpus, Co-Pilot finds
                  precedents).
                </p>
                <p className="text-[10px] text-amber-300/80 italic mb-3">
                  §A4 caveat: BEFORE conversations are earlier-in-
                  time resolutions and may also reflect general
                  team inexperience, not only absence of pattern
                  memory. Read the per-pattern shape, not a
                  team-wide verdict.
                </p>
                <div className="space-y-3">
                  {patternResolution.patterns.map((p) => (
                    <PatternComparisonCard key={p.category} pattern={p} />
                  ))}
                </div>
              </section>
            )}

            <section className="bg-white/[0.02] border border-default rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-2">
                What these readouts intentionally do NOT claim
              </p>
              <ul className="text-[11px] text-secondary leading-relaxed space-y-1 list-disc pl-4">
                <li>
                  Controlled comparison. Cohorts aren&apos;t randomized
                  — they reflect when each rubric was active. Issue
                  category mix shifts and agent skill drift are NOT
                  controlled for.
                </li>
                <li>
                  Statistical significance. The confidence tier on each
                  cohort is a sample-size hint, not a p-value claim.
                </li>
                <li>
                  Forward causation. If v6 cohorts hold durably more,
                  it&apos;s a signal worth investigating — not proof
                  v6 caused the improvement.
                </li>
              </ul>
            </section>
          </>
        )}
      </div>
    </>
  );
}

function CohortCard({
  label,
  hint,
  cohort,
  tone,
}: {
  label: string;
  hint: string;
  cohort: ReadoutCohort;
  tone: "emerald" | "amber" | "muted";
}) {
  const t = tier(cohort);
  const toneCls =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : tone === "amber"
        ? "border-amber-500/30 bg-amber-500/5"
        : "border-default bg-surface/40";
  const totalChecks =
    cohort.durabilityHeld +
    cohort.durabilityReopened +
    cohort.durabilityInconclusive;

  return (
    <div className={`rounded-xl border p-4 ${toneCls}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <p className="text-sm font-semibold text-primary">{label}</p>
          <p className="text-[11px] text-muted italic">{hint}</p>
        </div>
        <ConfidenceTag tier={t} />
      </div>
      {t === "no-signal" ? (
        <p className="text-[11px] text-muted italic">
          Not enough checked durabilities yet to read a pattern.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2 mb-2">
            <Stat
              label="Held"
              count={cohort.durabilityHeld}
              total={totalChecks}
              icon={CheckCircle2}
              tone="emerald"
            />
            <Stat
              label="Reopened"
              count={cohort.durabilityReopened}
              total={totalChecks}
              icon={RotateCcw}
              tone="amber"
            />
            <Stat
              label="Inconclusive"
              count={cohort.durabilityInconclusive}
              total={totalChecks}
              icon={TriangleAlert}
              tone="muted"
            />
            <Stat
              label="Conversations"
              count={cohort.conversationCount}
              total={null}
              icon={Sparkles}
              tone="muted"
            />
          </div>
          {cohort.durabilityHeldRate !== null && (
            <p className="text-[11px] text-secondary">
              Held rate:{" "}
              <span className="font-mono font-semibold text-primary">
                {(cohort.durabilityHeldRate * 100).toFixed(1)}%
              </span>
            </p>
          )}
        </>
      )}
    </div>
  );
}

function ConfidenceTag({ tier }: { tier: ConfidenceTier }) {
  const map = {
    "no-signal": {
      label: "no signal",
      cls: "text-muted bg-surface border-default",
      icon: AlertTriangle,
    },
    preliminary: {
      label: "preliminary",
      cls: "text-amber-300 bg-amber-500/10 border-amber-500/30",
      icon: AlertTriangle,
    },
    developing: {
      label: "developing",
      cls: "text-arc-300 bg-arc-400/10 border-arc-400/30",
      icon: Sparkles,
    },
    confident: {
      label: "confident-tier",
      cls: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30",
      icon: CheckCircle2,
    },
  } as const;
  const x = map[tier];
  const Icon = x.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-1.5 py-0.5 rounded border ${x.cls}`}
      title="§A4 sample-size hint. Not a p-value."
    >
      <Icon className="w-3 h-3" aria-hidden />
      {x.label}
    </span>
  );
}

function Stat({
  label,
  count,
  total,
  icon: Icon,
  tone,
}: {
  label: string;
  count: number;
  total: number | null;
  icon: typeof CheckCircle2;
  tone: "emerald" | "amber" | "muted";
}) {
  const toneCls =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "amber"
        ? "text-amber-300"
        : "text-secondary";
  return (
    <div className="rounded border border-default bg-surface/40 p-2">
      <div className={`flex items-center gap-1 ${toneCls}`}>
        <Icon className="w-3 h-3" aria-hidden />
        <p className="text-[10px] uppercase tracking-widest font-bold">
          {label}
        </p>
      </div>
      <p className="text-base font-bold text-primary mt-0.5">
        {count}
        {total !== null && (
          <span className="text-[10px] font-mono text-muted"> of {total}</span>
        )}
      </p>
    </div>
  );
}

/**
 * SLA + durability backstop — Phase 8 commit 1.
 *
 * Renders four counts side-by-side with the "honest measure"
 * (fully honored) highlighted and the "blind spot" (false SLA
 * successes) called out per §A11.
 *
 * A14 render branches:
 *   - data.totalConversations === 0 → "Not enough resolved
 *     conversations with completed durability checks yet"
 *   - data.totalConversations > 0 → 4-cell grid
 *   - data.falseSlaSuccesses === 0 → footer reframes positively
 *   - data.falseSlaSuccesses > 0 → footer surfaces the blind
 *     spot directly
 */
function SlaBackstopCard({ data }: { data: SlaWithDurabilityReadout }) {
  const t = tier({
    conversationCount: data.totalConversations,
    durabilityHeld: 0,
    durabilityReopened: 0,
    durabilityInconclusive: 0,
    durabilityHeldRate: null,
  });
  if (data.totalConversations === 0) {
    return (
      <div className="rounded-xl border border-default bg-white/[0.02] p-4">
        <p className="text-[11px] text-muted italic">
          Not enough resolved conversations with completed
          durability checks yet to read a pattern.
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-default bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <p className="text-[11px] text-muted">
          Across {data.totalConversations}{" "}
          {data.totalConversations === 1 ? "conversation" : "conversations"}{" "}
          resolved with a completed 7-day durability check in the
          window.
        </p>
        <ConfidenceTag tier={t} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <BackstopStat
          label="First-response met"
          count={data.firstResponseMet}
          total={data.totalConversations}
          rate={data.firstResponseMetRate}
          tone="muted"
          hint="Standard SLA metric"
        />
        <BackstopStat
          label="Durability held"
          count={data.durabilityHeld}
          total={data.totalConversations}
          rate={data.durabilityHeldRate}
          tone="muted"
          hint="§1.6 close-the-loop"
        />
        <BackstopStat
          label="Fully honored"
          count={data.fullyHonored}
          total={data.totalConversations}
          rate={data.fullyHonoredRate}
          tone="emerald"
          hint="Both conditions met"
        />
        <BackstopStat
          label="False SLA successes"
          count={data.falseSlaSuccesses}
          total={data.totalConversations}
          rate={data.falseSlaSuccessesRate}
          tone="amber"
          hint="Met SLA but reopened"
        />
      </div>
      {data.falseSlaSuccesses > 0 ? (
        <p className="text-[10px] text-amber-300/90 italic">
          {data.falseSlaSuccesses} of these conversations met the
          first-response SLA but reopened anyway — the standard
          SLA dashboard would mark them "honored." The fully-
          honored rate is the honest count.
        </p>
      ) : (
        <p className="text-[10px] text-muted italic">
          No false SLA successes in the window — every
          first-response-met conversation also held durably (or
          was inconclusive). Worth tracking whether this holds
          as volume grows.
        </p>
      )}
    </div>
  );
}

function BackstopStat({
  label,
  count,
  total,
  rate,
  tone,
  hint,
}: {
  label: string;
  count: number;
  total: number;
  rate: number | null;
  tone: "emerald" | "amber" | "muted";
  hint: string;
}) {
  const toneCls =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
      : tone === "amber"
        ? "border-amber-500/30 bg-amber-500/5 text-amber-300"
        : "border-default bg-surface/40 text-secondary";
  return (
    <div className={`rounded-lg border p-3 ${toneCls}`}>
      <p className="text-[10px] uppercase tracking-widest font-bold mb-1">
        {label}
      </p>
      <p className="text-lg font-bold text-primary">
        {count}{" "}
        <span className="text-xs font-mono text-muted">of {total}</span>
      </p>
      {rate !== null && (
        <p className="text-[10px] font-mono text-muted">
          {(rate * 100).toFixed(1)}%
        </p>
      )}
      <p className="text-[10px] text-muted italic mt-1">{hint}</p>
    </div>
  );
}

/**
 * Pattern before/after card — renders one detected pattern with
 * its BEFORE bucket vs AFTER bucket side-by-side per §A11.
 *
 * A14 render branches enumerated:
 *   - before.conversationCount === 0 → "No conversations
 *     resolved before the pattern threshold was crossed"
 *   - after.conversationCount === 0 → "No conversations
 *     resolved since the pattern was detected"
 *   - both populated → side-by-side comparison
 *   - medianTimeToResolveMinutes === null → "Not enough
 *     timing data" in the cell
 *   - durabilityHeldRate === null → no rate, count only
 *
 * Per §A11 there's NO "after wins / before wins" verdict.
 * Counts and rates are surfaced; the user decides whether the
 * shape is fair.
 */
function PatternComparisonCard({
  pattern,
}: {
  pattern: {
    category: string;
    patternFormedAt: string;
    totalResolutions: number;
    before: PatternBucket;
    after: PatternBucket;
  };
}) {
  return (
    <div className="rounded-xl border border-default bg-white/[0.02] p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-primary">
            {pattern.category}
          </p>
          <p className="text-[10px] text-muted">
            {pattern.totalResolutions} total resolutions · §3.2
            threshold crossed{" "}
            {pattern.patternFormedAt.slice(0, 10)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <PatternBucketCell label="Before pattern formed" bucket={pattern.before} tone="muted" />
        <PatternBucketCell label="After pattern formed" bucket={pattern.after} tone="emerald" />
      </div>
    </div>
  );
}

function PatternBucketCell({
  label,
  bucket,
  tone,
}: {
  label: string;
  bucket: PatternBucket;
  tone: "emerald" | "muted";
}) {
  const toneCls =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/5"
      : "border-default bg-surface/40";
  if (bucket.conversationCount === 0) {
    return (
      <div className={`rounded-lg border p-3 ${toneCls}`}>
        <p className="text-[10px] uppercase tracking-widest font-bold text-muted mb-1">
          {label}
        </p>
        <p className="text-[11px] text-muted italic">
          No conversations in this bucket.
        </p>
      </div>
    );
  }
  return (
    <div className={`rounded-lg border p-3 ${toneCls}`}>
      <p className="text-[10px] uppercase tracking-widest font-bold text-secondary mb-2">
        {label}
      </p>
      <p className="text-[11px] text-secondary mb-1">
        <span className="font-bold text-primary text-base">
          {bucket.conversationCount}
        </span>{" "}
        {bucket.conversationCount === 1 ? "conversation" : "conversations"}
      </p>
      <div className="space-y-1 mt-2">
        <p className="text-[11px] text-secondary">
          Median time to resolve:{" "}
          {bucket.medianTimeToResolveMinutes !== null ? (
            <span className="font-mono font-semibold text-primary">
              {formatMinutes(bucket.medianTimeToResolveMinutes)}
            </span>
          ) : (
            <span className="text-muted italic">not enough timing data</span>
          )}
        </p>
        <p className="text-[11px] text-secondary">
          Durability held:{" "}
          <span className="font-mono font-semibold text-primary">
            {bucket.durabilityHeld} of {bucket.durabilityChecked}
          </span>{" "}
          {bucket.durabilityHeldRate !== null && (
            <span className="text-muted">
              ({(bucket.durabilityHeldRate * 100).toFixed(1)}%)
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}
