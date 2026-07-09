"use client";

import { useCallback, useEffect, useState } from "react";
import TopBar from "@/components/layout/TopBar";
import { useCompanyName } from "@/lib/hooks/useCompany";
import { Loader2, AlertTriangle } from "lucide-react";
import { LearningHint } from "@/components/learning/LearningHint";

type Window = "7d" | "30d" | "60d" | "all";

type Readout = {
  windowLabel: string;
  // §3.4 honest-bound: true when the file scan hit the row cap, so these numbers
  // UNDERCOUNT (this company has more files than one read returns). Surfaced as a
  // banner so the reader knows the metrics are capped, not exact (item 8).
  bounded?: boolean;
  uploads: number;
  classifiedUploads: number;
  casualUploads: number;
  filesWithAnyRetrieval: number;
  reRetrievalRate: number;
  crossActorFiles: number;
  crossActorRate: number;
  citedFiles: number;
  citationRate: number;
  suggestionsActedOn: number;
  acceptedAsIs: number;
  editedThenSaved: number;
  rejected: number;
  pending: number;
  acceptedAsIsRate: number;
  ruleTraceCounts: Array<{ rule: string; count: number }>;
};

const RULE_LABELS: Record<string, string> = {
  R1: "Surface context (uploaded from a task/topic/conversation)",
  R2: "Task → Department inheritance",
  R3: "Uploader's department fallback",
  R4: "Filename → Title",
  R5: "Filename → Tags",
  R6: "C.A.R.E auto-routing",
};

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function evalReRetrieval(rate: number, uploads: number): {
  label: string;
  tone: "good" | "warn" | "bad" | "noop";
  note: string;
} {
  if (uploads === 0)
    return {
      label: "No data yet",
      tone: "noop",
      note: "Upload a few files and wait a few days; the readout fills in.",
    };
  if (rate >= 0.4)
    return {
      label: "Healthy",
      tone: "good",
      note: "Above target (40%). Files are getting retrieved after upload.",
    };
  if (rate >= 0.15)
    return {
      label: "Below target",
      tone: "warn",
      note: "Target is > 40%. Below 15% is a graveyard signal.",
    };
  return {
    label: "Graveyard",
    tone: "bad",
    note: "Most files are never opened again. Discipline is producing a file-graveyard.",
  };
}

function evalCrossActor(rate: number, uploads: number): {
  label: string;
  tone: "good" | "warn" | "bad" | "noop";
  note: string;
} {
  if (uploads === 0)
    return { label: "No data yet", tone: "noop", note: "" };
  if (rate >= 0.25)
    return {
      label: "Team asset",
      tone: "good",
      note: "Above target (25%). Files are being retrieved by teammates beyond the uploader.",
    };
  if (rate >= 0.1)
    return {
      label: "Mostly personal",
      tone: "warn",
      note: "Below target. Files are uploaded but only the uploader opens them.",
    };
  return {
    label: "Personal storage",
    tone: "bad",
    note: "Almost no cross-actor retrieval. The 'asset' framing isn't holding.",
  };
}

export default function AssetReadoutPage() {
  const companyName = useCompanyName();
  const [windowParam, setWindowParam] = useState<Window>("30d");
  const [data, setData] = useState<Readout | null>(null);
  const [loading, setLoading] = useState(true);
  // §3.4 honest-error-state (audit 2026-07-09): distinguish a load FAILURE from a
  // genuinely-empty readout. Without this, a query error rendered the "upload files"
  // empty state — an error dressed as "no assets yet", which is a lie.
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/asset-readout?window=${windowParam}`);
      if (res.ok) {
        const j = await res.json();
        setData(j.readout);
      } else {
        setData(null);
        setError("Couldn't load the asset readout right now — this is an error, not an empty readout. Try again shortly.");
      }
    } catch {
      setData(null);
      setError("Couldn't load the asset readout (network error). Try again shortly.");
    } finally {
      setLoading(false);
    }
  }, [windowParam]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const rrEval = data ? evalReRetrieval(data.reRetrievalRate, data.uploads) : null;
  const caEval = data ? evalCrossActor(data.crossActorRate, data.uploads) : null;

  return (
    <>
      <TopBar
        title="Asset readout"
        subtitle={`${companyName ?? "Your team"} · §4 readout for the Asset System v1`}
      />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-5xl mx-auto w-full">
        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}
        <LearningHint
          as="block"
          category="Readout · §3.5"
          title="Why this readout exists"
          whatItIs="The Asset System's §4 readout — the consequence-anchored measurement of whether files become team assets or sit unused. Measures re-retrieval rate, cross-actor retrieval, citation rate, and routing-rule acceptance, all per §3.5 (downstream consequence, not adoption)."
          why="A file storage layer without a measurement layer is a graveyard. The discipline only pays off if it produces compounding team assets. This page is how the founder verifies the discipline is working — files are being retrieved, retrieved by people other than the uploader, and the deterministic routing rules' accuracy is honest."
          how="Pick a time window. Read the four metrics + their evaluations. Below-target rates are not failures — they're signals to ask why. Graveyard rates after 60 days mean the discipline isn't producing assets and a §1.7 audit of how the team uses files is warranted."
          principle="Measurement anchored to consequence is what makes the discipline real. Measurement anchored to adoption (did people use the feature?) is grading our own homework."
        >
          <div className="mb-4 flex items-center gap-2">
            {(["7d", "30d", "60d", "all"] as Window[]).map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setWindowParam(w)}
                className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                  windowParam === w
                    ? "border-ember-400/50 bg-ember-400/10 text-brand"
                    : "border-default text-secondary hover:border-strong"
                }`}
              >
                {w === "all" ? "All time" : `Last ${w.replace("d", " days")}`}
              </button>
            ))}
          </div>
        </LearningHint>

        {loading ? (
          <div className="flex items-center justify-center py-16 text-muted text-sm">
            <Loader2 className="w-4 h-4 animate-spin mr-2" aria-hidden />
            Loading readout…
          </div>
        ) : !data ? (
          <p className="text-sm text-muted">Couldn&apos;t load readout.</p>
        ) : (
          <div className="space-y-6">
            {/* §3.4 honest-bound banner — only when the file scan hit the row cap,
                so the reader knows these numbers undercount (item 8). Additive:
                renders nothing on the happy path. */}
            {data.bounded && (
              <div className="flex items-start gap-2 rounded-md border border-amber-400/40 bg-amber-400/5 px-3 py-2">
                <AlertTriangle
                  className="w-4 h-4 text-amber-300 shrink-0 mt-0.5"
                  aria-hidden
                />
                <p className="text-[11px] text-secondary leading-relaxed">
                  <span className="font-semibold text-brand">Metrics capped.</span>{" "}
                  This company has more files than one read returns, so the counts
                  below <span className="font-medium text-primary">undercount</span> —
                  they reflect the most recent ~1,000 files in this window, not the
                  full set. A bounding fix is planned (item 8).
                </p>
              </div>
            )}
            {/* Top counts */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Stat label="Uploads" value={data.uploads} sub={data.windowLabel} />
              <Stat
                label="Classified"
                value={data.classifiedUploads}
                sub={`${data.uploads === 0 ? 0 : Math.round((data.classifiedUploads / data.uploads) * 100)}% of uploads`}
              />
              <Stat
                label="Casual"
                value={data.casualUploads}
                sub={`${data.uploads === 0 ? 0 : Math.round((data.casualUploads / data.uploads) * 100)}% of uploads`}
              />
            </section>

            {/* Retrieval signals */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rrEval && (
                <MetricCard
                  title="Re-retrieval rate"
                  value={pct(data.reRetrievalRate)}
                  tone={rrEval.tone}
                  label={rrEval.label}
                  note={rrEval.note}
                  sub={`${data.filesWithAnyRetrieval} of ${data.uploads} files retrieved after upload`}
                />
              )}
              {caEval && (
                <MetricCard
                  title="Cross-actor retrieval"
                  value={pct(data.crossActorRate)}
                  tone={caEval.tone}
                  label={caEval.label}
                  note={caEval.note}
                  sub={`${data.crossActorFiles} of ${data.uploads} files retrieved by someone other than the uploader`}
                />
              )}
            </section>

            {/* Citation + classification accuracy */}
            <section className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <MetricCard
                title="Citation rate"
                value={pct(data.citationRate)}
                tone={
                  data.citedFiles === 0
                    ? "noop"
                    : data.citationRate >= 0.1
                      ? "good"
                      : "warn"
                }
                label={
                  data.citedFiles === 0
                    ? "No citations yet"
                    : data.citationRate >= 0.1
                      ? "Files inform reasoning"
                      : "Low citation"
                }
                note={
                  data.citedFiles === 0
                    ? "@file mentions land here. Cite a file in a chat message, Decision Dialogue, or Resolution review to see this move."
                    : data.citationRate >= 0.1
                      ? "Files are being referenced from reasoning surfaces — the strongest asset-value signal."
                      : "Some citations, but most files never get @file-referenced from chats / decisions / resolutions."
                }
                sub={`${data.citedFiles} files cited`}
              />
              <MetricCard
                title="Routing acceptance"
                value={
                  data.suggestionsActedOn === 0
                    ? "—"
                    : pct(data.acceptedAsIsRate)
                }
                tone={data.suggestionsActedOn === 0 ? "noop" : "good"}
                label={
                  data.suggestionsActedOn === 0
                    ? "No actions yet"
                    : "Audit log"
                }
                note={
                  data.suggestionsActedOn === 0
                    ? "No users have classified a routed upload yet."
                    : `${data.acceptedAsIs} accepted-as-is · ${data.editedThenSaved} edited · ${data.rejected} rejected · ${data.pending} pending.`
                }
                sub="What % of router suggestions did the user accept without editing?"
              />
            </section>

            {/* Rule trace distribution — how often each
                deterministic routing rule fired across the
                window's suggestion audit rows. */}
            <section className="rounded-lg border border-default p-4 bg-white/[0.01]">
              <h2 className="text-xs uppercase tracking-widest text-muted font-bold mb-3">
                Router rule distribution
              </h2>
              {data.ruleTraceCounts.length === 0 ? (
                <p className="text-xs text-muted">
                  No router activity yet in this window. Upload a few files
                  to see which rules fire most often.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {data.ruleTraceCounts.map(({ rule, count }) => {
                    const max = data.ruleTraceCounts[0]?.count ?? 1;
                    const width = Math.max(
                      4,
                      Math.round((count / max) * 100)
                    );
                    const label = RULE_LABELS[rule] ?? rule;
                    return (
                      <li key={rule}>
                        <div className="flex items-baseline justify-between gap-2 text-xs mb-0.5">
                          <span className="text-secondary">
                            <span className="text-brand font-mono mr-1.5">
                              {rule}
                            </span>
                            {label}
                          </span>
                          <span className="text-muted tabular-nums">
                            {count}
                          </span>
                        </div>
                        <div className="h-1 rounded-full bg-surface overflow-hidden">
                          <div
                            className="h-full bg-ember-400/60"
                            style={{ width: `${width}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-[10px] text-muted mt-3 leading-relaxed">
                Per §A11: deterministic counts derived from facts (org chart,
                upload context, filename). Distribution shows where the
                router&apos;s value comes from — if R1 (surface context)
                dominates, files are mostly classified by where they came
                from; if R3 (uploader fallback) dominates, classification
                is mostly guessed from membership.
              </p>
            </section>
          </div>
        )}
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  sub,
}: {
  label: string;
  value: number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-default p-3 bg-white/[0.01]">
      <p className="text-[10px] uppercase tracking-widest text-muted font-bold">
        {label}
      </p>
      <p className="text-2xl font-bold text-primary mt-1">{value}</p>
      {sub && <p className="text-[10px] text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function MetricCard({
  title,
  value,
  tone,
  label,
  note,
  sub,
}: {
  title: string;
  value: string;
  tone: "good" | "warn" | "bad" | "noop";
  label: string;
  note: string;
  sub?: string;
}) {
  const toneClasses = {
    good: "border-emerald-500/30 bg-emerald-500/[0.04] text-emerald-300",
    warn: "border-amber-500/30 bg-amber-500/[0.04] text-accent-text",
    bad: "border-red-500/30 bg-red-500/[0.04] text-red-300",
    noop: "border-default bg-white/[0.01] text-muted",
  }[tone];
  return (
    <div className="rounded-lg border border-default p-4 bg-white/[0.01]">
      <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-1">
        {title}
      </p>
      <p className="text-3xl font-bold text-primary mb-1">{value}</p>
      {sub && <p className="text-[10px] text-muted mb-2">{sub}</p>}
      <div
        className={`rounded-md border px-2.5 py-1.5 text-xs flex flex-col gap-0.5 ${toneClasses}`}
      >
        <span className="font-bold uppercase tracking-widest text-[10px]">
          {label}
        </span>
        <span className="text-secondary leading-relaxed text-[11px]">
          {note}
        </span>
      </div>
    </div>
  );
}
