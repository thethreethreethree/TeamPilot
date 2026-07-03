"use client";

import { useEffect, useState } from "react";
import { FileText, MessageCircleQuestion, Microscope } from "lucide-react";
import { LoadingButton } from "@/components/sales-coach/ui/LoadingButton";

/**
 * SessionCoachTools — C.A.R.E features applied to a Live Sales Coach
 * session (founder spec): Summarize, Ask coach, Dissect. Each reuses the
 * existing engine (§A21/§A13):
 *   - summarize  → /api/coach/sales-session/[id]/summarize
 *   - ask coach  → /api/coach/sales-session/[id]/ask-coach
 *   - dissect    → /api/coach/sales-session/dissect
 *
 * Spawn task + Decision dialogue were removed from this surface (founder
 * 2026-07-03). Their engines/routes are untouched — only the entry points
 * here are gone, so nothing else that calls those routes breaks (§1.5).
 */

type Tool = "summarize" | "ask" | "dissect" | null;
type DissectView = {
  hasSignal: boolean;
  strengths: { point: string; example: string; why: string }[];
  growthAreas: { opportunity: string; nextStep: string; why: string }[];
  standoutStrategy: { name: string; example: string; why: string } | null;
  overall?: string;
};

export function SessionCoachTools({
  sessionId,
}: {
  sessionId: string;
}) {
  const [tool, setTool] = useState<Tool>(null);

  return (
    <section className="rounded-xl border border-default bg-white/[0.01] p-4">
      <h2 className="text-sm font-semibold text-primary mb-3">Coach tools</h2>
      <div className="flex flex-wrap gap-2">
        <ToolButton
          icon={FileText}
          label="Summarize"
          active={tool === "summarize"}
          onClick={() => setTool(tool === "summarize" ? null : "summarize")}
        />
        <ToolButton
          icon={MessageCircleQuestion}
          label="Ask coach"
          active={tool === "ask"}
          onClick={() => setTool(tool === "ask" ? null : "ask")}
        />
        <ToolButton
          icon={Microscope}
          label="Dissect"
          active={tool === "dissect"}
          onClick={() => setTool(tool === "dissect" ? null : "dissect")}
        />
      </div>

      {tool === "summarize" && <SummarizePanel sessionId={sessionId} />}
      {tool === "ask" && <AskCoachPanel sessionId={sessionId} />}
      {tool === "dissect" && <DissectPanel sessionId={sessionId} />}
    </section>
  );
}

function ToolButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof FileText;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg border transition-colors ${
        active
          ? "border-ember-400/50 bg-ember-400/10 text-brand"
          : "border-default text-secondary hover:text-primary"
      }`}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden />
      {label}
    </button>
  );
}

function PanelBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 rounded-lg border border-default bg-base/40 p-3">
      {children}
    </div>
  );
}

/**
 * Dissect — a deep, full-conversation teaching evaluation. Reads back the
 * last one on open (no LLM cost), runs/re-runs on demand. Standout strategy
 * is shown FIRST as the thing to repeat; strengths before growth (tone law,
 * §A18 — not a scorecard).
 */
function DissectPanel({ sessionId }: { sessionId: string }) {
  const [loading, setLoading] = useState(false);
  const [dissect, setDissect] = useState<DissectView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/coach/sales-session/dissect?sessionId=${sessionId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive && d?.dissect) setDissect(d.dissect as DissectView);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, [sessionId]);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coach/sales-session/dissect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => null);
        throw new Error(b?.error ?? `Failed (${res.status}).`);
      }
      const d = await res.json();
      setDissect((d.dissect as DissectView) ?? null);
      if (!d.dissect?.hasSignal) {
        setError(
          "Not enough of your side of the conversation to teach from yet."
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't run the dissect.");
    } finally {
      setLoading(false);
    }
  };

  const hasContent = dissect?.hasSignal;

  return (
    <PanelBox>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-xs text-secondary">
          A deep, full-conversation evaluation — what you did well, where to
          grow, and your standout strategy.
        </p>
        <LoadingButton
          pending={loading}
          onClick={() => void run()}
          icon={<Microscope className="w-3.5 h-3.5" aria-hidden />}
          className="inline-flex items-center gap-1.5 shrink-0 bg-ember-400 hover:bg-ember-500 disabled:opacity-50 text-[#09090B] text-xs font-semibold px-3 py-1.5 rounded-lg"
        >
          {hasContent ? "Re-run" : "Dissect"}
        </LoadingButton>
      </div>

      {error && <p className="text-xs text-red-300">{error}</p>}

      {!hasContent && loaded && !loading && !error && (
        <p className="text-[11px] text-muted">
          Run a dissect once the conversation has enough of your side to teach
          from. It reasons from your coaching methodology.
        </p>
      )}

      {hasContent && (
        <div className="space-y-4 mt-1">
          {dissect.standoutStrategy && (
            <div className="rounded-lg border border-ember-400/40 bg-ember-400/[0.06] p-3">
              <p className="text-[10px] uppercase tracking-widest text-brand font-bold mb-1">
                Your standout strategy
              </p>
              <p className="text-sm font-semibold text-primary">
                {dissect.standoutStrategy.name}
              </p>
              {dissect.standoutStrategy.example && (
                <p className="text-xs text-secondary italic mt-1">
                  &ldquo;{dissect.standoutStrategy.example}&rdquo;
                </p>
              )}
              {dissect.standoutStrategy.why && (
                <p className="text-xs text-secondary mt-1">
                  {dissect.standoutStrategy.why}
                </p>
              )}
            </div>
          )}

          {dissect.strengths.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-emerald-300 font-bold mb-2">
                What you did well
              </p>
              <div className="space-y-2.5">
                {dissect.strengths.map((s, i) => (
                  <div key={i} className="text-xs">
                    <p className="text-primary font-medium">{s.point}</p>
                    {s.example && (
                      <p className="text-muted italic mt-0.5">
                        &ldquo;{s.example}&rdquo;
                      </p>
                    )}
                    {s.why && (
                      <p className="text-secondary mt-0.5">{s.why}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {dissect.growthAreas.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-amber-300 font-bold mb-2">
                Opportunities to grow
              </p>
              <div className="space-y-2.5">
                {dissect.growthAreas.map((g, i) => (
                  <div key={i} className="text-xs">
                    <p className="text-primary font-medium">{g.opportunity}</p>
                    {g.nextStep && (
                      <p className="text-secondary mt-0.5">
                        <span className="text-brand">Try next:</span> {g.nextStep}
                      </p>
                    )}
                    {g.why && <p className="text-muted mt-0.5">{g.why}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {dissect.overall && (
            <p className="text-xs text-secondary leading-relaxed border-t border-default pt-3">
              {dissect.overall}
            </p>
          )}
        </div>
      )}
    </PanelBox>
  );
}

function SummarizePanel({ sessionId }: { sessionId: string }) {
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/coach/sales-session/${sessionId}/summarize`,
        { method: "POST" }
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      setSummary(d.summary ?? "No summary returned.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PanelBox>
      <LoadingButton
        pending={loading}
        onClick={() => void run()}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-ember-400 disabled:opacity-60"
      >
        {summary ? "Re-summarize" : "Summarize this session"}
      </LoadingButton>
      {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
      {summary && (
        <p className="text-xs text-secondary leading-relaxed mt-2 whitespace-pre-wrap">
          {summary}
        </p>
      )}
    </PanelBox>
  );
}

function AskCoachPanel({ sessionId }: { sessionId: string }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    if (question.trim().length < 3) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/coach/sales-session/${sessionId}/ask-coach`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: question.trim() }),
        }
      );
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      setAnswer(d.answer ?? "No answer returned.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PanelBox>
      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask the coach about this call — e.g. 'How could I have handled the price objection?'"
        rows={2}
        className="w-full text-xs bg-base border border-default rounded-lg px-3 py-2 text-primary placeholder:text-muted focus:outline-none focus:border-strong resize-none"
      />
      <LoadingButton
        pending={loading}
        onClick={() => void ask()}
        disabled={question.trim().length < 3}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-ember-400 disabled:opacity-50"
      >
        Ask
      </LoadingButton>
      {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
      {answer && (
        <p className="text-xs text-secondary leading-relaxed mt-2 whitespace-pre-wrap">
          {answer}
        </p>
      )}
    </PanelBox>
  );
}

