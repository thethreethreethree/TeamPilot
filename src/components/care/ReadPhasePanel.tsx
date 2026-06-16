"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Eye,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";

/**
 * ReadPhasePanel — the §0 Understanding Gate for support.
 *
 * Before drafting a reply, the agent reviews:
 *   1. Has this customer been here before? (their prior history)
 *   2. Has another customer asked this before, and what worked?
 *      (similar resolutions across the company)
 *   3. The agent acknowledges the read by hitting "I've reviewed —
 *      drafting now." That marks reading_complete_at and signals
 *      this conversation got the discipline.
 *
 * No other support tool surfaces institutional memory this way at
 * the moment of drafting. This is where Care converts the company's
 * past resolution history into a head start for the next agent.
 */

type PriorConversation = {
  id: string;
  subject: string | null;
  status: string;
  createdAt: string;
};

type SimilarResolution = {
  id: string;
  issueSummary: string;
  whatWorked: string;
  category: string | null;
  createdAt: string;
};

type ReadData = {
  customerHasHistory: boolean;
  priorConversations: PriorConversation[];
  similarResolutions: SimilarResolution[];
  keywords: string[];
  readingCompleteAt: string | null;
};

export function ReadPhasePanel({
  conversationId,
  onReadComplete,
}: {
  conversationId: string;
  onReadComplete?: () => void;
}) {
  const [data, setData] = useState<ReadData | null>(null);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [marking, setMarking] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/care/agent/conversations/${conversationId}/read`
      );
      if (res.ok) {
        const d = (await res.json()) as ReadData;
        setData(d);
        // Auto-collapse if the agent has already completed the read.
        if (d.readingCompleteAt) setCollapsed(true);
      }
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const markComplete = async () => {
    setMarking(true);
    try {
      const res = await fetch(
        `/api/care/agent/conversations/${conversationId}/read`,
        { method: "POST" }
      );
      if (res.ok) {
        setData((d) =>
          d ? { ...d, readingCompleteAt: new Date().toISOString() } : d
        );
        setCollapsed(true);
        onReadComplete?.();
      }
    } finally {
      setMarking(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-6 mt-4 mb-2 border border-default rounded-lg p-3 text-xs text-muted flex items-center gap-2">
        <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
        Reading the context…
      </div>
    );
  }
  if (!data) return null;

  const hasAnyContext =
    data.customerHasHistory || data.similarResolutions.length > 0;

  return (
    <div className="mx-6 mt-4 mb-2 border rounded-lg overflow-hidden border-arc-400/30 bg-arc-400/[0.04]">
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-arc-400/[0.06] transition-colors"
      >
        <Eye className="w-3.5 h-3.5 text-arc-300 shrink-0" aria-hidden />
        <p className="text-[11px] font-semibold text-arc-300 flex-1">
          The Read Phase
          {data.readingCompleteAt && (
            <span className="ml-2 inline-flex items-center gap-1 text-[10px] text-emerald-300 font-normal">
              <CheckCircle2 className="w-3 h-3" aria-hidden />
              Reviewed
            </span>
          )}
        </p>
        <span className="text-[10px] text-muted">
          {data.customerHasHistory
            ? `${data.priorConversations.length} prior · ${data.similarResolutions.length} similar`
            : `${data.similarResolutions.length} similar`}
        </span>
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-muted" aria-hidden />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted" aria-hidden />
        )}
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-3">
          {!hasAnyContext ? (
            <p className="text-xs text-secondary leading-relaxed italic px-2">
              No prior history with this customer, and no similar past
              resolutions matched the keywords from their messages
              (
              {data.keywords.slice(0, 4).join(", ") || "none surfaced"}
              ). This is fresh ground — your reply will be the first
              piece of institutional memory for this kind of issue.
            </p>
          ) : (
            <>
              {data.customerHasHistory && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-arc-300 mb-1.5 flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" aria-hidden />
                    This customer has been here {data.priorConversations.length} time
                    {data.priorConversations.length === 1 ? "" : "s"} before
                  </p>
                  <ul className="space-y-1">
                    {data.priorConversations.slice(0, 3).map((p) => (
                      <li
                        key={p.id}
                        className="text-[11px] text-secondary flex items-baseline gap-1.5"
                      >
                        <span className="text-muted shrink-0">
                          {p.createdAt.slice(0, 10)} ·
                        </span>
                        <span className="truncate">
                          {p.subject ?? "Untitled"}
                        </span>
                        <span className="text-[10px] text-muted shrink-0">
                          ({p.status.replace(/_/g, " ")})
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {data.similarResolutions.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-arc-300 mb-1.5 flex items-center gap-1">
                    <BookOpen className="w-3 h-3" aria-hidden />
                    What worked for similar issues
                  </p>
                  <ul className="space-y-2">
                    {data.similarResolutions.map((r) => (
                      <li
                        key={r.id}
                        className="bg-base/40 border border-default rounded-md p-2"
                      >
                        <p className="text-[11px] text-primary font-medium leading-tight mb-0.5">
                          {r.issueSummary}
                        </p>
                        <p className="text-[11px] text-secondary leading-relaxed">
                          <span className="text-arc-300 font-semibold">
                            Worked:
                          </span>{" "}
                          {r.whatWorked}
                        </p>
                        {r.category && (
                          <p className="text-[10px] text-muted font-mono mt-1">
                            {r.category}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {!data.readingCompleteAt && (
            <div className="pt-2 border-t border-arc-400/20 flex items-center justify-between gap-2">
              <p className="text-[10px] text-muted italic">
                §0 Understanding precedes solving — confirm you&apos;ve
                reviewed the context before drafting.
              </p>
              <button
                type="button"
                onClick={() => void markComplete()}
                disabled={marking}
                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-arc-300 border border-arc-400/40 hover:border-arc-400/70 bg-arc-400/10 hover:bg-arc-400/15 disabled:opacity-50 px-2.5 py-1 rounded-md shrink-0"
              >
                {marking ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" aria-hidden />
                )}
                I&apos;ve reviewed
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
