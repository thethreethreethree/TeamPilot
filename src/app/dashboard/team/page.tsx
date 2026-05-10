"use client";

import TopBar from "@/components/layout/TopBar";
import StatusBadge from "@/components/ui/StatusBadge";
import ScoreRing from "@/components/ui/ScoreRing";
import { mockTeamMembers, mockCompany } from "@/lib/mock-data";
import { AlertTriangle, Brain, RefreshCw, Users } from "lucide-react";
import { useState } from "react";

export default function TeamPage() {
  const [aiInsight, setAiInsight] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const overloaded = mockTeamMembers.filter((m) => m.workloadLevel === "Overloaded");
  const underutilized = mockTeamMembers.filter((m) => m.workloadLevel === "Underutilized");

  const runTeamAnalysis = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ team: mockTeamMembers, company: mockCompany }),
      });
      const data = await res.json();
      setAiInsight(data.briefing);
    } catch {
      setAiInsight("Unable to analyze. Check your API key.");
    } finally {
      setLoading(false);
    }
  };

  const workloadColor = (level: string) => {
    if (level === "Overloaded") return "text-red-400";
    if (level === "High") return "text-orange-400";
    if (level === "Balanced") return "text-emerald-400";
    return "text-yellow-400";
  };

  return (
    <div className="min-h-screen bg-[#0c0d16]">
      <TopBar title="Team Intelligence" subtitle={`${mockCompany.name} · Workforce Analysis`} />

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Team Health", value: mockCompany.teamScore, isScore: true },
            { label: "Total Members", value: mockTeamMembers.length, color: "text-[#e8eaf6]" },
            { label: "Overloaded", value: overloaded.length, color: "text-red-400" },
            { label: "Underutilized", value: underutilized.length, color: "text-yellow-400" },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-4">
              {stat.isScore ? (
                <div className="flex items-center justify-between">
                  <p className="text-xs text-[#5a6399] uppercase tracking-widest">{stat.label}</p>
                  <ScoreRing score={stat.value as number} size={60} />
                </div>
              ) : (
                <div>
                  <p className="text-xs text-[#5a6399] uppercase tracking-widest mb-2">{stat.label}</p>
                  <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* AI Team Analysis */}
        <div className="glass-card p-5 border-[#5470ff]/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-[#5470ff]" />
              <h2 className="text-sm font-semibold text-[#e8eaf6]">AI Team Analysis</h2>
              <span className="text-[10px] text-[#5470ff] bg-[#5470ff]/10 border border-[#5470ff]/20 px-2 py-0.5 rounded-full">Claude</span>
            </div>
            <button
              onClick={runTeamAnalysis}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-[#7a96ff] hover:text-white border border-[#5470ff]/30 hover:border-[#5470ff]/60 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Analyzing..." : "Analyze Team"}
            </button>
          </div>

          {aiInsight ? (
            <div className="text-sm text-[#8895c4] leading-relaxed whitespace-pre-wrap">{aiInsight}</div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/5 border border-red-500/15">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#8895c4]">
                  <span className="text-[#e8eaf6] font-medium">Marcus Chen is critically overloaded.</span>{" "}
                  4 active tasks, 2 overdue, and 2 blocked. Burnout risk is high. Immediate redistribution required.
                </p>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/15">
                <Users className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#8895c4]">
                  <span className="text-[#e8eaf6] font-medium">Lena Torres is underutilized</span> with only 1 active task.
                  Recommend reassigning 1-2 tasks from Marcus to Lena immediately.
                </p>
              </div>
              <p className="text-xs text-[#5a6399] italic">Click "Analyze Team" for a live AI assessment.</p>
            </div>
          )}
        </div>

        {/* Team Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {mockTeamMembers.map((member) => (
            <div
              key={member.id}
              onClick={() => setSelected(selected === member.id ? null : member.id)}
              className="glass-card p-5 cursor-pointer hover:border-[#3a3f5c] transition-all"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#5470ff]/30 to-[#7a96ff]/20 border border-[#5470ff]/20 flex items-center justify-center text-sm font-bold text-[#7a96ff]">
                    {member.avatar}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[#e8eaf6]">{member.name}</p>
                    <p className="text-xs text-[#5a6399]">{member.role} · {member.department}</p>
                  </div>
                </div>
                <StatusBadge status={member.workloadLevel} />
              </div>

              {/* Scores */}
              <div className="flex items-center justify-around py-3 border-t border-b border-[#252840] mb-4">
                <div className="text-center">
                  <ScoreRing score={member.performanceScore} size={52} />
                  <p className="text-[10px] text-[#5a6399] mt-1">Performance</p>
                </div>
                <div className="text-center">
                  <ScoreRing score={member.consistencyScore} size={52} />
                  <p className="text-[10px] text-[#5a6399] mt-1">Consistency</p>
                </div>
              </div>

              {/* Task stats */}
              <div className="grid grid-cols-4 gap-2 text-center">
                {[
                  { label: "Active", value: member.activeTasks, color: "text-blue-400" },
                  { label: "Done", value: member.completedTasks, color: "text-emerald-400" },
                  { label: "Overdue", value: member.overdueTasks, color: "text-red-400" },
                  { label: "Blocked", value: member.blockedTasks, color: "text-orange-400" },
                ].map((s) => (
                  <div key={s.label}>
                    <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-[#5a6399]">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Workload bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-[#5a6399]">Workload</span>
                  <span className={`text-[10px] font-medium ${workloadColor(member.workloadLevel)}`}>
                    {member.workloadLevel}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[#252840] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: member.workloadLevel === "Overloaded" ? "95%" :
                             member.workloadLevel === "High" ? "75%" :
                             member.workloadLevel === "Balanced" ? "55%" : "25%",
                      background: member.workloadLevel === "Overloaded" ? "#f87171" :
                                  member.workloadLevel === "High" ? "#fb923c" :
                                  member.workloadLevel === "Balanced" ? "#34d399" : "#fbbf24",
                    }}
                  />
                </div>
              </div>

              <p className="text-[10px] text-[#5a6399] mt-3">
                Last active: {member.recentActivity}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
