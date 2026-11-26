"use client";

import { useCallback, useEffect, useState } from "react";
import { Tag } from "lucide-react";

/**
 * The company's call categories, for company admins (2026-11-26, F10.10; migration 0367). Add one, or retire one (calls
 * already in it keep it; reps can't pick it any more). Reps pick a call's category on the call's page.
 * Renders nothing for someone who isn't a company admin.
 */
type Category = { id: string; name: string };

export function CallCategoriesPanel() {
  const [list, setList] = useState<Category[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [failed, setFailed] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/coach/remote/call-categories");
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { available?: boolean; canManage?: boolean; categories?: Category[] };
      setList(j.available ? (j.categories ?? []) : []);
      setCanManage(j.canManage === true);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  if (failed && !list) return <p className="rounded-2xl border border-default bg-surface p-4 text-xs text-muted">Couldn&apos;t load call categories.</p>;
  if (!list || !canManage) return null;
  const send = async (method: string, body: unknown, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/coach/remote/call-categories", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setMsg(j.error ?? "That didn't save.");
        return false;
      }
      setMsg(ok);
      await load();
      return true;
    } catch {
      setMsg("Couldn't reach the server.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-2xl border border-default bg-surface p-4 space-y-2" aria-label="Call categories">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold text-primary"><Tag className="h-4 w-4 text-brand" aria-hidden /> Call categories</h2>
      <p className="text-[11px] text-muted">The list reps pick from on each phone or video call&apos;s page once it&apos;s over — e.g. Discovery, Demo, Renewal.</p>
      {msg && <p role="status" className="text-xs text-secondary">{msg}</p>}
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await send("POST", { name }, "Added.")) setName("");
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="New category" aria-label="New category" className="w-full rounded-lg border border-default bg-base px-2 py-1.5 text-xs text-primary" />
        <button type="submit" disabled={busy || !name.trim()} className="rounded-lg bg-ember-400 px-3 py-1 text-xs font-semibold text-ink-950 disabled:opacity-60">Add</button>
      </form>
      {list.length === 0 ? (
        <p className="text-xs text-muted">No categories yet.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {list.map((c) => (
            <li key={c.id} className="flex items-center gap-1 rounded-full border border-default px-2 py-0.5 text-xs text-primary">
              {c.name}
              <button type="button" disabled={busy} aria-label={`Retire ${c.name}`} onClick={() => { if (window.confirm(`Retire “${c.name}”? Calls already in it keep it; reps can't pick it any more.`)) void send("PATCH", { id: c.id, retire: true }, "Retired."); }} className="text-muted hover:text-primary">×</button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
