"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Filter,
  Loader2,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";

/**
 * /dashboard/care/knowledge — the resolution corpus AS knowledge
 * base. Phase 7 commit 3.
 *
 * Constitutional sources:
 *   - §1.1 — every captured resolution is a permanent asset.
 *     This surface IS that principle made user-visible.
 *   - §1.6 — close-the-loop. Past resolutions feed future ones.
 *     The Co-Pilot already uses this corpus invisibly to draft
 *     replies; this page surfaces it so agents can browse the
 *     team's playbook directly.
 *   - §A8 — growth participant voice. The header reads "your
 *     team's playbook", framing the corpus as compounding
 *     institutional knowledge rather than a static article
 *     library.
 *   - §A11 — counts, never verdicts. No "best resolutions"
 *     ranking; durability outcome IS the count.
 *   - §A14 — every render branch (filter empty, filter
 *     populated, no results, with/without durability) verified.
 *   - §A18 — outcome chips are descriptive ("held" /
 *     "reopened" / "pending") not evaluative ("good" / "bad").
 *
 * The Zendesk reference shape this reframes
 * ─────────────────────────────────────────
 *   Zendesk: Knowledge Base (separately authored articles,
 *            page efficiency analytics, search analytics)
 *   ELOSTATE: Resolution corpus (past resolutions ARE the
 *             articles; no separate authoring; durability IS
 *             the page-efficiency analytic; the §A4 search
 *             story is deferred to embeddings).
 */

type KnowledgeResolution = {
  id: string;
  conversationId: string;
  capturedBy: string | null;
  capturedByName: string | null;
  issueSummary: string;
  whatWorked: string;
  category: string | null;
  createdAt: string;
  durability: {
    scheduledFor: string;
    checkedAt: string | null;
    outcome: "held" | "reopened" | "inconclusive" | null;
  } | null;
};

export default function CareKnowledgePage() {
  const [resolutions, setResolutions] = useState<KnowledgeResolution[] | null>(
    null
  );
  const [categories, setCategories] = useState<string[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [outcomeFilter, setOutcomeFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (categoryFilter) params.set("category", categoryFilter);
      if (outcomeFilter) params.set("outcome", outcomeFilter);
      const res = await fetch(
        `/api/care/agent/knowledge?${params.toString()}`
      );
      if (res.status === 403) {
        setError("Knowledge base is for support agents.");
        return;
      }
      if (!res.ok) {
        setError("Couldn't load.");
        return;
      }
      const data = await res.json();
      setResolutions(data.resolutions ?? []);
      setCategories(data.categories ?? []);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, outcomeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <>
      <header className="px-8 py-4 border-b border-default bg-base/60">
        <h1 className="text-lg font-semibold text-primary">Knowledge</h1>
        <p className="text-[11px] text-muted">
          Your team&apos;s playbook · every resolution captured · §1.1
          data-as-asset
        </p>
      </header>
      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-4xl w-full mx-auto space-y-5">
        {/* §A8 preamble — what this surface IS. */}
        <div className="bg-ember-400/5 border border-ember-400/30 rounded-lg p-3 flex items-start gap-2">
          <ShieldCheck
            className="w-4 h-4 text-brand shrink-0 mt-0.5"
            aria-hidden
          />
          <p className="text-xs text-secondary leading-relaxed">
            Past resolutions ARE the knowledge base. There&apos;s no
            separate article authoring — every conversation resolved
            with a captured outcome compounds into the team&apos;s
            playbook. The Co-Pilot already searches this corpus to
            draft new replies; this page lets you browse it directly.
          </p>
        </div>

        {/* Filters */}
        <div className="bg-white/[0.02] border border-default rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-brand" aria-hidden />
            <p className="text-xs uppercase tracking-widest text-muted font-bold">
              Filter
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
                Category
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full bg-base border border-default rounded-md px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:border-strong"
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
                Durability outcome
              </label>
              <select
                value={outcomeFilter}
                onChange={(e) => setOutcomeFilter(e.target.value)}
                className="w-full bg-base border border-default rounded-md px-2.5 py-1.5 text-sm text-primary focus:outline-none focus:border-strong"
              >
                <option value="">All outcomes (including pending)</option>
                <option value="held">Held</option>
                <option value="reopened">Reopened</option>
                <option value="inconclusive">Inconclusive</option>
              </select>
            </div>
          </div>
        </div>

        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted py-8 justify-center">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Loading…
          </div>
        )}
        {error && (
          <div className="bg-red-500/5 border border-red-500/30 rounded-lg p-4">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {!loading && !error && resolutions && (
          <>
            {resolutions.length === 0 ? (
              <div className="text-center py-12">
                <BookOpen
                  className="w-8 h-8 text-muted mx-auto mb-2"
                  aria-hidden
                />
                <p className="text-sm text-primary mb-1">
                  No resolutions match this filter.
                </p>
                <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
                  As your team captures resolutions in the Conversations
                  view, they appear here as the team&apos;s playbook.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {resolutions.map((r) => (
                  <ResolutionCard key={r.id} resolution={r} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

function ResolutionCard({
  resolution,
}: {
  resolution: KnowledgeResolution;
}) {
  return (
    <div className="bg-white/[0.02] border border-default rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-3.5 h-3.5 text-brand shrink-0" aria-hidden />
            <p className="text-sm font-semibold text-primary truncate">
              {resolution.issueSummary}
            </p>
          </div>
          <p className="text-[11px] text-muted">
            {resolution.category && (
              <span className="inline-block mr-2 px-1.5 py-0.5 rounded bg-arc-400/10 border border-arc-400/30 text-arc-300 text-[10px] uppercase tracking-widest font-bold">
                {resolution.category}
              </span>
            )}
            captured by{" "}
            <span className="text-secondary">
              {resolution.capturedByName ?? "an agent"}
            </span>{" "}
            · {resolution.createdAt.slice(0, 10)}
          </p>
        </div>
        <DurabilityChip durability={resolution.durability} />
      </div>
      <div className="mt-2 pt-2 border-t border-default/60">
        <p className="text-[10px] uppercase tracking-widest text-muted font-bold mb-1">
          What worked
        </p>
        <p className="text-xs text-secondary leading-relaxed whitespace-pre-wrap">
          {resolution.whatWorked}
        </p>
      </div>
      <div className="mt-3 pt-2 border-t border-default/60">
        <Link
          href={`/dashboard/care/conversations/${resolution.conversationId}`}
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-brand hover:text-ember-400"
        >
          Open the original conversation
          <ArrowRight className="w-3 h-3" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function DurabilityChip({
  durability,
}: {
  durability: KnowledgeResolution["durability"];
}) {
  if (!durability) {
    return null;
  }
  if (!durability.outcome) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-muted bg-surface/40 border border-default px-2 py-0.5 rounded">
        <Sparkles className="w-3 h-3" aria-hidden />
        Check pending
      </span>
    );
  }
  if (durability.outcome === "held") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded">
        <CheckCircle2 className="w-3 h-3" aria-hidden />
        Held
      </span>
    );
  }
  if (durability.outcome === "reopened") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded">
        <RotateCcw className="w-3 h-3" aria-hidden />
        Reopened
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-secondary bg-surface/40 border border-default px-2 py-0.5 rounded">
      <TriangleAlert className="w-3 h-3" aria-hidden />
      Inconclusive
    </span>
  );
}
