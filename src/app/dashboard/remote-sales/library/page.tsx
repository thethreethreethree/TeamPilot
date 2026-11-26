"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Archive, Loader2, Play, Pause, Trash2 } from "lucide-react";
import TopBar from "@/components/layout/TopBar";

/**
 * Sales Coach → Library (RSS Phase 5; docs/rss/docs/06-UI-SPEC.md "Library": Mine and Company).
 *
 * Mine: calls and clips you saved. Company: what managers put in front of the team. A company item shows
 * "Approved by {rep}" — and a peer only ever receives approved ones (the route decides, from the rep's consent log);
 * a manager also sees "Waiting on {rep}'s approval" and can ask. A clip plays only its stretch. Removing is recorded,
 * never erased (0280). Empty, waiting-on-migration and failed are three different sentences.
 */
type Item = {
  id: string;
  folderName: string;
  folderId?: string;
  sessionId: string;
  callLabel: string | null;
  channel: string | null;
  repName: string | null;
  addedByName: string | null;
  note: string | null;
  clip: { startMs: number; endMs: number; title: string } | null;
  approved: boolean | null;
  pitchId: string | null;
  canOpenCall: boolean;
  canRemove: boolean;
  audioUrl: string | null;
};
// name is the folder's full path ("Objections / Pricing", 0353); insideArchived = a folder above it is archived.
type Folder = { id: string; name: string; parentId?: string | null; archived?: boolean; insideArchived?: boolean; canArchive?: boolean };
type Wire = { available: false; reason: string } | { available: true; isManager: boolean; items: Item[]; folders?: Folder[] };

const mmss = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

function ItemPlayer({ item }: { item: Item }) {
  const el = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  if (!item.audioUrl) return <span className="text-[11px] text-muted">No recording saved</span>;
  const startS = (item.clip?.startMs ?? 0) / 1000;
  const endS = item.clip ? item.clip.endMs / 1000 : null;
  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption -- the call's transcript is on its session page. */}
      <audio
        ref={el}
        src={item.audioUrl}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => {
          if (endS !== null && e.currentTarget.currentTime >= endS) e.currentTarget.pause();
        }}
      />
      <button
        type="button"
        aria-label={playing ? "Pause" : item.clip ? `Play clip ${item.clip.title}` : "Play call"}
        onClick={() => {
          const a = el.current;
          if (!a) return;
          if (!a.paused) return a.pause();
          if (a.currentTime < startS || (endS !== null && a.currentTime >= endS)) a.currentTime = startS;
          void a.play().catch(() => {});
        }}
        className="rounded-lg bg-ember-400 p-2 text-ink-950"
      >
        {playing ? <Pause className="h-4 w-4" aria-hidden /> : <Play className="h-4 w-4" aria-hidden />}
      </button>
    </>
  );
}

export default function LibraryPage() {
  const [scope, setScope] = useState<"mine" | "company">("mine");
  const [wire, setWire] = useState<Wire | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async (s: "mine" | "company") => {
    setWire(null);
    setFailed(false);
    try {
      const r = await fetch(`/api/coach/remote/library?scope=${s}`);
      if (!r.ok) throw new Error(String(r.status));
      setWire((await r.json()) as Wire);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void load(scope);
  }, [scope, load]);

  const remove = async (id: string) => {
    const r = await fetch("/api/coach/remote/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove", itemId: id }),
    }).catch(() => null);
    if (r?.ok) void load(scope);
    else setNote("Couldn't remove it.");
  };
  // 0346 (F12.6): archive a folder (its calls stay in Search) or bring it back.
  const setArchived = async (folderId: string, archive: boolean) => {
    const r = await fetch("/api/coach/remote/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: archive ? "archive" : "restore", folderId }),
    }).catch(() => null);
    const j = r ? ((await r.json().catch(() => ({}))) as { error?: string }) : {};
    if (r?.ok) {
      setNote(archive ? "Folder archived. Its calls are still in Search; restore it below any time." : "Folder restored.");
      void load(scope);
    } else setNote(j.error ?? "Couldn't change the folder.");
  };
  const ask = async (pitchId: string) => {
    const r = await fetch("/api/coach/sales-session/pitch-recordings/share", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pitchId, kind: "requested" }),
    }).catch(() => null);
    setNote(r?.ok ? "Asked. The rep sees the request in their notifications." : "Couldn't send the request.");
  };

  // Grouped by folder id (two folders may share a name across owners); the heading is the folder's name.
  const groups = new Map<string, { name: string; items: Item[] }>();
  if (wire && wire.available) for (const i of wire.items) {
    const key = i.folderId ?? i.folderName;
    const g = groups.get(key) ?? { name: i.folderName, items: [] };
    g.items.push(i);
    groups.set(key, g);
  }
  const folderInfo = new Map((wire && wire.available ? wire.folders ?? [] : []).map((f) => [f.id, f]));
  const archivedFolders = wire && wire.available ? (wire.folders ?? []).filter((f) => f.archived) : [];
  // Folders with nothing you can see in them still need an Archive button (review 2026-11-26).
  const emptyFolders = wire && wire.available ? (wire.folders ?? []).filter((f) => !f.archived && !f.insideArchived && f.canArchive && !groups.has(f.id)) : [];
  // 0353: by path, so a folder's subfolders follow it ("Objections", then "Objections / Pricing").
  const sortedGroups = [...groups].sort(([, a], [, b]) => a.name.localeCompare(b.name));

  return (
    <>
      <TopBar title="Library" subtitle="Calls and clips worth hearing again" />
      <div className="flex-1 overflow-y-auto bg-base px-4 md:px-8 py-4 space-y-4">
        <div className="flex items-center gap-2" role="tablist" aria-label="Library">
          {(["mine", "company"] as const).map((s) => (
            <button key={s} role="tab" aria-selected={scope === s} type="button" onClick={() => setScope(s)}
              className={`rounded-full border px-3 py-1.5 text-xs ${scope === s ? "border-strong font-semibold text-primary" : "border-default text-muted"}`}>
              {s === "mine" ? "Mine" : "Company"}
            </button>
          ))}
          <Link href="/dashboard/remote-sales/search" className="ml-auto text-xs text-brand hover:underline">Search calls</Link>
        </div>
        {note && <p className="text-xs text-secondary" role="status">{note}</p>}

        {!wire && !failed && (
          <p className="flex items-center gap-2 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…</p>
        )}
        {failed && <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">The library couldn&apos;t be loaded. Reload to try again.</p>}
        {wire && !wire.available && <p className="text-xs text-muted">{wire.reason}</p>}
        {wire && wire.available && wire.items.length === 0 && (
          <p className="text-xs text-muted">
            {scope === "mine"
              ? "Nothing saved yet. On a phone or video call's page, use “Save call” or cut a clip."
              : "Nothing in the company library you can hear yet. Managers add calls; reps approve them before the team hears them."}
          </p>
        )}

        {sortedGroups.map(([folderKey, { name: folder, items }]) => (
          <section key={folderKey} className="space-y-2" aria-label={folder}>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-primary">{folder}</h2>
              {folderInfo.get(folderKey)?.canArchive && (
                <button type="button" onClick={() => void setArchived(folderKey, true)} aria-label={`Archive folder ${folder}`} className="ml-auto inline-flex items-center gap-1 text-xs text-muted hover:text-primary">
                  <Archive className="h-3.5 w-3.5" aria-hidden /> Archive folder
                </button>
              )}
            </div>
            <ul className="space-y-2">
              {items.map((i) => (
                <li key={i.id} className="flex items-start gap-3 rounded-2xl border border-default bg-surface p-3">
                  <ItemPlayer item={i} />
                  <div className="min-w-0 flex-1 text-xs">
                    <p className="font-semibold text-primary">
                      {i.clip ? i.clip.title : i.callLabel || "Untitled call"}
                      {i.clip && <span className="ml-1 font-normal text-muted">({mmss(i.clip.startMs)}–{mmss(i.clip.endMs)})</span>}
                    </p>
                    <p className="text-muted">
                      {i.repName ?? "A rep"}
                      {i.channel ? ` · ${i.channel === "in_person" ? "In person" : i.channel === "phone" ? "Phone" : "Video"}` : ""}
                      {i.addedByName ? ` · added by ${i.addedByName}` : ""}
                    </p>
                    {i.note && <p className="mt-1 text-secondary">{i.note}</p>}
                    {i.approved === true && <p className="mt-1 text-secondary">Approved by {i.repName ?? "the rep"}</p>}
                    {i.approved === false && (
                      <p className="mt-1 text-secondary">
                        Waiting on {i.repName ?? "the rep"}&apos;s approval — the team can&apos;t hear it yet.
                        {i.pitchId && (
                          <button type="button" onClick={() => ask(i.pitchId!)} className="ml-2 text-brand hover:underline">Ask again</button>
                        )}
                      </p>
                    )}
                    {i.canOpenCall && (
                      <Link
                        href={`/dashboard/remote-sales/calls/${i.sessionId}${i.clip ? `?t=${Math.floor(i.clip.startMs / 1000)}` : ""}`}
                        className="mt-1 inline-block text-brand hover:underline"
                      >
                        Open the call
                      </Link>
                    )}
                  </div>
                  {i.canRemove && (
                    <button type="button" onClick={() => remove(i.id)} aria-label="Take out of the library" className="p-1 text-muted hover:text-primary">
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}

        {emptyFolders.length > 0 && (
          <details className="rounded-2xl border border-default bg-surface p-3 text-xs">
            <summary className="cursor-pointer text-secondary hover:text-primary">Empty folders ({emptyFolders.length})</summary>
            <ul className="mt-2 space-y-1">
              {emptyFolders.map((f) => (
                <li key={f.id} className="flex items-center gap-2">
                  <span className="text-primary">{f.name}</span>
                  <button type="button" onClick={() => void setArchived(f.id, true)} aria-label={`Archive folder ${f.name}`} className="ml-auto text-secondary hover:text-primary">
                    Archive
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}

        {archivedFolders.length > 0 && (
          <details className="rounded-2xl border border-default bg-surface p-3 text-xs">
            <summary className="cursor-pointer text-secondary hover:text-primary">Archived folders ({archivedFolders.length})</summary>
            <ul className="mt-2 space-y-1">
              {archivedFolders.map((f) => (
                <li key={f.id} className="flex items-center gap-2">
                  <span className="text-primary">{f.name}</span>
                  {f.canArchive && (
                    <button type="button" onClick={() => void setArchived(f.id, false)} aria-label={`Restore folder ${f.name}`} className="ml-auto text-brand hover:underline">
                      Restore
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-muted">An archived folder&apos;s calls are still in Search. Archiving a folder also hides the folders inside it; restoring it brings them back.</p>
          </details>
        )}
      </div>
    </>
  );
}
