"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound } from "lucide-react";

/**
 * Protection → API keys (Engage plan E3, 0378; Gong M31). Company admins make read-only keys for outside tools (and, with
 * "MCP", for AI assistants). A key is shown once; only its hash is kept. Each row says its use in the last 24 hours.
 */
type UsageLine = { keyId: string; route: string; requests: number; errors: number; limited: number };
type Key = { id: string; name: string; prefix: string; scopes: string[]; createdAt: string; revokedAt: string | null; requests24h: number; lastUsedAt: string | null; allowedIps?: string[] | null };

export function ApiKeysPanel() {
  const [keys, setKeys] = useState<Key[] | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "hidden" | "failed">("loading");
  const [name, setName] = useState("");
  const [mcp, setMcp] = useState(false);
  // Engage plan E6 (0387): a key that can also upload calls for the company's reps.
  const [upload, setUpload] = useState(false);
  // Engage plan E15 (0393): trusted addresses, set when the key is made; empty = anywhere.
  const [ips, setIps] = useState("");
  const [shown, setShown] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  // Revoking can't be undone and stops an outside tool at once, so it asks first.
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);
  // Engage plan E7 (Gong F31.9): the last 7 days by key and route. Loaded with the keys; a failure says so on its own line.
  const [usage, setUsage] = useState<{ lines: UsageLine[]; partial: boolean } | "failed" | null>(null);
  const load = useCallback(async () => {
    void fetch("/api/coach/remote/settings/api-keys/usage", { cache: "no-store" })
      .then(async (r) => {
        if (r.status === 403) return;
        const j = r.ok ? ((await r.json()) as { lines?: unknown; partial?: unknown }) : null;
        setUsage(j && Array.isArray(j.lines) ? { lines: j.lines as UsageLine[], partial: j.partial === true } : "failed");
      })
      .catch(() => setUsage("failed"));
    try {
      const r = await fetch("/api/coach/remote/settings/api-keys", { cache: "no-store" });
      if (r.status === 403) return setState("hidden");
      if (!r.ok) return setState("failed");
      setKeys(((await r.json()) as { keys: Key[] }).keys);
      setState("ok");
    } catch {
      setState("failed");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const post = async (body: Record<string, unknown>) => {
    setMsg(null);
    const r = await fetch("/api/coach/remote/settings/api-keys", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as { error?: string; key?: string };
    if (!r.ok) return setMsg(j.error ?? "Couldn't save that.");
    if (j.key) setShown(j.key);
    setName("");
    setMcp(false);
    setUpload(false);
    setIps("");
    setConfirmRevoke(null);
    void load();
  };
  if (state === "hidden") return null;
  return (
    <section aria-label="API keys" className="rounded-xl border border-default bg-surface p-4 text-xs">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold text-primary"><KeyRound className="h-4 w-4 text-brand" aria-hidden /> API keys</h3>
      <p className="mt-1 text-secondary">
        Read-only keys for outside tools: deals, accounts, contacts and calls at <code>/api/v1/…</code>, sent as
        <code> Authorization: Bearer els_…</code>. A key reads your whole company (no call with an active hide, no transcripts),
        3 requests a second and 10,000 a day. The audit log is at <code>/api/v1/audit</code> while the key&apos;s maker is
        still a company admin. A key that &ldquo;also uploads calls&rdquo; can send a recording to <code>POST /api/v1/calls</code> for
        one of your reps; the rep confirms consent and picks their voice before it is scored. Revoke any key you no longer use.
      </p>
      <p className="mt-1 text-secondary">
        AI assistants (Claude, ChatGPT, Copilot): add EloState as an MCP server at <code>{typeof window === "undefined" ? "" : window.location.origin}/api/mcp</code> with
        a key that has “Also for AI assistants”. They can list deals, read a deal or account, find calls, ask about a deal
        or account from its calls, and write a deal&rsquo;s brief (saved on the deal, as yours). Nothing else is changed.
      </p>
      {shown && (
        <div className="mt-2 rounded-lg border border-brand/60 bg-brand/10 p-2" role="status">
          <p className="font-semibold text-primary">Copy this key now — it won&apos;t be shown again.</p>
          <p className="mt-1 flex flex-wrap items-center gap-2">
            <code className="break-all text-primary">{shown}</code>
            <button type="button" onClick={() => void navigator.clipboard.writeText(shown).catch(() => setMsg("Couldn't copy — select the key instead."))} className="inline-flex items-center gap-1 rounded border border-default px-1.5 py-0.5"><Copy className="h-3 w-3" aria-hidden /> Copy</button>
            <button type="button" onClick={() => setShown(null)} className="text-muted hover:text-primary">I&apos;ve saved it</button>
          </p>
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <input value={name} onChange={(e) => setName(e.currentTarget.value)} maxLength={60} placeholder="What it's for, e.g. Data warehouse" aria-label="Key name" className="min-w-0 flex-1 rounded-lg border border-default bg-base px-2 py-1 text-xs text-primary" />
        <label className="flex items-center gap-1 text-secondary"><input type="checkbox" checked={mcp} onChange={(e) => setMcp(e.currentTarget.checked)} /> Also for AI assistants (MCP)</label>
        <label className="flex items-center gap-1 text-secondary"><input type="checkbox" checked={upload} onChange={(e) => setUpload(e.currentTarget.checked)} /> Also uploads calls</label>
        <button type="button" disabled={!name.trim()} onClick={() => void post({ name: name.trim(), scopes: ["read", ...(mcp ? ["mcp"] : []), ...(upload ? ["upload"] : [])], ...(ips.trim() ? { allowedIps: ips.split(/[\s,]+/).filter(Boolean) } : {}) })} className="rounded-lg bg-brand px-3 py-1 font-semibold text-black disabled:opacity-50">Make a key</button>
      </div>
      <input value={ips} onChange={(e) => setIps(e.currentTarget.value)} maxLength={600} placeholder="Only from these addresses (optional): 203.0.113.7, 198.51.100.0/24" aria-label="Trusted addresses" className="mt-1 w-full rounded-lg border border-default bg-base px-2 py-1 text-xs text-primary" />
      {msg && <p className="mt-1 text-amber-700 dark:text-amber-300">{msg}</p>}
      {state === "failed" ? <p className="mt-2 text-secondary">Couldn&apos;t load API keys. Refresh to try again.</p> : keys && keys.length > 0 && (
        <ul className="mt-2 space-y-1">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-default p-2">
              <span className="font-medium text-primary">{k.name}</span>
              <code className="text-muted">{k.prefix}…</code>
              <span className="text-muted">{k.scopes.join(" + ")}</span>
              {k.allowedIps && k.allowedIps.length > 0 && <span className="text-muted" title={k.allowedIps.join(", ")}>only from {k.allowedIps.length === 1 ? k.allowedIps[0] : `${k.allowedIps.length} addresses`}</span>}
              <span className="text-secondary">{k.revokedAt ? `revoked ${new Date(k.revokedAt).toLocaleDateString()}` : `${k.requests24h} request${k.requests24h === 1 ? "" : "s"} in 24 h${k.lastUsedAt ? ` · last ${new Date(k.lastUsedAt).toLocaleString()}` : " · never used"}`}</span>
              {!k.revokedAt && (confirmRevoke === k.id ? (
                <span className="ml-auto flex items-center gap-2">
                  <span className="text-secondary">Revoke it? Anything using it stops working now.</span>
                  <button type="button" onClick={() => void post({ revoke: k.id })} className="font-semibold text-primary hover:underline">Revoke</button>
                  <button type="button" onClick={() => setConfirmRevoke(null)} className="text-muted hover:text-primary">Keep it</button>
                </span>
              ) : (
                <button type="button" onClick={() => setConfirmRevoke(k.id)} className="ml-auto text-muted hover:text-primary">Revoke…</button>
              ))}
            </li>
          ))}
        </ul>
      )}
      {usage === "failed" ? <p className="mt-2 text-secondary">Couldn&apos;t load API usage. Refresh to try again.</p> : usage && keys && keys.length > 0 && (
        <div className="mt-3">
          <h4 className="font-semibold text-primary">Usage, last 7 days</h4>
          {usage.lines.length === 0 ? <p className="mt-1 text-secondary">No requests in the last 7 days.</p> : (
            <table className="mt-1 w-full text-left">
              <thead className="text-muted"><tr><th className="py-0.5 font-medium">Key</th><th className="font-medium">Route</th><th className="text-right font-medium">Requests</th><th className="text-right font-medium">Errors</th><th className="text-right font-medium" title="Refused for more than 3 a second">Too fast</th></tr></thead>
              <tbody>
                {usage.lines.map((l) => (
                  <tr key={`${l.keyId} ${l.route}`} className="border-t border-default">
                    <td className="py-0.5 text-primary">{keys.find((k) => k.id === l.keyId)?.name ?? "A key"}</td>
                    <td><code className="text-secondary">{l.route}</code></td>
                    <td className="text-right text-primary">{l.requests.toLocaleString()}</td>
                    <td className="text-right text-secondary">{l.errors.toLocaleString()}</td>
                    <td className="text-right text-secondary">{l.limited.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {usage.partial && <p className="mt-1 text-muted">Counts cover the newest 50,000 requests only; the week had more.</p>}
        </div>
      )}
    </section>
  );
}
