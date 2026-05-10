"use client";

import TopBar from "@/components/layout/TopBar";
import ScoreRing from "@/components/ui/ScoreRing";
import StatusBadge from "@/components/ui/StatusBadge";
import {
  mockCompany,
  mockAlerts,
  mockDailyPriorities,
  mockTasks,
  mockDecisionHistory,
} from "@/lib/mock-data";
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronRight,
  Info,
  RefreshCw,
  Zap,
} from "lucide-react";
import { useState } from "react";
import Link from "next/link";

export default function CommandDashboard() {
  const [briefing, setBriefing] = useState<string>("");
  const [loadingBriefing, setLoadingBriefing] = useState(false);

  const criticalTasks = mockTasks.filter(
    (t) => t.status === "Blocked" || t.priority === "Critical"
  );
  const overdueTasks = mockTasks.filter(
    (t) =>
      new Date(t.dueDate) < new Date() &&
      t.status !== "Completed"
  );

  const generateBriefing = async () => {
    setLoadingBriefing(true);
    try {
      const res = await fetch("/api/ai/briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: mockCompany,
          alerts: mockAlerts,
          tasks: mockTasks,
        }),
      });
      const data = await res.json();
      setBriefing(data.briefing);
    } catch {
      setBriefing(
        "Unable to generate briefing. Please check your API key in .env.local."
      );
    } finally {
      setLoadingBriefing(false);
    }
  };

  const alertIcon = (type: string) => {
    if (type === "critical")
      return <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />;
    if (type === "warning")
      return <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />;
    return <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />;
  };

  return (
    <div className="min-h-screen bg-[#0c0d16]">
      <TopBar
        title="Command Center"
        subtitle={`${mockCompany.name} · CEO View`}
      />

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Business Health Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              label: "Business Health",
              score: mockCompany.healthScore,
              detail: "Overall company health",
            },
            {
              label: "Operations",
              score: mockCompany.operationsScore,
              detail: "Execution & task flow",
            },
            {
              label: "Team Intelligence",
              score: mockCompany.teamScore,
              detail: "Workload & performance",
            },
          ].map((item) => (
            <div key={item.label} className="glass-card p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-[#5a6399] uppercase tracking-widest mb-1">
                    {item.label}
                  </p>
                  <p className="text-sm text-[#8895c4]">{item.detail}</p>
                </div>
                <ScoreRing score={item.score} size={72} />
              </div>
              <div className="mt-4 h-1 rounded-full bg-[#252840] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${item.score}%`,
                    background:
                      item.score >= 80
                        ? "#34d399"
                        : item.score >= 60
                        ? "#fbbf24"
                        : "#f87171",
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column — Briefing + Priorities */}
          <div className="lg:col-span-2 space-y-5">
            {/* AI Executive Briefing */}
            <div className="glass-card p-5 border-[#5470ff]/20">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Brain className="w-4 h-4 text-[#5470ff]" />
                  <h2 className="text-sm font-semibold text-[#e8eaf6]">
                    AI Executive Briefing
                  </h2>
                  <span className="text-[10px] font-medium text-[#5470ff] bg-[#5470ff]/10 border border-[#5470ff]/20 px-2 py-0.5 rounded-full">
                    Powered by Claude
                  </span>
                </div>
                <button
                  onClick={generateBriefing}
                  disabled={loadingBriefing}
                  className="flex items-center gap-1.5 text-xs text-[#7a96ff] hover:text-white border border-[#5470ff]/30 hover:border-[#5470ff]/60 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3 h-3 ${loadingBriefing ? "animate-spin" : ""}`}
                  />
                  {loadingBriefing ? "Generating..." : "Generate"}
                </button>
              </div>

              {briefing ? (
                <div className="text-sm text-[#8895c4] leading-relaxed whitespace-pre-wrap">
                  {briefing}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-[#8895c4] leading-relaxed">
                    <span className="text-[#e8eaf6] font-medium">
                      Operations efficiency dropped 9% today
                    </span>{" "}
                    due to 2 critical blocked tasks in the payment and deployment
                    pipeline. Revenue exposure is high until the gateway fix is
                    unblocked.
                  </p>
                  <p className="text-sm text-[#8895c4] leading-relaxed">
                    <span className="text-[#e8eaf6] font-medium">
                      Team risk detected:
                    </span>{" "}
                    Marcus Chen is overloaded with 4 active tasks and 2 overdue.
                    Immediate workload redistribution to Lena Torres recommended.
                  </p>
                  <p className="text-xs text-[#5a6399] mt-3 italic">
                    This is demo data. Click &quot;Generate&quot; for a live AI
                    briefing.
                  </p>
                </div>
              )}
            </div>

            {/* Daily Priorities */}
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-4 h-4 text-[#fbbf24]" />
                <h2 className="text-sm font-semibold text-[#e8eaf6]">
                  Today&apos;s Priorities
                </h2>
              </div>
              <ol className="space-y-3">
                {mockDailyPriorities.map((p, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-[#5470ff]/15 border border-[#5470ff]/30 text-[#7a96ff] text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span className="text-sm text-[#8895c4]">{p}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Critical Tasks */}
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  <h2 className="text-sm font-semibold text-[#e8eaf6]">
                    Critical & Blocked Tasks
                  </h2>
                  <span className="text-xs font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                    {criticalTasks.length}
                  </span>
                </div>
                <Link
                  href="/dashboard/operations"
                  className="text-xs text-[#5a6399] hover:text-[#7a96ff] flex items-center gap-1 transition-colors"
                >
                  View all <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-3">
                {criticalTasks.slice(0, 3).map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start justify-between gap-3 p-3 rounded-xl bg-[#12141f] border border-[#252840] hover:border-[#3a3f5c] transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#e8eaf6] truncate">
                        {task.title}
                      </p>
                      {task.blockerReason && (
                        <p className="text-xs text-[#5a6399] mt-0.5 truncate">
                          Blocker: {task.blockerReason}
                        </p>
                      )}
                      <p className="text-xs text-[#5a6399] mt-0.5">
                        {task.assignee} · Due {task.dueDate}
                      </p>
                    </div>
                    <StatusBadge status={task.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column — Alerts + Decision History */}
          <div className="space-y-5">
            {/* Alerts */}
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold text-[#e8eaf6] mb-4">
                AI Alerts
              </h2>
              <div className="space-y-3">
                {mockAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`p-3 rounded-xl border text-sm ${
                      alert.type === "critical"
                        ? "bg-red-500/5 border-red-500/20"
                        : alert.type === "warning"
                        ? "bg-yellow-500/5 border-yellow-500/20"
                        : "bg-blue-500/5 border-blue-500/20"
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      {alertIcon(alert.type)}
                      <div>
                        <p className="font-medium text-[#e8eaf6] text-xs">
                          {alert.title}
                        </p>
                        <p className="text-[#5a6399] text-xs mt-0.5 leading-relaxed">
                          {alert.detail}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold text-[#e8eaf6] mb-4">
                Execution Snapshot
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: "Total Tasks",
                    value: mockTasks.length,
                    color: "text-[#e8eaf6]",
                  },
                  {
                    label: "Blocked",
                    value: mockTasks.filter((t) => t.status === "Blocked").length,
                    color: "text-red-400",
                  },
                  {
                    label: "In Progress",
                    value: mockTasks.filter((t) => t.status === "In Progress").length,
                    color: "text-blue-400",
                  },
                  {
                    label: "Completed",
                    value: mockTasks.filter((t) => t.status === "Completed").length,
                    color: "text-emerald-400",
                  },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-[#12141f] border border-[#252840] rounded-xl p-3 text-center"
                  >
                    <p className={`text-2xl font-bold ${stat.color}`}>
                      {stat.value}
                    </p>
                    <p className="text-xs text-[#5a6399] mt-1">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Decision History */}
            <div className="glass-card p-5">
              <h2 className="text-sm font-semibold text-[#e8eaf6] mb-4">
                Decision Memory
              </h2>
              <div className="space-y-3">
                {mockDecisionHistory.map((d) => (
                  <div
                    key={d.id}
                    className="p-3 rounded-xl bg-[#12141f] border border-[#252840]"
                  >
                    <p className="text-xs font-medium text-[#e8eaf6]">{d.title}</p>
                    <p className="text-xs text-[#5a6399] mt-1">{d.date}</p>
                    <div className="flex items-center gap-1.5 mt-2">
                      <CheckCircle2 className="w-3 h-3 text-[#5470ff]" />
                      <p className="text-xs text-[#5a6399]">{d.outcome}</p>
                    </div>
                    <StatusBadge
                      status={d.executionStatus}
                      className="mt-2"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
