"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";

/**
 * Which prospect a phone/video call belongs to, on EVERY remote call page (2026-11-23). The call's rep adds it to one of
 * their open prospects or to a new one named from the call; anyone else sees where it is. Linking is what fills a
 * prospect's last call, its call summaries in Ask Coach, its sentiment and its calendar entries — and production had
 * no linked calls, because this control existed only in Macro Mode and could only create a new prospect.
 */
type Res = { remote: boolean; live?: boolean; isOwner?: boolean; label?: string | null; prospect?: { id: string; name: string | null; status: string } | null; options?: Array<{ id: string; name: string; organization: string | null }> };

export function CallPipelineLink({ sessionId, onLinked }: { sessionId: string; onLinked?: () => void }) {
  const [res, setRes] = useState<Res | null>(null);
  const [failed, setFailed] = useState(false);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const r = await fetch(`/api/coach/remote/${sessionId}/pipeline-link`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as Res;
      setRes(j);
      setChoice(j.options?.[0] ? "" : "new");
    } catch {
      setFailed(true);
    }
  }, [sessionId]);
  useEffect(() => {
    void load();
  }, [load]);

  if (failed) return <p className="rounded-lg border border-default px-3 py-2 text-xs text-muted">Couldn&apos;t check which prospect this call belongs to.</p>;
  if (!res || !res.remote || res.live) return null;
  if (res.prospect) {
    return (
      <Link href={`/dashboard/remote-sales/pipeline?p=${res.prospect.id}`} className="flex items-center justify-between rounded-lg border border-default bg-base/40 px-3 py-2 text-xs hover:border-brand">
        <span className="text-primary">
          In the pipeline: <b>{res.prospect.name ?? "Unnamed prospect"}</b>
        </span>
        <span className="text-muted">{res.prospect.status === "won" ? "Closed won" : res.prospect.status === "lost" ? "Closed lost" : "Open"}</span>
      </Link>
    );
  }
  if (!res.isOwner) return <p className="rounded-lg border border-dashed border-default px-3 py-2 text-xs text-secondary">This call isn&apos;t in its rep&apos;s pipeline yet — the rep adds it from their side.</p>;

  const add = async () => {
    setBusy(true);
    setErr(null);
    try {
      const existing = choice && choice !== "new";
      const r = existing
        ? await fetch(`/api/coach/remote/prospects/${choice}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "link", sessionId }) })
        : await fetch("/api/coach/remote/prospects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: (res.label ?? "New prospect").slice(0, 120), sessionId }) });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? "Couldn't add the call to your pipeline.");
      await load();
      // Views that read the prospect elsewhere (Macro Mode's next-call date) refresh too.
      onLinked?.();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't add the call to your pipeline.");
    } finally {
      setBusy(false);
    }
  };
  const options = res.options ?? [];
  return (
    <div className="space-y-2 rounded-lg border border-dashed border-default px-3 py-2 text-xs">
      <p className="text-secondary">Which prospect was this call with? Adding it fills the prospect&apos;s last call, summary and sentiment.</p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={choice} onChange={(e) => setChoice(e.currentTarget.value)} aria-label="Prospect for this call" className="min-w-0 flex-1 rounded-lg border border-default bg-surface px-2 py-1 text-xs text-primary">
          {options.length > 0 && <option value="">Choose a prospect…</option>}
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
              {o.organization ? ` (${o.organization})` : ""}
            </option>
          ))}
          <option value="new">New prospect: {res.label ?? "New prospect"}</option>
        </select>
        <button type="button" onClick={() => void add()} disabled={busy || !choice} className="inline-flex items-center gap-1 rounded-lg border border-default px-2 py-1 text-primary hover:border-brand disabled:opacity-50">
          <Plus className="h-3.5 w-3.5" aria-hidden /> {busy ? "Adding…" : "Add to pipeline"}
        </button>
      </div>
      {err && <p className="text-amber-700 dark:text-amber-300">{err}</p>}
    </div>
  );
}
