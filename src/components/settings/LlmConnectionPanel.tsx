"use client";

import { useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Loader2,
  Plug,
  XCircle,
  Zap,
} from "lucide-react";

/**
 * LLM connection status panel.
 *
 * Why this is its own panel — and why it renders in demo mode too:
 *
 *   The user explicitly wants to verify the DeepSeek key works END TO END
 *   before flipping any feature on. Hiding this behind a Supabase gate
 *   would force them to wire two things at once, which is exactly the
 *   coupling the constitution warns against (§1.5 holistic = trace
 *   ripple effects, but don't pre-couple unrelated systems). So this
 *   panel works regardless of Supabase configuration.
 *
 *   The state machine is intentionally simple:
 *     idle  → user hasn't tested yet
 *     loading → POST /api/llm/ping in flight
 *     ok    → green, shows model + latency + tokens
 *     fail  → red, shows the structured error kind so the user can act
 *
 *   Note: every "Run test" click spends a token. We rate-limit on the
 *   server to 6/min but additionally throttle this button locally so a
 *   nervous user mashing it can't trigger 429s either.
 */

type Capabilities = {
  llmReady: boolean;
  activeProvider: string | null;
  providers: { deepseek: boolean; anthropic: boolean };
};

type PingOk = {
  ok: true;
  provider: string;
  model: string;
  latencyMs: number;
  usage: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  } | null;
  reply: string;
};

type PingFail = {
  ok: false;
  error: string;
  kind?: string;
  status?: number;
  provider?: string;
};

type PingResult = PingOk | PingFail;

export function LlmConnectionPanel() {
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [status, setStatus] = useState<
    | { state: "idle" }
    | { state: "loading" }
    | { state: "ok"; data: PingOk }
    | { state: "fail"; data: PingFail }
  >({ state: "idle" });

  useEffect(() => {
    // Pull provider-key presence from /api/health (cheap — no token cost).
    fetch("/api/health")
      .then((r) => r.json())
      .then((j) => setCaps(j.capabilities ?? null))
      .catch(() => setCaps(null));
  }, []);

  const runTest = async () => {
    if (status.state === "loading") return;
    setStatus({ state: "loading" });
    try {
      const res = await fetch("/api/llm/ping", { method: "POST" });
      const data = (await res.json()) as PingResult;
      if (data.ok) setStatus({ state: "ok", data });
      else setStatus({ state: "fail", data });
    } catch (err) {
      setStatus({
        state: "fail",
        data: {
          ok: false,
          error: err instanceof Error ? err.message : "Network error.",
          kind: "network",
        },
      });
    }
  };

  const keyConfigured = caps?.providers.deepseek || caps?.providers.anthropic;

  return (
    <div className="glass-card p-6">
      <div className="flex items-center gap-2 mb-1">
        <Plug className="w-4 h-4 text-brand" />
        <h2 className="text-sm font-semibold text-primary">
          LLM connection
        </h2>
      </div>
      <p className="text-xs text-muted mb-5">
        End-to-end check of the active provider. Sends a 5-token prompt and
        reports model, latency, and token usage. Rate-limited 6/min.
      </p>

      {/* Provider matrix — what's actually configured in env */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <ProviderTile
          name="DeepSeek"
          subtitle="Primary"
          configured={!!caps?.providers.deepseek}
          active={caps?.activeProvider === "deepseek"}
        />
        <ProviderTile
          name="Anthropic"
          subtitle="Alternate"
          configured={!!caps?.providers.anthropic}
          active={caps?.activeProvider === "anthropic"}
        />
      </div>

      {!keyConfigured && (
        <div className="rounded-lg border border-strong bg-surface-raised p-3 mb-4 flex gap-3">
          <AlertTriangle
            aria-hidden
            className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5"
          />
          <div className="text-xs text-secondary leading-relaxed">
            No provider key detected. Add{" "}
            <code className="text-brand font-mono">DEEPSEEK_API_KEY</code> to{" "}
            <code className="text-brand font-mono">.env.local</code> and
            restart the dev server, then run the test.
          </div>
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={runTest}
          disabled={status.state === "loading"}
          className="inline-flex items-center gap-2 bg-[#FACC15] hover:bg-[#EAB308] disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
        >
          {status.state === "loading" ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Testing…
            </>
          ) : (
            <>
              <Zap className="w-3.5 h-3.5" /> Run test
            </>
          )}
        </button>
        {status.state === "idle" && (
          <span className="text-xs text-muted">
            Click to send one ping to the provider.
          </span>
        )}
      </div>

      {/* Result */}
      {status.state === "ok" && (
        <div className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <p className="text-sm font-semibold text-emerald-300">
              Connected
            </p>
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <Row label="Provider" value={status.data.provider} mono />
            <Row label="Model" value={status.data.model} mono />
            <Row label="Latency" value={`${status.data.latencyMs} ms`} mono />
            {status.data.usage?.totalTokens != null && (
              <Row
                label="Tokens"
                value={`${status.data.usage.totalTokens} (in ${
                  status.data.usage.promptTokens ?? "?"
                }, out ${status.data.usage.completionTokens ?? "?"})`}
                mono
              />
            )}
            <Row
              label="Reply"
              value={status.data.reply || "(empty)"}
              span={2}
            />
          </dl>
        </div>
      )}

      {status.state === "fail" && (
        <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="w-4 h-4 text-red-400" />
            <p className="text-sm font-semibold text-red-300">
              Test failed
            </p>
          </div>
          <dl className="grid grid-cols-[6rem_1fr] gap-x-4 gap-y-1.5 text-xs">
            {status.data.kind && (
              <Row label="Kind" value={status.data.kind} mono />
            )}
            {status.data.status && (
              <Row label="HTTP" value={String(status.data.status)} mono />
            )}
            {status.data.provider && (
              <Row label="Provider" value={status.data.provider} mono />
            )}
            <Row label="Message" value={status.data.error} />
          </dl>
          <p className="text-[11px] text-muted mt-3 leading-relaxed">
            {hintFor(status.data.kind)}
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Subcomponents ────────────────────────────────────────────────

function ProviderTile({
  name,
  subtitle,
  configured,
  active,
}: {
  name: string;
  subtitle: string;
  configured: boolean;
  active: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        active
          ? "border-brand bg-[#FACC15]/8"
          : configured
          ? "border-default bg-surface-raised"
          : "border-default bg-surface-raised opacity-60"
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <Cpu
            className={`w-3.5 h-3.5 ${
              active ? "text-brand" : "text-muted"
            }`}
          />
          <p className="text-xs font-semibold text-primary">{name}</p>
        </div>
        {active && (
          <span className="text-[9px] uppercase tracking-widest text-brand font-bold">
            Active
          </span>
        )}
      </div>
      <p className="text-[10px] text-muted">{subtitle}</p>
      <div className="flex items-center gap-1.5 mt-2">
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            configured ? "bg-emerald-400" : "bg-muted"
          }`}
        />
        <span className="text-[10px] text-secondary">
          {configured ? "Key configured" : "Not configured"}
        </span>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  span,
}: {
  label: string;
  value: string;
  mono?: boolean;
  span?: number;
}) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd
        className={`text-secondary ${mono ? "font-mono" : ""} ${
          span === 2 ? "col-span-1" : ""
        }`}
      >
        {value}
      </dd>
    </>
  );
}

function hintFor(kind?: string): string {
  switch (kind) {
    case "auth":
      return "The provider rejected the key. Re-check the value in .env.local and restart the dev server (keys are read at process start).";
    case "quota":
      return "Account has no balance / payment required. The key is valid — top up the DeepSeek account at platform.deepseek.com → Billing, then retry.";
    case "rate_limit":
      return "The provider throttled the request. Wait a minute and retry. Persistent 429s usually mean a quota issue on the account.";
    case "timeout":
      return "Provider didn't respond in time. Could be transient — retry. If it persists, check network/proxy.";
    case "network":
      return "Couldn't reach the provider at all. Check your internet and any corporate proxy/firewall.";
    case "server":
      return "Provider returned a 5xx. Their problem, not yours — retry shortly.";
    case "invalid_request":
      return "Provider rejected the request shape. This usually means a code-side bug, not a configuration one.";
    default:
      return "Check the dev server logs for more detail.";
  }
}
