"use client";

import { useEffect, useState } from "react";
import { Tag } from "lucide-react";

/**
 * A call's category on its page (2026-11-26, F10.10; migration 0367). The call's own rep picks one from the company's
 * list once the call is over (founder picker: "Rep picks at close"); everyone else who can open the call sees it.
 * Renders nothing when the company has no categories and none was picked.
 */
type Category = { id: string; name: string };

export function CallCategoryPicker({ sessionId }: { sessionId: string }) {
  const [list, setList] = useState<Category[] | null>(null);
  const [current, setCurrent] = useState<{ id: string; name: string | null } | null>(null);
  const [canPick, setCanPick] = useState(false);
  const [failed, setFailed] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([
      fetch("/api/coach/remote/call-categories").then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
      fetch(`/api/coach/remote/${sessionId}/category`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
    ])
      .then(([c, p]: [{ available?: boolean; categories?: Category[] }, { available?: boolean; category?: { id: string; name: string | null } | null; canPick?: boolean }]) => {
        if (!live) return;
        setList(c.available ? (c.categories ?? []) : []);
        setCurrent(p.category ?? null);
        setCanPick(p.canPick === true);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [sessionId]);

  if (failed) return <p className="text-xs text-muted">Couldn&apos;t load this call&apos;s category.</p>;
  if (!list) return null;
  if (list.length === 0 && !current) return null;
  const pick = async (categoryId: string | null) => {
    setMsg(null);
    const r = await fetch(`/api/coach/remote/${sessionId}/category`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categoryId }) }).catch(() => null);
    const j = r ? ((await r.json().catch(() => ({}))) as { error?: string }) : {};
    if (!r?.ok) return setMsg(j.error ?? "Couldn't save the category.");
    setCurrent(categoryId ? { id: categoryId, name: list.find((c) => c.id === categoryId)?.name ?? null } : null);
    setMsg("Saved.");
  };
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs" aria-label="Call category">
      <Tag className="h-3.5 w-3.5 text-brand" aria-hidden />
      <span className="text-muted">Category</span>
      {canPick ? (
        <select value={current?.id ?? ""} onChange={(e) => void pick(e.currentTarget.value || null)} aria-label="Call category" className="rounded-lg border border-default bg-base px-2 py-1 text-xs text-primary">
          <option value="">{current ? "No category" : "Pick one…"}</option>
          {list.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
          {current && !list.some((c) => c.id === current.id) && <option value={current.id}>{current.name ?? "A retired category"} (retired)</option>}
        </select>
      ) : (
        <span className="font-semibold text-primary">{current?.name ?? "Not picked yet"}</span>
      )}
      {msg && <span role="status" className="text-muted">{msg}</span>}
    </div>
  );
}
