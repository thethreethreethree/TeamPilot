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
      } catch {
        setError("Couldn't reach the server.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <>
      <header className="px-8 py-4 border-b border-default bg-base/60">
        <h1 className="text-lg font-semibold text-primary">§4 readouts</h1>
        <p className="text-[11px] text-muted">
          Method evolution gated by outcome · counts, never verdicts ·
          you render the verdict
        </p>
      </header>
      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-4xl w-full mx-auto space-y-6">
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
            <div className="bg-[#FACC15]/5 border border-[#FACC15]/30 rounded-lg p-3 flex items-start gap-2">
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

            <section className="bg-white/[0.02] border border-default rounded-xl p-4">
              <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-2">
                What this readout intentionally does NOT claim
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
