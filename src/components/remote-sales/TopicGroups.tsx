"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

/**
 * Topic groups on Market (2026-11-23, 0319; founder picker "AI suggests, manager OKs"). Managers see the groups in use
 * and can ask the AI for suggestions: each suggestion can be renamed, have topics unticked, then accepted or skipped.
 * Nothing changes the counts until a manager accepts. Reps see nothing here (the grouped names already show in Topics).
 */
type Group = { id: string; name: string; members: string[]; source: string };
type Suggestion = { name: string; members: string[]; counts: number[] };
type Draft = Suggestion & { keep: boolean[]; saving?: boolean; error?: string };

export function TopicGroups({ module, onChanged }: { module: "remote_sales" | "sales_coach"; onChanged: () => void }) {
  const [canManage, setCanManage] = useState(false);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/coach/remote/market/topic-groups", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { canManage: boolean; groups: Group[] };
      setCanManage(j.canManage);
      setGroups(j.groups);
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (!canManage) return null;

  const suggest = async () => {
    setAsking(true);
    setNote(null);
    try {
      const r = await fetch("/api/coach/remote/market/topic-groups/suggest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ module }) });
      const j = (await r.json()) as { suggestions?: Suggestion[]; offered?: number; suppressed?: boolean; error?: string };
      if (!r.ok) return setNote(j.error ?? "Couldn't get suggestions. Try again.");
      if (j.suppressed) return setNote("AI suggestions are off for this account right now.");
      const list = j.suggestions ?? [];
      if (list.length === 0) setNote(j.offered !== undefined && j.offered < 2 ? "Not enough topics raised on two or more calls to group yet." : "No topics look like the same thing in different words.");
      setDrafts(list.map((s) => ({ ...s, keep: s.members.map(() => true) })));
    } catch {
      setNote("Couldn't get suggestions. Try again.");
    } finally {
      setAsking(false);
    }
  };

  const accept = async (i: number) => {
    const d = drafts![i]!;
    const members = d.members.filter((_, k) => d.keep[k]);
    setDrafts((all) => all!.map((x, k) => (k === i ? { ...x, saving: true, error: undefined } : x)));
    try {
      const r = await fetch("/api/coach/remote/market/topic-groups", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ module, name: d.name, members, source: "ai_suggested" }) });
      const j = (await r.json()) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Couldn't save the group.");
      setDrafts((all) => all!.filter((_, k) => k !== i));
      await load();
      onChanged();
    } catch (e) {
      setDrafts((all) => all!.map((x, k) => (k === i ? { ...x, saving: false, error: e instanceof Error ? e.message : "Couldn't save the group." } : x)));
    }
  };

  const ungroup = async (id: string) => {
    const r = await fetch(`/api/coach/remote/market/topic-groups?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => null);
    if (!r || !r.ok) return setNote("Couldn't ungroup. Try again.");
    await load();
    onChanged();
  };

  return (
    <section aria-label="Topic groups" className="rounded-xl border border-default bg-surface p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-primary">Topic groups</h3>
          <p className="text-xs text-secondary">Topics that mean the same thing, counted as one. The AI suggests; nothing changes until you accept.</p>
        </div>
        <button type="button" onClick={() => void suggest()} disabled={asking} className="inline-flex items-center gap-1.5 rounded-lg border border-default px-2.5 py-1 text-xs font-medium text-primary disabled:opacity-60">
          {asking ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5 text-brand" aria-hidden />} Suggest groups
        </button>
      </div>

      {loadFailed && <p className="mt-2 text-xs text-muted">Couldn&apos;t load the topic groups. Refresh to try again.</p>}
      {note && <p className="mt-2 text-xs text-secondary">{note}</p>}

      {drafts && drafts.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="Suggested groups">
          {drafts.map((d, i) => {
            const kept = d.keep.filter(Boolean).length;
            return (
              <li key={`${d.name}-${i}`} className="rounded-lg border border-default p-2.5">
                <label className="block text-[10px] uppercase tracking-wide text-muted">
                  Group name
                  <input value={d.name} maxLength={80} onChange={(e) => setDrafts((all) => all!.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} className="mt-0.5 block w-full rounded border border-default bg-surface px-2 py-1 text-sm normal-case tracking-normal text-primary" />
                </label>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {d.members.map((m, k) => (
                    <li key={m}>
                      <label className="inline-flex items-center gap-1 rounded-full border border-default px-2 py-0.5 text-xs text-primary">
                        <input type="checkbox" checked={d.keep[k]} onChange={() => setDrafts((all) => all!.map((x, j) => (j === i ? { ...x, keep: x.keep.map((v, q) => (q === k ? !v : v)) } : x)))} />
                        {m} <span className="tabular-nums text-muted">· {d.counts[k]}</span>
                      </label>
                    </li>
                  ))}
                </ul>
                {d.error && <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{d.error}</p>}
                <div className="mt-2 flex gap-2">
                  <button type="button" disabled={d.saving || kept < 2 || !d.name.trim()} onClick={() => void accept(i)} className="rounded-lg bg-brand px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">
                    {d.saving ? "Saving…" : "Accept"}
                  </button>
                  <button type="button" onClick={() => setDrafts((all) => all!.filter((_, k) => k !== i))} className="rounded-lg border border-default px-2.5 py-1 text-xs text-secondary">
                    Skip
                  </button>
                  {kept < 2 && <span className="self-center text-[10px] text-muted">Keep at least two topics.</span>}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {groups && groups.length > 0 && (
        <ul className="mt-3 space-y-1.5" aria-label="Groups in use">
          {groups.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="min-w-0">
                <span className="font-medium text-primary">{g.name}</span> <span className="text-muted">= {g.members.join(", ")}</span>
              </span>
              <button type="button" onClick={() => void ungroup(g.id)} className="text-secondary hover:underline">
                Ungroup
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
