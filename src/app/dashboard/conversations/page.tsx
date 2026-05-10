"use client";

import TopBar from "@/components/layout/TopBar";
import StatusBadge from "@/components/ui/StatusBadge";
import { mockCompany } from "@/lib/mock-data";
import { Brain, MessageSquare, Plus, Send, Trash2 } from "lucide-react";
import { useState } from "react";

interface ActionItem {
  task: string;
  owner: string;
  priority: string;
  deadline: string;
}

interface ConversationResult {
  summary: string;
  keyPoints: string[];
  agreements: string[];
  unresolvedItems: string[];
  decision: string;
  actionPlan: ActionItem[];
  executiveNote: string;
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
  const [conversation, setConversation] = useState(exampleConversation);
  const [result, setResult] = useState<ConversationResult | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    if (!conversation.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/ai/conversation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversation }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      setResult(null);
      alert("Unable to analyze. Check your API key in .env.local.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0d16]">
      <TopBar title="Conversation Intelligence" subtitle={`${mockCompany.name} · Meeting & Thread Analysis`} />

      <div className="p-6 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="space-y-4">
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-[#5470ff]" />
                  <h2 className="text-sm font-semibold text-[#e8eaf6]">Paste Conversation</h2>
                </div>
                <button
                  onClick={() => setConversation("")}
                  className="text-[#5a6399] hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <p className="text-xs text-[#5a6399] mb-3">
                Paste a Slack thread, WhatsApp chat, meeting transcript, or email chain. ExecOS will extract decisions, action items, and generate a structured executive output.
              </p>

              <textarea
                value={conversation}
                onChange={(e) => setConversation(e.target.value)}
                placeholder="Paste your conversation, meeting transcript, or team thread here..."
                rows={16}
                className="w-full bg-[#12141f] border border-[#252840] rounded-xl px-4 py-3 text-sm text-[#8895c4] placeholder-[#3a3f5c] focus:outline-none focus:border-[#5470ff]/50 focus:ring-1 focus:ring-[#5470ff]/30 transition-colors resize-none font-mono leading-relaxed"
              />

              <button
                onClick={analyze}
                disabled={loading || !conversation.trim()}
                className="mt-3 w-full flex items-center justify-center gap-2 bg-[#5470ff] hover:bg-[#3a4ff7] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all shadow-glow hover:shadow-none text-sm"
              >
                <Brain className={`w-4 h-4 ${loading ? "animate-pulse" : ""}`} />
                {loading ? "Analyzing conversation..." : "Generate Decision & Action Plan"}
                {!loading && <Send className="w-4 h-4" />}
              </button>
            </div>

            {/* How it works */}
            <div className="glass-card p-5">
              <h3 className="text-xs font-semibold text-[#8895c4] uppercase tracking-widest mb-3">How it works</h3>
              <div className="space-y-2.5">
                {[
                  "Paste any team conversation, meeting transcript, or thread",
                  "AI identifies agreements, conflicts, and unresolved items",
                  "Generates a structured decision with full executive rationale",
                  "Creates an action plan with owners, priorities, and deadlines",
                  "Decision is stored in your Decision Memory for future reference",
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#5470ff]/15 border border-[#5470ff]/20 text-[#7a96ff] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {i + 1}
                    </span>
                    <p className="text-xs text-[#5a6399]">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Output Panel */}
          <div className="space-y-4">
            {!result ? (
              <div className="glass-card p-8 flex flex-col items-center justify-center text-center min-h-64">
                <div className="w-14 h-14 rounded-2xl bg-[#5470ff]/10 border border-[#5470ff]/20 flex items-center justify-center mb-4">
                  <Brain className="w-7 h-7 text-[#5470ff]" />
                </div>
                <p className="text-sm font-medium text-[#e8eaf6] mb-2">Ready to analyze</p>
                <p className="text-xs text-[#5a6399] max-w-xs">
                  Paste a conversation on the left and click Generate. ExecOS will turn it into decisions and tasks in seconds.
                </p>
              </div>
            ) : (
              <div className="space-y-4 fade-in">
                {/* Summary */}
                <div className="glass-card p-5">
                  <h3 className="text-xs font-semibold text-[#8895c4] uppercase tracking-widest mb-3">Summary</h3>
                  <p className="text-sm text-[#8895c4] leading-relaxed">{result.summary}</p>
                </div>

                {/* Decision */}
                <div className="glass-card p-5 border-[#5470ff]/20 bg-[#5470ff]/5">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-4 h-4 text-[#5470ff]" />
                    <h3 className="text-sm font-semibold text-[#e8eaf6]">Decision</h3>
                  </div>
                  <p className="text-sm text-[#e8eaf6] leading-relaxed font-medium">{result.decision}</p>
                </div>

                {/* Key Points + Agreements */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="glass-card p-4">
                    <h3 className="text-xs font-semibold text-[#8895c4] uppercase tracking-widest mb-3">Key Points</h3>
                    <ul className="space-y-2">
                      {result.keyPoints?.map((p, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-[#8895c4]">
                          <span className="w-1 h-1 rounded-full bg-[#5470ff] flex-shrink-0 mt-1.5" />
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="glass-card p-4">
                    <h3 className="text-xs font-semibold text-[#8895c4] uppercase tracking-widest mb-3">Unresolved</h3>
                    <ul className="space-y-2">
                      {result.unresolvedItems?.length > 0 ? (
                        result.unresolvedItems.map((item, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-yellow-400">
                            <span className="text-yellow-400">⚠</span>
                            {item}
                          </li>
                        ))
                      ) : (
                        <li className="text-xs text-emerald-400">All items resolved ✓</li>
                      )}
                    </ul>
                  </div>
                </div>

                {/* Action Plan */}
                <div className="glass-card p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-semibold text-[#e8eaf6]">Action Plan</h3>
                    <button className="flex items-center gap-1.5 text-xs text-[#7a96ff] border border-[#5470ff]/30 hover:border-[#5470ff]/60 px-3 py-1.5 rounded-lg transition-all">
                      <Plus className="w-3 h-3" />
                      Add to Tasks
                    </button>
                  </div>
                  <div className="space-y-3">
                    {result.actionPlan?.map((item, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 p-3 rounded-xl bg-[#12141f] border border-[#252840]">
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="w-5 h-5 rounded-full bg-[#5470ff]/15 border border-[#5470ff]/20 text-[#7a96ff] text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-[#e8eaf6]">{item.task}</p>
                            <p className="text-xs text-[#5a6399] mt-0.5">
                              Owner: {item.owner} · Due: {item.deadline}
                            </p>
                          </div>
                        </div>
                        <StatusBadge status={item.priority} />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Executive Note */}
                {result.executiveNote && (
                  <div className="glass-card p-4 border-emerald-500/20 bg-emerald-500/5">
                    <p className="text-xs font-semibold text-emerald-400 uppercase tracking-widest mb-2">Executive Note</p>
                    <p className="text-sm text-[#8895c4] leading-relaxed">{result.executiveNote}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
