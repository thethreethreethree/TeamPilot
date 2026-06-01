"use client";

import TopBar from "@/components/layout/TopBar";
import StatusBadge from "@/components/ui/StatusBadge";
import ScoreRing from "@/components/ui/ScoreRing";
import AwaitingEvidence from "@/components/ui/AwaitingEvidence";
import { mockCompany } from "@/lib/mock-data";
import { fetchTasks, type Task } from "@/lib/data/tasks";
import { supabaseEnabled } from "@/lib/supabase/client";
import { Brain, Database, Filter, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

type FilterType = "All" | "Blocked" | "In Progress" | "To Do" | "Needs Review" | "Completed";

const filters: FilterType[] = ["All", "Blocked", "In Progress", "To Do", "Needs Review", "Completed"];

const priorityColors: Record<string, string> = {
  Critical: "bg-red-500",
  High: "bg-orange-500",
  Medium: "bg-yellow-500",
  Low: "bg-[#3a3f5c]",
};

export default function OperationsPage() {
  const [activeFilter, setActiveFilter] = useState<FilterType>("All");
  const [aiDiagnosis, setAiDiagnosis] = useState("");
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isMock, setIsMock] = useState(true);
  const [seeding, setSeeding] = useState(false);

  useEffect(() => {
    fetchTasks().then(({ tasks, isMock }) => {
      setTasks(tasks);
      setIsMock(isMock);
    });
  }, []);

  const filtered =
    activeFilter === "All" ? tasks : tasks.filter((t) => t.status === activeFilter);

  const blockedCount = tasks.filter((t) => t.status === "Blocked").length;
  const inProgressCount = tasks.filter((t) => t.status === "In Progress").length;
  const criticalCount = tasks.filter((t) => t.priority === "Critical").length;

  const runDiagnosis = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tasks }),
      });
      const data = await res.json();
      setAiDiagnosis(data.diagnosis || JSON.stringify(data, null, 2));
    } catch {
      setAiDiagnosis("Unable to run diagnosis. Check your API key.");
    } finally {
      setLoading(false);
    }
  };

  const seedDemoData = async () => {
    setSeeding(true);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error);
      const refreshed = await fetchTasks();
      setTasks(refreshed.tasks);
      setIsMock(refreshed.isMock);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not seed demo data.");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0c0d16]">
      <TopBar
        title="Operations"
        subtitle={`${mockCompany.name} · Execution Intelligence`}
      />

      <div className="p-6 space-y-6 max-w-7xl mx-auto">
        {/* Data source banner */}
        {isMock && supabaseEnabled && (
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#5470ff]/5 border border-[#5470ff]/20">
            <div className="flex items-center gap-2.5">
              <Database className="w-4 h-4 text-[#7a96ff]" />
              <p className="text-xs text-[#8895c4]">
                You&apos;re viewing demo data. Seed your company with sample tasks to test live
                queries.
              </p>
            </div>
            <button
              onClick={seedDemoData}
              disabled={seeding}
              className="text-xs text-[#7a96ff] hover:text-white border border-[#5470ff]/30 hover:border-[#5470ff]/60 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
            >
              {seeding ? "Seeding…" : "Load demo data"}
            </button>
          </div>
        )}
        {isMock && !supabaseEnabled && (
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
            <Database className="w-4 h-4 text-yellow-300" />
            <p className="text-xs text-yellow-100">
              Demo mode — Supabase isn&apos;t configured. Add keys to <code>.env.local</code> to
              switch to live data.
            </p>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Operations Health", value: mockCompany.operationsScore, isScore: true },
            { label: "Blocked Tasks", value: blockedCount, color: "text-red-400", suffix: " tasks" },
            { label: "In Progress", value: inProgressCount, color: "text-blue-400", suffix: " tasks" },
            { label: "Critical Priority", value: criticalCount, color: "text-orange-400", suffix: " tasks" },
          ].map((stat) => (
            <div key={stat.label} className="glass-card p-4">
              {stat.isScore ? (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-[#5a6399] uppercase tracking-widest mb-1">{stat.label}</p>
                  </div>
                  <ScoreRing score={stat.value as number} size={60} isDemo={isMock} />
                </div>
              ) : (
                <div>
                  <p className="text-xs text-[#5a6399] uppercase tracking-widest mb-2">{stat.label}</p>
                  <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}<span className="text-sm font-normal text-[#5a6399]">{stat.suffix}</span></p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* AI Diagnosis Panel */}
        <div className="glass-card p-5 border-[#5470ff]/20">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-[#5470ff]" />
              <h2 className="text-sm font-semibold text-[#e8eaf6]">AI Operations Diagnosis</h2>
              <span className="text-[10px] text-[#5470ff] bg-[#5470ff]/10 border border-[#5470ff]/20 px-2 py-0.5 rounded-full">Claude</span>
            </div>
            <button
              onClick={runDiagnosis}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-[#7a96ff] hover:text-white border border-[#5470ff]/30 hover:border-[#5470ff]/60 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              {loading ? "Analyzing..." : "Run Diagnosis"}
            </button>
          </div>

          {aiDiagnosis ? (
            <pre className="text-xs text-[#8895c4] leading-relaxed whitespace-pre-wrap font-mono">{aiDiagnosis}</pre>
          ) : (
            <AwaitingEvidence
              domain="operations"
              hint="Repeated blocker observations on the same task, slipped due dates from multiple assignees, or recurring escalations from one team — once those accumulate, the gate clears."
            />
          )}
        </div>

        {/* Task Board */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-[#e8eaf6]">Task Board</h2>
            <div className="flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-[#5a6399]" />
              {filters.map((f) => (
                <button
                  key={f}
                  onClick={() => setActiveFilter(f)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                    activeFilter === f
                      ? "bg-[#5470ff]/15 text-[#7a96ff] border border-[#5470ff]/30"
                      : "text-[#5a6399] hover:text-[#8895c4] border border-transparent hover:border-[#252840]"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#252840]">
                  {["Task", "Department", "Assignee", "Priority", "AI Score", "Status", "Due"].map((h) => (
                    <th key={h} className="text-left text-xs font-medium text-[#5a6399] pb-3 pr-4 uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1a1d2e]">
                {filtered.map((task) => (
                  <tr key={task.id} className="hover:bg-[#12141f] transition-colors group">
                    <td className="py-3 pr-4">
                      <div>
                        <p className="text-sm font-medium text-[#e8eaf6] group-hover:text-white transition-colors">
                          {task.title}
                        </p>
                        {task.blockerReason && (
                          <p className="text-xs text-red-400 mt-0.5">⚠ {task.blockerReason}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-xs text-[#5a6399]">{task.department}</span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#5470ff]/20 border border-[#5470ff]/30 flex items-center justify-center text-[10px] font-bold text-[#7a96ff]">
                          {(task.assignee ?? "—").split(" ").map((n) => n[0]).join("")}
                        </div>
                        <span className="text-xs text-[#8895c4]">{task.assignee ?? "Unassigned"}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${priorityColors[task.priority]}`} />
                        <span className="text-xs text-[#8895c4]">{task.priority}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-[#252840] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${task.aiPriorityScore}%`,
                              background: task.aiPriorityScore >= 90 ? "#f87171" : task.aiPriorityScore >= 70 ? "#fbbf24" : "#5470ff",
                            }}
                          />
                        </div>
                        <span className="text-xs font-mono text-[#5a6399]">{task.aiPriorityScore}</span>
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      <StatusBadge status={task.status} />
                    </td>
                    <td className="py-3">
                      <span className="text-xs text-[#5a6399] font-mono">{task.dueDate}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
