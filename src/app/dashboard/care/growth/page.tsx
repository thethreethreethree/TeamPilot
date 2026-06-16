"use client";

import { useEffect, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

type GrowthSnapshot = {
  agentId: string;
  windowDays: number;
  resolutions: number;
  durabilityHeld: number;
  durabilityReopened: number;
  durabilityInconclusive: number;
  copilotMinor: number;
  copilotModerate: number;
  copilotMajor: number;
  copilotRewrite: number;
};

export default function CareGrowthPage() {
  const [snap, setSnap] = useState<GrowthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/care/agent/growth");
        if (res.status === 403) {
          setError("Care growth is for agents.");
          return;
        }
        if (!res.ok) {
          setError("Couldn't load.");
          return;
        }
        const data = await res.json();
        setSnap(data.snapshot ?? null);
      } catch {
        setError("Couldn't reach the server.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totalEdits = snap
    ? snap.copilotMinor +
      snap.copilotModerate +
      snap.copilotMajor +
      snap.copilotRewrite
    : 0;
  const totalDurability = snap
    ? snap.durabilityHeld + snap.durabilityReopened + snap.durabilityInconclusive
    : 0;

  return (
    <>
      <header className="px-8 py-4 border-b border-default bg-base/60">
        <h1 className="text-lg font-semibold text-primary">My growth</h1>
        <p className="text-[11px] text-muted">
          What the System has noticed about your work · last 30 days · you see
          your own data, nobody else sees it at this detail
        </p>
      </header>
      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-4xl w-full mx-auto space-y-5">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted py-12 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        )}
        {error && (
          <div className="bg-red-500/5 border border-red-500/30 rounded-lg p-4">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {snap && (
          <>
            {/* §A10 preamble */}
            <div className="bg-[#FACC15]/5 border border-[#FACC15]/30 rounded-lg p-3 flex items-start gap-2">
              <ShieldCheck
                className="w-4 h-4 text-brand shrink-0 mt-0.5"
                aria-hidden
              />
              <p className="text-xs text-secondary leading-relaxed">
                You see what the System sees about your work. This is the
                same data your leader sees only as aggregate, never at
                this individual detail. The discipline is structural — we
                refuse asymmetric visibility on people.
              </p>
            </div>

            {/* Resolutions count + sparse-data state */}
            <div className="bg-white/[0.02] border border-default rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <BookOpen className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  Resolutions captured
                </h2>
              </div>
              <p className="text-3xl font-bold text-primary mb-1">
                {snap.resolutions}
              </p>
              <p className="text-[11px] text-secondary leading-relaxed">
                Each resolution you captured added &quot;what worked&quot; to
                the company&apos;s playbook. The next agent reading a
                similar conversation gets to see your reasoning.
              </p>
            </div>

            {/* Durability — A11 counts, no verdict */}
            <div className="bg-white/[0.02] border border-default rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <RotateCcw className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  Resolution durability
                </h2>
              </div>
              <p className="text-[11px] text-secondary leading-relaxed mb-4">
                7-day check after each resolution: did the customer come
                back with the same issue? &quot;Reopened&quot; isn&apos;t a
                grade on you — it&apos;s a signal worth investigating
                (sometimes the root cause was elsewhere and you closed
                it correctly given what you knew).
              </p>
              {totalDurability === 0 ? (
                <SparseNotice
                  text="Not enough checked durabilities yet. Each resolution gets a check 7 days out."
                />
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  <DurabilityCell
                    label="Held"
                    icon={CheckCircle2}
                    count={snap.durabilityHeld}
                    total={totalDurability}
                    tone="emerald"
                  />
                  <DurabilityCell
                    label="Reopened"
                    icon={RotateCcw}
                    count={snap.durabilityReopened}
                    total={totalDurability}
                    tone="amber"
                  />
                  <DurabilityCell
                    label="Inconclusive"
                    icon={TriangleAlert}
                    count={snap.durabilityInconclusive}
                    total={totalDurability}
                    tone="muted"
                  />
                </div>
              )}
            </div>

            {/* Co-Pilot edit magnitudes */}
            <div className="bg-white/[0.02] border border-default rounded-xl p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  AI Co-Pilot edits
                </h2>
              </div>
              <p className="text-[11px] text-secondary leading-relaxed mb-4">
                When you used the Co-Pilot, how much did you change before
                sending? &quot;Minor&quot; means the draft was close to
                what you sent; &quot;Rewrite&quot; means you reached for
                a different angle. Both are useful — the diffs become the
                playbook that teaches the Co-Pilot your voice over time.
              </p>
              {totalEdits === 0 ? (
                <SparseNotice text="No Co-Pilot uses yet in the window." />
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  <EditCell label="Minor" count={snap.copilotMinor} total={totalEdits} />
                  <EditCell
                    label="Moderate"
                    count={snap.copilotModerate}
                    total={totalEdits}
                  />
                  <EditCell label="Major" count={snap.copilotMajor} total={totalEdits} />
                  <EditCell
                    label="Rewrite"
                    count={snap.copilotRewrite}
                    total={totalEdits}
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

function SparseNotice({ text }: { text: string }) {
  return (
    <p className="text-[11px] text-muted italic">{text}</p>
  );
}

function DurabilityCell({
  label,
  icon: Icon,
  count,
  total,
  tone,
}: {
  label: string;
  icon: typeof RotateCcw;
  count: number;
  total: number;
  tone: "emerald" | "amber" | "muted";
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const toneCls =
    tone === "emerald"
      ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
      : tone === "amber"
        ? "border-amber-500/30 bg-amber-500/5 text-amber-300"
        : "border-default bg-surface/40 text-secondary";
  return (
    <div className={`rounded-lg border p-3 ${toneCls}`}>
      <div className="flex items-center gap-1 mb-1">
        <Icon className="w-3 h-3" aria-hidden />
        <p className="text-[10px] uppercase tracking-widest font-bold">
          {label}
        </p>
      </div>
      <p className="text-lg font-bold text-primary">{pct}%</p>
      <p className="text-[10px] text-muted font-mono">
        {count} of {total}
      </p>
    </div>
  );
}

function EditCell({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="border border-default rounded-md p-2 text-center">
      <p className="text-sm font-bold text-primary">{pct}%</p>
      <p className="text-[10px] uppercase tracking-widest font-bold text-muted">
        {label}
      </p>
      <p className="text-[10px] text-muted font-mono">{count}</p>
    </div>
  );
}
