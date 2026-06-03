"use client";

import TopBar from "@/components/layout/TopBar";
import StatusBadge from "@/components/ui/StatusBadge";
import { useCompanyName } from "@/lib/hooks/useCompany";
import {
  loadDialogue,
  saveDialogue,
  clearDialogue,
} from "@/lib/dialogues/persistence";
import {
  Brain,
  ChevronRight,
  GitCompareArrows,
  Lightbulb,
  MessageCircleQuestion,
  MessageSquare,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";

interface RefinedAction {
  task: string;
  owner: string | null;
  priority: string;
  deadline: string | null;
  why: string;
}

interface DialogueResponse {
  engagement: string;
  addedPerspective: string;
  refinedDecision: { text: string; why: string };
  refinedActions: RefinedAction[];
  unresolvedItems: string[];
  comparison: string;
}

type Phase = "transcript" | "elicit" | "respond";

interface ConversationDialogueState {
  phase: Phase;
  conversation: string;
  userRead: string;
  response: DialogueResponse | null;
}

const exampleConversation = `CEO: We need to decide on the new pricing model before the board meeting next Thursday. The current flat-rate isn't scaling well.

Sarah: Agreed. I've been looking at the data — our enterprise clients are generating 4x more revenue per seat but paying the same as SMEs. We're leaving serious money on the table.

Marcus: From an engineering standpoint, usage-based billing would require about 3 weeks of backend work. We'd need to add metering infrastructure first.

James: The product angle is interesting — tiered pricing with a usage component could actually reduce churn. Users on the lower tier would have a natural upgrade path.

CEO: What's the risk if we push this live before Q2 closes?

Sarah: Main risk is existing contract renewals — we have 12 enterprise contracts up for renewal in May. If we change pricing mid-cycle, we need a grandfathering policy.

Marcus: We could go live with new pricing for net-new customers only in Q2, then migrate existing clients in Q3. That reduces technical and commercial risk.

CEO: James, what do users actually want?

James: Our last NPS survey showed 67% of power users want more flexibility in how they pay. Usage-based is preferred over flat-rate by our top tier.

CEO: Alright. Let's go with tiered pricing + usage for net-new customers in Q2. Sarah owns the enterprise contract strategy. Marcus starts backend planning this week. James prepares the communication plan for existing customers. We align on final pricing tiers by Friday.`;

export default function ConversationsPage() {
  const companyName = useCompanyName();
  const [phase, setPhase] = useState<Phase>("transcript");
  const [conversation, setConversation] = useState(exampleConversation);
  const [userRead, setUserRead] = useState("");
  const [response, setResponse] = useState<DialogueResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [restoredFrom, setRestoredFrom] = useState<string | null>(null);

  useEffect(() => {
    const persisted = loadDialogue<ConversationDialogueState>("conversation");
    if (persisted) {
      setPhase(persisted.state.phase);
      setConversation(persisted.state.conversation);
      setUserRead(persisted.state.userRead);
      setResponse(persisted.state.response);
      setRestoredFrom(persisted.savedAt);
    }
  }, []);

  useEffect(() => {
    const isPristine =
      conversation === exampleConversation &&
      !userRead.trim() &&
      !response;
    if (isPristine) return;
    saveDialogue<ConversationDialogueState>("conversation", {
      phase,
      conversation,
      userRead,
      response,
    });
  }, [phase, conversation, userRead, response]);

  const reset = () => {
    setPhase("transcript");
    setConversation(exampleConversation);
    setUserRead("");
    setResponse(null);
    setError("");
    setRestoredFrom(null);
    clearDialogue("conversation");
  };

  const requestSystem = async () => {
    if (!conversation.trim() || !userRead.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/ai/conversation-dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation, userRead }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unable to analyze.");
      setResponse(data);
      setPhase("respond");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-base">
      <TopBar
        title="Conversation Dialogue"
        subtitle={`${companyName} · Guide, don't overtake (CLAUDE.md §3.3)`}
      />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex items-start gap-3 p-3 rounded-xl bg-[#C8232C]/5 border border-[#C8232C]/20">
          <Brain className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
          <p className="text-xs text-secondary leading-relaxed">
            ExecOS will not extract decisions or action items until you state your own read.
            The people in the conversation are the authority on what it meant — the System
            sharpens, it does not assert.
          </p>
        </div>

        {restoredFrom && (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
            <p className="text-xs text-emerald-200">
              Restored from local save ({restoredFrom.slice(0, 19).replace("T", " ")}).
              Continue or reset to start fresh.
            </p>
            <button
              onClick={reset}
              className="text-xs text-emerald-200 hover:text-primary border border-emerald-500/30 hover:border-emerald-500/60 px-3 py-1 rounded-lg"
            >
              Reset dialogue
            </button>
          </div>
        )}

        <PhaseStepper current={phase} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: transcript + elicit */}
          <div className="space-y-4">
            <PhaseCard
              active={phase === "transcript"}
              number="1"
              title="Transcript"
              subtitle="Paste the conversation. The System is silent."
            >
              <div className="flex justify-end mb-2">
                <button
                  onClick={() => setConversation("")}
                  className="text-muted hover:text-red-400 transition-colors"
                  title="Clear"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <textarea
                value={conversation}
                onChange={(e) => setConversation(e.target.value)}
                disabled={phase !== "transcript"}
                rows={14}
                className="w-full bg-surface border border-default rounded-xl px-4 py-3 text-sm text-secondary placeholder:text-muted focus:outline-none focus:border-[#C8232C]/50 focus:ring-1 focus:ring-[#C8232C]/30 transition-colors resize-none font-mono leading-relaxed disabled:opacity-60"
              />
              {phase === "transcript" && (
                <div className="mt-3 flex justify-end">
                  <button
                    onClick={() => setPhase("elicit")}
                    disabled={!conversation.trim()}
                    className="flex items-center gap-2 bg-[#C8232C] hover:bg-[#A91D24] disabled:opacity-40 text-white font-semibold px-5 py-2.5 rounded-lg transition-all shadow-glow hover:shadow-none text-sm"
                  >
                    Continue <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </PhaseCard>

            {phase !== "transcript" && (
              <PhaseCard
                active={phase === "elicit"}
                number="2"
                title="Your read"
                subtitle="What was decided? What are the action items? Owners + deadlines if you noticed them."
              >
                <textarea
                  value={userRead}
                  onChange={(e) => setUserRead(e.target.value)}
                  disabled={phase !== "elicit"}
                  rows={8}
                  placeholder="Decision: ...
Action items:
  - Sarah owns ...
  - Marcus starts ...
Unresolved: ..."
                  className="w-full bg-surface border border-default rounded-xl px-4 py-3 text-sm text-primary placeholder:text-muted focus:outline-none focus:border-[#C8232C]/50 focus:ring-1 focus:ring-[#C8232C]/30 transition-colors resize-none leading-relaxed disabled:opacity-60"
                />
                {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
                {phase === "elicit" && (
                  <div className="mt-3 flex items-center justify-between">
                    <button
                      onClick={() => setPhase("transcript")}
                      className="text-xs text-muted hover:text-secondary"
                    >
                      ← back
                    </button>
                    <button
                      onClick={requestSystem}
                      disabled={loading || !userRead.trim()}
                      className="flex items-center gap-2 bg-[#C8232C] hover:bg-[#A91D24] disabled:opacity-40 text-white font-semibold px-5 py-2.5 rounded-lg transition-all shadow-glow hover:shadow-none text-sm"
                    >
                      <MessageCircleQuestion
                        className={`w-4 h-4 ${loading ? "animate-pulse" : ""}`}
                      />
                      {loading ? "Asking the System…" : "Ask the System"}
                    </button>
                  </div>
                )}
              </PhaseCard>
            )}

            <div className="glass-card p-5">
              <h3 className="text-xs font-semibold text-secondary uppercase tracking-widest mb-3">
                How it works
              </h3>
              <div className="space-y-2.5">
                {[
                  "Paste any team conversation, meeting transcript, or thread",
                  "State YOUR read first — decisions, action items, what's unresolved",
                  "The System engages your read, adds perspective only where it sees something you missed",
                  "Each suggested refinement comes with an explicit WHY",
                  "You decide what to keep — the System sharpens, it doesn't override",
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#C8232C]/15 border border-[#C8232C]/20 text-brand text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-xs text-muted">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: response */}
          <div className="space-y-4">
            {!response ? (
              <div className="glass-card p-8 flex flex-col items-center justify-center text-center min-h-64">
                <div className="w-14 h-14 rounded-2xl bg-[#C8232C]/10 border border-[#C8232C]/20 flex items-center justify-center mb-4">
                  <Lightbulb className="w-7 h-7 text-brand" />
                </div>
                <p className="text-sm font-medium text-primary mb-2">
                  System will respond after your read
                </p>
                <p className="text-xs text-muted max-w-xs">
                  Phase 2 captures your read; Phase 3 is where the System engages with it and
                  offers refinement.
                </p>
              </div>
            ) : (
              <div className="space-y-4 fade-in">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <p className="text-[10px] uppercase tracking-widest text-emerald-300 mb-2">
                    Engages your read
                  </p>
                  <p className="text-sm text-primary leading-relaxed">
                    {response.engagement}
                  </p>
                </div>

                {response.addedPerspective?.trim() && (
                  <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                    <p className="text-[10px] uppercase tracking-widest text-blue-300 mb-2">
                      Adds perspective
                    </p>
                    <p className="text-sm text-primary leading-relaxed">
                      {response.addedPerspective}
                    </p>
                  </div>
                )}

                <div className="glass-card p-5 border-[#C8232C]/20 bg-[#C8232C]/5">
                  <p className="text-[10px] uppercase tracking-widest text-brand mb-2">
                    Refined decision
                  </p>
                  <p className="text-sm font-medium text-primary mb-3 leading-snug">
                    {response.refinedDecision?.text}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-muted mb-1">
                    Why
                  </p>
                  <p className="text-xs text-secondary leading-relaxed">
                    {response.refinedDecision?.why}
                  </p>
                </div>

                <div className="glass-card p-5">
                  <p className="text-xs font-semibold text-primary mb-3">
                    Refined action items
                  </p>
                  <div className="space-y-3">
                    {response.refinedActions?.map((item, i) => (
                      <div
                        key={i}
                        className="rounded-xl bg-surface border border-default p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-3 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-[#C8232C]/15 border border-[#C8232C]/20 text-brand text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-primary">
                                {item.task}
                              </p>
                              <p className="text-xs text-muted mt-0.5">
                                Owner: {item.owner ?? "—"} · Due: {item.deadline ?? "—"}
                              </p>
                            </div>
                          </div>
                          <StatusBadge status={item.priority} />
                        </div>
                        <p className="mt-2 pl-8 text-[11px] text-muted italic leading-relaxed">
                          why: {item.why}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {response.unresolvedItems?.length > 0 && (
                  <div className="glass-card p-4 border-yellow-500/20 bg-yellow-500/5">
                    <p className="text-[10px] uppercase tracking-widest text-yellow-300 mb-2">
                      Unresolved
                    </p>
                    <ul className="space-y-1.5">
                      {response.unresolvedItems.map((u, i) => (
                        <li key={i} className="text-xs text-primary flex items-start gap-2">
                          <span className="text-yellow-400">⚠</span>
                          {u}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                  <p className="text-[10px] uppercase tracking-widest text-violet-300 mb-2 flex items-center gap-1.5">
                    <GitCompareArrows className="w-3 h-3" />
                    Compared to your read
                  </p>
                  <p className="text-sm text-primary leading-relaxed">
                    {response.comparison}
                  </p>
                </div>

                <button
                  onClick={reset}
                  className="flex items-center gap-2 text-xs text-brand hover:text-primary"
                >
                  <RotateCcw className="w-3 h-3" />
                  Start a new conversation
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Subcomponents (intentionally local — same pattern as Decisions page)
// ─────────────────────────────────────────────────────────────

function PhaseStepper({ current }: { current: Phase }) {
  const order: Phase[] = ["transcript", "elicit", "respond"];
  const labels = { transcript: "Transcript", elicit: "Your read", respond: "System" };
  return (
    <div className="flex items-center gap-2">
      {order.map((p, i) => {
        const reached = order.indexOf(current) >= i;
        const active = current === p;
        return (
          <div key={p} className="flex items-center gap-2">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                active
                  ? "bg-[#C8232C]/15 border-[#C8232C]/50 text-brand"
                  : reached
                  ? "border-default text-secondary"
                  : "border-default text-muted"
              }`}
            >
              <span className="font-mono">{i + 1}</span>
              {labels[p]}
            </div>
            {i < order.length - 1 && <ChevronRight className="w-3 h-3 text-muted" />}
          </div>
        );
      })}
    </div>
  );
}

function PhaseCard({
  active,
  number,
  title,
  subtitle,
  children,
}: {
  active: boolean;
  number: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`glass-card p-5 transition-opacity ${active ? "" : "opacity-60"}`}>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-[10px] font-mono text-brand">PHASE {number}</span>
        <h2 className="text-sm font-semibold text-primary">{title}</h2>
      </div>
      <p className="text-xs text-muted mb-4">{subtitle}</p>
      <MessageSquare className="hidden" />
      {children}
    </div>
  );
}
