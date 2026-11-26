"use client";

import { useCallback, useEffect, useState } from "react";
import { UserPlus, X } from "lucide-react";
import { AddContact } from "./DealAccountContacts";

/**
 * Who was on this call (revenue Phase 1, 0370; Gong F29.1 by hand — there is no CRM to match attendees against, plan
 * R2). On every remote call page, beside "which prospect". Pick a contact (the deal's account's first) or make one on
 * that account. A contact on a call is seen by whoever can see the call, and its name joins the account's people.
 */
type C = { id: string; name: string; title: string | null };

export function CallContacts({ sessionId }: { sessionId: string }) {
  const [data, setData] = useState<{ contacts: C[]; accountId: string | null } | null>(null);
  const [failed, setFailed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const r = await fetch(`/api/coach/remote/${sessionId}/contacts`, { cache: "no-store" });
      if (r.status === 404) return setData(null);
      if (!r.ok) throw new Error(String(r.status));
      setData((await r.json()) as { contacts: C[]; accountId: string | null });
    } catch {
      setFailed(true);
    }
  }, [sessionId]);
  useEffect(() => {
    void load();
  }, [load]);

  const link = async (contactId: string, linked: boolean) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/coach/remote/${sessionId}/contacts`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contactId, linked }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Couldn't save who was on this call.");
      setAdding(false);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save who was on this call.");
    } finally {
      setBusy(false);
    }
  };

  if (failed) return <p className="rounded-lg border border-default px-3 py-2 text-xs text-muted">Couldn&apos;t load who was on this call.</p>;
  if (!data) return null;
  return (
    <section aria-label="Who was on this call" className="rounded-lg border border-default px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-secondary">With:</span>
        {data.contacts.length === 0 && <span className="text-muted">no contact yet</span>}
        {data.contacts.map((c) => (
          <span key={c.id} className="inline-flex items-center gap-1 rounded-full border border-default px-2 py-0.5 text-primary">
            {c.name}{c.title ? <span className="text-muted"> · {c.title}</span> : null}
            <button type="button" disabled={busy} onClick={() => void link(c.id, false)} aria-label={`${c.name} wasn't on this call`} className="text-muted hover:text-primary">
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
        {!adding && (
          <button type="button" disabled={busy} onClick={() => setAdding(true)} className="inline-flex items-center gap-1 text-secondary underline-offset-2 hover:text-primary hover:underline">
            <UserPlus className="h-3.5 w-3.5" aria-hidden /> Who was this?
          </button>
        )}
      </div>
      {adding && (
        <AddContact
          accountId={data.accountId}
          withRole={false}
          pickLabel="was on this call"
          onPicked={(id) => link(id, true)}
          onError={setErr}
          onCancel={() => setAdding(false)}
          exclude={new Set(data.contacts.map((c) => c.id))}
        />
      )}
      {err && <p className="mt-1 text-amber-700 dark:text-amber-300">{err}</p>}
    </section>
  );
}
