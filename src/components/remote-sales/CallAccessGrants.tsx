"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound } from "lucide-react";
import { isCompanyAdminRole, useCurrentUserRole } from "@/lib/hooks/useCurrentUserRole";

/**
 * Company admins only (0336, F3.8; founder "Admin grants, logged"): give one teammate access to this call with a reason,
 * see who has it, take it back. The rep and the teammate are told; every grant, revoke and open is logged.
 */
type G = { id: string; granteeName: string; grantedByName: string; reason: string; createdAt: string; active: boolean };

export function CallAccessGrants({ sessionId }: { sessionId: string }) {
  const isAdmin = isCompanyAdminRole(useCurrentUserRole());
  const [grants, setGrants] = useState<G[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [team, setTeam] = useState<Array<{ id: string; full_name: string | null }>>([]);
  const [who, setWho] = useState("");
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const url = `/api/coach/remote/${encodeURIComponent(sessionId)}/grants`;

  const load = useCallback(async () => {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) throw new Error();
      setGrants(((await r.json()) as { grants: G[] }).grants);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [url]);
  useEffect(() => {
    if (!isAdmin) return;
    void load();
    fetch("/api/team")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((j: { members?: Array<{ id: string; full_name: string | null }> }) => setTeam(j.members ?? []))
      .catch(() => setMsg("Couldn't load your team — refresh to pick someone."));
  }, [isAdmin, load]);

  if (!isAdmin) return null;
  const send = async (method: "POST" | "DELETE", body: unknown, done: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) return setMsg(j.error ?? "That didn't work.");
      setMsg(done);
      setWho("");
      setReason("");
      await load();
    } finally {
      setBusy(false);
    }
  };
  const active = (grants ?? []).filter((g) => g.active);
  return (
    <section className="rounded-xl border border-default bg-surface p-4" aria-label="Who else can open this call">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-primary">
        <KeyRound className="h-4 w-4 text-brand" aria-hidden /> Who else can open this call
      </h2>
      <p className="mt-1 text-xs text-muted">
        Besides the rep and their managers. Give one teammate read-only access, with a reason. The rep and the teammate are
        told, and every open is logged.
      </p>
      {failed ? (
        <p className="mt-2 text-xs text-muted">Couldn&apos;t load who has access. Refresh to try again.</p>
      ) : active.length > 0 ? (
        <ul className="mt-2 space-y-1 text-xs">
          {active.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-2">
              <span className="text-primary">{g.granteeName}</span>
              <span className="text-muted">· {g.reason} · by {g.grantedByName}</span>
              <button type="button" disabled={busy} onClick={() => void send("DELETE", { grantId: g.id }, `${g.granteeName} can no longer open this call.`)} className="ml-auto text-secondary hover:text-primary">
                Take back
              </button>
            </li>
          ))}
        </ul>
      ) : grants ? (
        <p className="mt-2 text-xs text-secondary">No one else has been given access.</p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select value={who} onChange={(e) => setWho(e.currentTarget.value)} aria-label="Teammate" className="rounded-lg border border-default bg-base px-2 py-1 text-xs text-primary">
          <option value="">Choose a teammate…</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>{m.full_name ?? "Unnamed teammate"}</option>
          ))}
        </select>
        <input value={reason} onChange={(e) => setReason(e.currentTarget.value)} maxLength={300} placeholder="Reason (e.g. training example)" aria-label="Reason" className="min-w-0 flex-1 rounded-lg border border-default bg-base px-2 py-1 text-xs text-primary" />
        <button type="button" disabled={busy || !who || !reason.trim()} onClick={() => void send("POST", { granteeId: who, reason: reason.trim() }, "Access given. They and the rep have been told.")} className="rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-black disabled:opacity-50">
          Give access
        </button>
      </div>
      {msg && <p role="status" className="mt-2 text-xs text-secondary">{msg}</p>}
    </section>
  );
}
