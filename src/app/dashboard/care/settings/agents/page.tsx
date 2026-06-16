"use client";

import { useEffect, useState } from "react";
import { Loader2, UserCheck } from "lucide-react";
import { SettingsTabs } from "@/components/care/SettingsTabs";

type AgentRow = {
  id: string;
  fullName: string | null;
  role: string | null;
  isSupportAgent: boolean;
};

export default function CareAgentsPage() {
  const [agents, setAgents] = useState<AgentRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/care/agent/settings/agents");
        if (res.ok) {
          const data = await res.json();
          setAgents(data.agents ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = async (id: string, enabled: boolean) => {
    const res = await fetch("/api/care/agent/settings/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isSupportAgent: enabled }),
    });
    if (res.ok && agents) {
      setAgents(agents.map((a) => (a.id === id ? { ...a, isSupportAgent: enabled } : a)));
    }
  };

  return (
    <>
      <header className="px-8 py-4 border-b border-default bg-base/60">
        <h1 className="text-lg font-semibold text-primary">Settings</h1>
        <p className="text-[11px] text-muted">Agents</p>
      </header>
      <SettingsTabs />
      <div className="flex-1 overflow-y-auto px-8 py-6 max-w-4xl w-full mx-auto">
        <div className="bg-white/[0.02] border border-default rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-primary">Team members</h2>
              <p className="text-[11px] text-muted">
                Toggle support-agent capability for any teammate.
                Company admins (CEO/COO/admin) are agents implicitly.
              </p>
            </div>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted py-6 justify-center">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              Loading…
            </div>
          ) : !agents || agents.length === 0 ? (
            <p className="text-xs text-muted py-6 text-center">
              No teammates loaded.
            </p>
          ) : (
            <ul className="divide-y divide-default">
              {agents.map((a) => {
                const implicit =
                  a.role === "CEO" || a.role === "COO" || a.role === "admin";
                return (
                  <li
                    key={a.id}
                    className="flex items-center justify-between py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#FACC15]/15 border border-[#FACC15]/30 flex items-center justify-center text-brand text-xs font-bold">
                        {(a.fullName ?? "?").slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm text-primary">
                          {a.fullName ?? "Unnamed"}
                        </p>
                        <p className="text-[10px] text-muted uppercase tracking-widest">
                          {a.role ?? "Member"}
                        </p>
                      </div>
                    </div>
                    {implicit ? (
                      <span className="text-[10px] text-emerald-300 inline-flex items-center gap-1">
                        <UserCheck className="w-3 h-3" aria-hidden />
                        Agent (implicit)
                      </span>
                    ) : (
                      <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={a.isSupportAgent}
                          onChange={(e) => void toggle(a.id, e.target.checked)}
                          className="accent-[#FACC15]"
                        />
                        Agent
                      </label>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
