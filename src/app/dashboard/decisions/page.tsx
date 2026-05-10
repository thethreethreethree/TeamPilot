"use client";

import TopBar from "@/components/layout/TopBar";
import { mockCompany, mockDecisionHistory } from "@/lib/mock-data";
import { Brain, CheckCircle2, RefreshCw, Shield, Swords, Zap } from "lucide-react";
import { useState } from "react";

interface DecisionOption {
  action: string;
  expectedOutcome: string;
  tradeoff: string;
}

interface DecisionResult {
  diagnosis: string;
  biggestRisk: string;
  options: {
    safe: DecisionOption;
    balanced: DecisionOption;
    aggressive: DecisionOption;
  };
  recommendation: string;
}

const exampleSituation = `We are experiencing a 9% drop in operations efficiency this week. Two critical tasks are blocked — our payment gateway integration and the v2.4 product deploy. Marcus Chen (Lead Engineer) is overloaded with 4 active tasks and 2 overdue items. The v2.4 deploy is blocked until the gateway is fixed. The board wants to know our status by Friday. We have 3 days to resolve or escalate.`;

export default function DecisionsPage() {
  const [situation, setSituation] = useState(exampleSituation);
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<"safe" | "balanced" | "aggressive" | null>(null);

  const generate = async () => {
    if (!situation.trim()) return;
    setLoading(true);
    setSelected(null);
    try {
      const res = await fetch("/api/ai/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ situation }),
      });
      const data = await res.json();
      setResult(data);
    } catch {
      alert("Unable to generate. Check your API key in .env.local.");
    } finally {
      setLoading(false);
    }
  };

  const optionConfig = {
    safe: {
      label: "Safe Option",
      icon: Shield,
      color: "text-blue-400",
      borderColor: "border-blue-500/30",
      bgColor: "bg-blue-500/5",
      activeBg: "bg-blue-500/10",
      activeBorder: "border-blue-500/50",
    },
    balanced: {
      label: "Balanced Option",
      icon: Zap,
      color: "text-emerald-400",
      borderColor: "border-emerald-500/30",
      bgColor: "bg-emerald-500/5",
      activeBg: "bg-emerald-500/10",
      activeBorder: "border-emerald-500/50",
    },
    aggressive: {
      label: "Aggressive Option",
      icon: Swords,
      color: "text-orange-400",
      borderColor: "border-orange-500/30",
      bgColor: "bg-orange-500/5",
      activeBg: "bg-orange-500/10",
      activeBorder: "border-orange-500/50",
    },
  };

  return (
    <div className="min-h-screen bg-[#0c0d16]">
      <TopBar title="AI Decision Engine" subtitle={`${mockCompany.name} · Structured Decision Making`} />

      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Input */}
        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-[#5470ff]" />
            <h2 className="text-sm font-semibold text-[#e8eaf6]">Describe the Situation</h2>
            <span className="text-[10px] text-[#5470ff] bg-[#5470ff]/10 border border-[#5470ff]/20 px-2 py-0.5 rounded-full">Claude AI</span>
          </div>
          <p className="text-xs text-[#5a6399] mb-3">
            Describe a business situation, operational problem, or decision you need to make. ExecOS will generate Safe, Balanced, and Aggressive options with expected outcomes.
          </p>
          <textarea
            value={situation}
            onChange={(e) => setSituation(e.target.value)}
            placeholder="Describe your situation..."
            rows={5}
            className="w-full bg-[#12141f] border border-[#252840] rounded-xl px-4 py-3 text-sm text-[#8895c4] placeholder-[#3a3f5c] focus:outline-none focus:border-[#5470ff]/50 focus:ring-1 focus:ring-[#5470ff]/30 transition-colors resize-none leading-relaxed"
          />
          <button
            onClick={generate}
            disabled={loading || !situation.trim()}
            className="mt-3 flex items-center gap-2 bg-[#5470ff] hover:bg-[#3a4ff7] disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold px-6 py-2.5 rounded-lg transition-all shadow-glow hover:shadow-none text-sm"
          >
            <Brain className={`w-4 h-4 ${loading ? "animate-pulse" : ""}`} />
            {loading ? "Generating decision options..." : "Generate Decision Options"}
          </button>
        </div>

        {result && (
          <div className="space-y-5 fade-in">
            {/* Diagnosis + Risk */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="glass-card p-5">
                <h3 className="text-xs font-semibold text-[#5a6399] uppercase tracking-widest mb-3">AI Diagnosis</h3>
                <p className="text-sm text-[#8895c4] leading-relaxed">{result.diagnosis}</p>
              </div>
              <div className="glass-card p-5 border-red-500/20 bg-red-500/5">
                <h3 className="text-xs font-semibold text-red-400 uppercase tracking-widest mb-3">Biggest Risk</h3>
                <p className="text-sm text-[#8895c4] leading-relaxed">{result.biggestRisk}</p>
              </div>
            </div>

            {/* Decision Options */}
            <div>
              <h2 className="text-sm font-semibold text-[#e8eaf6] mb-4">Decision Options</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(["safe", "balanced", "aggressive"] as const).map((key) => {
                  const config = optionConfig[key];
                  const option = result.options[key];
                  const Icon = config.icon;
                  const isSelected = selected === key;

                  return (
                    <button
                      key={key}
                      onClick={() => setSelected(isSelected ? null : key)}
                      className={`glass-card p-5 text-left transition-all border ${
                        isSelected
                          ? `${config.activeBorder} ${config.activeBg}`
                          : `${config.borderColor} ${config.bgColor} hover:border-opacity-60`
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <Icon className={`w-4 h-4 ${config.color}`} />
                        <span className={`text-sm font-semibold ${config.color}`}>{config.label}</span>
                        {isSelected && <CheckCircle2 className={`w-3.5 h-3.5 ml-auto ${config.color}`} />}
                      </div>
                      <p className="text-sm font-medium text-[#e8eaf6] mb-2 leading-snug">{option?.action}</p>
                      <div className="space-y-2 mt-3 pt-3 border-t border-[#252840]">
                        <div>
                          <p className="text-[10px] text-[#5a6399] uppercase tracking-wider mb-1">Expected Outcome</p>
                          <p className="text-xs text-[#8895c4] leading-relaxed">{option?.expectedOutcome}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-[#5a6399] uppercase tracking-wider mb-1">Tradeoff</p>
                          <p className="text-xs text-[#8895c4] leading-relaxed">{option?.tradeoff}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Recommendation */}
            <div className="glass-card p-5 border-[#5470ff]/20 bg-[#5470ff]/5">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-4 h-4 text-[#5470ff]" />
                <h3 className="text-sm font-semibold text-[#e8eaf6]">AI Recommendation</h3>
              </div>
              <p className="text-sm text-[#8895c4] leading-relaxed">{result.recommendation}</p>
              {selected && (
                <div className="mt-4 flex items-center gap-3">
                  <button className="flex items-center gap-2 bg-[#5470ff] hover:bg-[#3a4ff7] text-white font-semibold px-5 py-2.5 rounded-lg transition-all shadow-glow hover:shadow-none text-sm">
                    <CheckCircle2 className="w-4 h-4" />
                    Approve {optionConfig[selected].label} & Create Tasks
                  </button>
                  <button className="flex items-center gap-2 border border-[#3a3f5c] hover:border-[#5470ff]/50 text-[#8895c4] hover:text-white font-medium px-5 py-2.5 rounded-lg transition-all text-sm">
                    Save to Decision Memory
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Decision History */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[#e8eaf6]">Decision Memory</h2>
            <span className="text-xs text-[#5a6399]">{mockDecisionHistory.length} decisions stored</span>
          </div>
          <div className="space-y-3">
            {mockDecisionHistory.map((d) => (
              <div key={d.id} className="flex items-center justify-between p-3 rounded-xl bg-[#12141f] border border-[#252840] hover:border-[#3a3f5c] transition-colors">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-[#5470ff] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-[#e8eaf6]">{d.title}</p>
                    <p className="text-xs text-[#5a6399] mt-0.5">{d.date} · {d.outcome}</p>
                  </div>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                  d.executionStatus === "In Progress"
                    ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                    : d.executionStatus === "Blocked"
                    ? "bg-red-500/10 text-red-400 border-red-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                }`}>
                  {d.executionStatus}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
