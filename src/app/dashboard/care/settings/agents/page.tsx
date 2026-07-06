"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, UserCheck } from "lucide-react";
import { SettingsTabs } from "@/components/care/SettingsTabs";
import { useToast } from "@/components/ui/toast";
import { LearningHint } from "@/components/learning/LearningHint";

/**
 * Settings → Agents.
 *
 * Two surfaces composed:
 *   1. Toggle support-agent capability for any teammate (existing
 *      v5 behavior, preserved).
 *   2. Phase 6 commit 1 — admin per-agent routing settings:
 *      capacity (max_concurrent) and channels each agent receives
 *      auto-routed conversations on.
 *
 * Constitutional sources for the new surface:
 *   - §A6 Pillar 2 — the admin configures capacity + channels at
 *     the org level; the agent reads the same values on their own
 *     sidebar presence control. No shadow read.
 *   - §A10 — every value set here is visible on the agent's own
 *     self-view. The configuration page IS the only place the
 *     admin drills into individual agent state, and only because
 *     they're configuring it (not surveilling it).
 *   - §A11 — current load shows as a count ("3 of 5"), never as a
 *     "performance metric." Status surfaces (online/away/offline)
 *     so admin sees coverage gaps, not productivity scores.
 *   - §A18 — labels are descriptive. The current-load badge says
 *     "carrying 3 of 5" with no comparative verdict.
 */

type AgentPresence = {
  status: "online" | "away" | "offline";
  maxConcurrent: number;
  channels: string[];
  lastSeenAt: string;
  currentLoad: number;
};

type AgentRow = {
  id: string;
  fullName: string | null;
  role: string | null;
  isSupportAgent: boolean;
  presence: AgentPresence | null;
};

const ALL_CHANNELS: Array<{ key: string; label: string }> = [
  { key: "web_widget", label: "Web widget" },
  { key: "embedded_widget", label: "Embedded widget" },
  { key: "email", label: "Email" },
];

export default function CareAgentsPage() {
  const toast = useToast();
  const [agents, setAgents] = useState<AgentRow[] | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const res = await fetch("/api/care/agent/settings/agents");
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const toggleAgent = async (id: string, enabled: boolean) => {
    try {
      const res = await fetch("/api/care/agent/settings/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isSupportAgent: enabled }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(
          data.error
            ? `Could not update agent — ${data.error}`
            : `Could not update agent (status ${res.status}).`
        );
        return;
      }
      toast.success(enabled ? "Agent activated." : "Agent deactivated.");
      void refresh();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? `Could not update agent — ${e.message}`
          : "Could not update agent (network error)."
      );
    }
  };

  const saveRouting = async (
    id: string,
    patch: { maxConcurrent?: number; channels?: string[] }
  ) => {
    const res = await fetch("/api/care/agent/presence", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: id, ...patch }),
    });
    if (res.ok) {
      toast.success("Saved.");
      void refresh();
    } else {
      toast.error("Couldn't save routing settings.");
    }
  };

  return (
    <>
      <header className="px-4 md:px-8 py-4 border-b border-default bg-base/60">
        <h1 className="text-lg font-semibold text-primary">Settings</h1>
        <p className="text-[11px] text-muted">Agents</p>
      </header>
      <SettingsTabs />
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 max-w-4xl w-full mx-auto space-y-4">
        {/* §A10 preamble — same line on every admin visit. */}
        <div className="bg-ember-400/5 border border-ember-400/30 rounded-lg p-3 flex items-start gap-2">
          <ShieldCheck
            className="w-4 h-4 text-brand shrink-0 mt-0.5"
            aria-hidden
          />
          <p className="text-xs text-secondary leading-relaxed">
            Every routing value you set on an agent here is visible
            to that agent on their own sidebar presence control —
            their capacity, their channels. The admin is the
            configurator; the agent is the reader (§A10).
          </p>
        </div>

        <div className="bg-white/[0.02] border border-default rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-primary">
                Team members
              </h2>
              <p className="text-[11px] text-muted">
                Toggle support-agent capability + configure per-
                agent routing capacity and channels. Company admins
                (CEO/COO/admin) are agents implicitly.
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
                  a.role === "CEO" ||
                  a.role === "COO" ||
                  a.role === "admin";
                const isAgent = implicit || a.isSupportAgent;
                return (
                  <li key={a.id} className="py-4">
                    {/* Top row — identity + toggle */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-ember-400/15 border border-ember-400/30 flex items-center justify-center text-brand text-xs font-bold">
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
                      <div className="flex items-center gap-3">
                        {a.presence && (
                          <PresenceBadge presence={a.presence} />
                        )}
                        {implicit ? (
                          <span className="text-[10px] text-emerald-300 inline-flex items-center gap-1">
                            <UserCheck
                              className="w-3 h-3"
                              aria-hidden
                            />
                            Agent (implicit)
                          </span>
                        ) : (
                          <LearningHint
                            as="inline-block"
                            category="C.A.R.E · Settings"
                            title="Support-agent toggle"
                            whatItIs="Turns a teammate into a support agent — someone conversations can be routed to and who can pick them up."
                            why="Only people toggled on here (plus admins, who are agents implicitly) enter the routing pool. Leave someone off and they'll never receive an auto-routed conversation, no matter how busy the queue gets."
                            how="Check the box to activate a teammate as an agent; uncheck to remove them from routing. Their capacity and channels are set in the row that appears below."
                            principle="The routing pool is exactly who you put in it — nothing is assumed."
                          >
                            <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
                              <input
                                type="checkbox"
                                checked={a.isSupportAgent}
                                onChange={(e) =>
                                  void toggleAgent(a.id, e.target.checked)
                                }
                                className="accent-ember-400"
                              />
                              Agent
                            </label>
                          </LearningHint>
                        )}
                      </div>
                    </div>
                    {/* Routing settings row — only for agents with
                        a presence row (existing or auto-created). */}
                    {isAgent && a.presence && (
                      <RoutingControls
                        presence={a.presence}
                        onSave={(patch) => void saveRouting(a.id, patch)}
                      />
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

function PresenceBadge({ presence }: { presence: AgentPresence }) {
  const dotCls =
    presence.status === "online"
      ? "bg-emerald-400"
      : presence.status === "away"
        ? "bg-amber-400"
        : "bg-white/30";
  const textCls =
    presence.status === "online"
      ? "text-emerald-300"
      : presence.status === "away"
        ? "text-amber-300"
        : "text-muted";
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-mono ${textCls}`}
      title={`Currently carrying ${presence.currentLoad} of ${presence.maxConcurrent}`}
    >
      <span aria-hidden className={`w-2 h-2 rounded-full ${dotCls}`} />
      {presence.status}
      <span className="text-muted">
        · {presence.currentLoad}/{presence.maxConcurrent}
      </span>
    </span>
  );
}

function RoutingControls({
  presence,
  onSave,
}: {
  presence: AgentPresence;
  onSave: (patch: { maxConcurrent?: number; channels?: string[] }) => void;
}) {
  const [maxConcurrent, setMaxConcurrent] = useState(presence.maxConcurrent);
  const [channels, setChannels] = useState<string[]>(presence.channels);
  const dirty =
    maxConcurrent !== presence.maxConcurrent ||
    channels.length !== presence.channels.length ||
    channels.some((c) => !presence.channels.includes(c));

  return (
    <div className="mt-3 ml-10 grid grid-cols-1 md:grid-cols-[140px_1fr_auto] gap-3 items-end">
      <LearningHint
        as="block"
        category="C.A.R.E · Settings"
        title="Max concurrent"
        whatItIs="The most conversations this agent can be auto-assigned at once — their capacity ceiling."
        why="This is the guardrail against overload. Routing stops handing an agent new conversations once they hit this number, so nobody gets buried and every customer keeps getting real attention."
        how="Set a number the agent can genuinely hold at the same time. Their live count shows as '3 of 5' — the second number is this ceiling."
        principle="Capacity is a limit you set, not a target — protect focus by keeping it honest."
      >
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
            Max concurrent
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={50}
            value={maxConcurrent}
            onChange={(e) =>
              setMaxConcurrent(Math.max(0, parseInt(e.target.value, 10) || 0))
            }
            className="w-full bg-base border border-default rounded-md px-2 py-1.5 text-sm text-primary focus:outline-none focus:border-strong font-mono"
          />
        </div>
      </LearningHint>
      <LearningHint
        as="block"
        category="C.A.R.E · Settings"
        title="Routes from"
        whatItIs="Which channels — web widget, embedded widget, email — this agent receives auto-routed conversations from."
        why="Agents have different strengths and access. Restricting an agent to the channels they should handle keeps, say, email-only staff out of live chat and vice versa, so the right person meets each channel."
        how="Tick the channels this agent should take. Untick a channel to stop routing its conversations to them."
        principle="Route work to where the person can actually do it — channel fit is part of coverage."
      >
        <div>
          <label className="block text-[10px] uppercase tracking-widest text-muted mb-1">
            Routes from
          </label>
          <div className="flex flex-wrap gap-2">
            {ALL_CHANNELS.map((c) => {
              const on = channels.includes(c.key);
              return (
                <label
                  key={c.key}
                  className={`inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded border cursor-pointer ${
                    on
                      ? "border-emerald-500/40 bg-emerald-500/5 text-primary"
                      : "border-default bg-surface/40 text-muted hover:border-strong"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setChannels([...channels, c.key]);
                      } else {
                        setChannels(channels.filter((k) => k !== c.key));
                      }
                    }}
                    className="accent-emerald-400"
                  />
                  {c.label}
                </label>
              );
            })}
          </div>
        </div>
      </LearningHint>
      <LearningHint
        as="inline-block"
        category="C.A.R.E · Settings"
        title="Save routing"
        whatItIs="Commits this agent's capacity and channel changes to the routing engine."
        why="Nothing you change in this row takes effect until you save — and the same values then show on the agent's own presence control (§A10). The button stays disabled until there's an actual change to commit."
        how="Adjust capacity or channels, then click to save. The next conversation routes against the new settings."
        principle="Changes are proposals until saved; what's committed is what routing obeys."
      >
        <button
          type="button"
          disabled={!dirty}
          onClick={() => onSave({ maxConcurrent, channels })}
          className="text-[11px] font-semibold bg-ember-400 hover:bg-ember-500 disabled:opacity-40 disabled:cursor-not-allowed text-[#09090B] px-3 py-1.5 rounded-md"
        >
          Save routing
        </button>
      </LearningHint>
    </div>
  );
}
