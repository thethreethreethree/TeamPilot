"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  ListPlus,
  MessageCircleQuestion,
  GitBranch,
  Loader2,
  Check,
  Microscope,
} from "lucide-react";

/**
 * SessionCoachTools — the four C.A.R.E features applied to a Live Sales
 * Coach session (founder spec): Summarize, Spawn task, Ask coach,
 * Decision dialogue. Each reuses the existing engine (§A21/§A13):
 *   - summarize  → /api/coach/sales-session/[id]/summarize
 *   - ask coach  → /api/coach/sales-session/[id]/ask-coach
 *   - spawn task → the EXISTING /api/tasks/spawn (transcript mapped onto
 *                  contextType 'chat_messages'), then save via /api/tasks
 *   - decision   → the EXISTING /api/ai/decision-dialogue. The agent
 *                  gives THEIR diagnosis + proposal first (§3.3
 *                  guide-don't-overtake), then the System responds.
 */

type Segment = { speaker: "agent" | "customer" | "unknown"; text: string };
type Tool = "summarize" | "spawn" | "ask" | "decision" | "dissect" | null;
type DissectView = {
  hasSignal: boolean;
  strengths: { point: string; example: string; why: string }[];
  growthAreas: { opportunity: string; nextStep: string; why: string }[];
  standoutStrategy: { name: string; example: string; why: string } | null;
  overall?: string;
};
type TaskDraft = { title: string; description: string; steps: string[] };
type SystemResponse = {
  engagement?: string;
  addedPerspective?: string;
  suggestion?: { action?: string; why?: string };
  comparison?: string;
};

export function SessionCoachTools({
  sessionId,
  segments,
}: {
  sessionId: string;
  segments: Segment[];
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
          icon={ListPlus}
          label="Spawn task"
          active={tool === "spawn"}
          onClick={() => setTool(tool === "spawn" ? null : "spawn")}
        />
        <ToolButton
          icon={MessageCircleQuestion}
          label="Ask coach"
          active={tool === "ask"}
          onClick={() => setTool(tool === "ask" ? null : "ask")}
        />
        <ToolButton
          icon={GitBranch}
          label="Decision dialogue"
          active={tool === "decision"}
          onClick={() => setTool(tool === "decision" ? null : "decision")}
        />
        <ToolButton
          icon={Microscope}
          label="Dissect"
          active={tool === "dissect"}
          onClick={() => setTool(tool === "dissect" ? null : "dissect")}
        />
      </div>

      {tool === "summarize" && <SummarizePanel sessionId={sessionId} />}
      {tool === "spawn" && (
        <SpawnPanel sessionId={sessionId} segments={segments} />
      )}
      {tool === "ask" && <AskCoachPanel sessionId={sessionId} />}
      {tool === "decision" && <DecisionPanel sessionId={sessionId} />}
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
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 shrink-0 bg-ember-400 hover:bg-ember-500 disabled:opacity-50 text-[#09090B] text-xs font-semibold px-3 py-1.5 rounded-lg"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          ) : (
            <Microscope className="w-3.5 h-3.5" aria-hidden />
          )}
          {hasContent ? "Re-run" : "Dissect"}
        </button>
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
      <button
        type="button"
        onClick={() => void run()}
        disabled={loading}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-ember-400 disabled:opacity-60"
      >
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}
        {summary ? "Re-summarize" : "Summarize this session"}
      </button>
      {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
      {summary && (
        <p className="text-xs text-secondary leading-relaxed mt-2 whitespace-pre-wrap">
          {summary}
        </p>
      )}
    </PanelBox>
  );
}

function SpawnPanel({
  sessionId,
  segments,
}: {
  sessionId: string;
  segments: Segment[];
}) {
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState<TaskDraft | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spawn = async () => {
    setLoading(true);
    setError(null);
    setSaved(false);
    try {
      // Reuse the existing spawn engine via the chat_messages context —
      // the transcript IS a sequence of {author, body} turns. The engine
      // caps at 50 turns; for a long call take a HEAD+TAIL sample (first
      // 25 + last 25) so the close — often the most task-relevant part —
      // isn't silently dropped (audit F2, 2026-06-27).
      const sampled =
        segments.length <= 50
          ? segments
          : [...segments.slice(0, 25), ...segments.slice(-25)];
      const selectedMessages = sampled.map((s) => ({
        author: s.speaker,
        body: s.text,
      }));
      const res = await fetch("/api/tasks/spawn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contextType: "chat_messages",
          contextPayload: {
            chatTopicTitle: "Sales conversation follow-up",
            selectedMessages,
          },
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      if (d.suppressed) throw new Error("The engine declined to draft a task.");
      setDraft(d.task);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!draft) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          spawnSteps: draft.steps,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error ?? `HTTP ${res.status}`);
      }
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PanelBox>
      {!draft ? (
        <button
          type="button"
          onClick={() => void spawn()}
          disabled={loading || segments.length === 0}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-ember-400 disabled:opacity-50"
        >
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}
          Draft a follow-up task from this session
        </button>
      ) : null}
      {!draft && segments.length > 50 && (
        <p className="text-[11px] text-muted mt-1.5">
          Long call — the draft uses the first 25 and last 25 turns of{" "}
          {segments.length} (the opening and the close).
        </p>
      )}
      {draft && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-primary">{draft.title}</p>
          <p className="text-xs text-secondary whitespace-pre-wrap">
            {draft.description}
          </p>
          {draft.steps.length > 0 && (
            <ol className="text-xs text-secondary list-decimal list-inside space-y-0.5">
              {draft.steps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          )}
          {saved ? (
            <p className="inline-flex items-center gap-1 text-xs text-emerald-400">
              <Check className="w-3.5 h-3.5" aria-hidden />
              Saved to Tasks
            </p>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void save()}
                disabled={loading}
                className="text-xs font-semibold text-[#09090B] bg-ember-400 hover:bg-ember-500 disabled:opacity-60 px-2.5 py-1 rounded-md"
              >
                Save to Tasks
              </button>
              <button
                type="button"
                onClick={() => setDraft(null)}
                className="text-xs text-muted hover:text-secondary"
              >
                Discard
              </button>
            </div>
          )}
        </div>
      )}
      {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
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
      <button
        type="button"
        onClick={() => void ask()}
        disabled={loading || question.trim().length < 3}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-ember-400 disabled:opacity-50"
      >
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}
        Ask
      </button>
      {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
      {answer && (
        <p className="text-xs text-secondary leading-relaxed mt-2 whitespace-pre-wrap">
          {answer}
        </p>
      )}
    </PanelBox>
  );
}

function DecisionPanel({ sessionId }: { sessionId: string }) {
  const [situation, setSituation] = useState("");
  const [userDiagnosis, setDiagnosis] = useState("");
  const [userProposal, setProposal] = useState("");
  const [loading, setLoading] = useState(false);
  const [resp, setResp] = useState<SystemResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready =
    situation.trim().length >= 20 &&
    userDiagnosis.trim().length >= 20 &&
    userProposal.trim().length >= 20;

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/decision-dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          situation: situation.trim(),
          userDiagnosis: userDiagnosis.trim(),
          userProposal: userProposal.trim(),
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error ?? `HTTP ${res.status}`);
      if (d.suppressed) throw new Error("The dialogue was suppressed.");
      setResp(d as SystemResponse);
      // Audit F1 (2026-06-27): persist the decision as an append-only
      // asset (§1.1/§3.1), like the chat decision dialogue does.
      // Fire-and-forget — the dialogue still shows if this fails.
      void fetch(`/api/coach/sales-session/${sessionId}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          situation: situation.trim(),
          userDiagnosis: userDiagnosis.trim(),
          userProposal: userProposal.trim(),
          systemResponse: d,
        }),
      }).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PanelBox>
      <p className="text-[11px] text-muted mb-2">
        Your read comes first — the coach responds after you&apos;ve thought it
        through (each field needs ~20+ characters).
      </p>
      <div className="space-y-2">
        <Field
          label="The decision / situation from this call"
          value={situation}
          onChange={setSituation}
        />
        <Field
          label="What YOU think is going on"
          value={userDiagnosis}
          onChange={setDiagnosis}
        />
        <Field
          label="What YOU propose to do"
          value={userProposal}
          onChange={setProposal}
        />
      </div>
      <button
        type="button"
        onClick={() => void run()}
        disabled={loading || !ready}
        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:text-ember-400 disabled:opacity-50"
      >
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />}
        Get the coach&apos;s read
      </button>
      {error && <p className="text-xs text-red-300 mt-2">{error}</p>}
      {resp && (
        <div className="mt-3 space-y-2 border-t border-default pt-3">
          {resp.engagement && (
            <p className="text-xs text-secondary leading-relaxed">
              {resp.engagement}
            </p>
          )}
          {resp.addedPerspective && (
            <p className="text-xs text-secondary leading-relaxed">
              <span className="text-muted">Added perspective: </span>
              {resp.addedPerspective}
            </p>
          )}
          {resp.suggestion?.action && (
            <div className="rounded-md border border-ember-400/30 bg-ember-400/[0.04] p-2.5">
              <p className="text-xs text-primary font-medium">
                {resp.suggestion.action}
              </p>
              {resp.suggestion.why && (
                <p className="text-[11px] text-secondary mt-1">
                  {resp.suggestion.why}
                </p>
              )}
            </div>
          )}
          {resp.comparison && (
            <p className="text-[11px] text-muted leading-relaxed">
              {resp.comparison}
            </p>
          )}
        </div>
      )}
    </PanelBox>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-[11px] text-muted">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={2}
        className="mt-1 w-full text-xs bg-base border border-default rounded-lg px-3 py-2 text-primary placeholder:text-muted focus:outline-none focus:border-strong resize-none"
      />
    </label>
  );
}
