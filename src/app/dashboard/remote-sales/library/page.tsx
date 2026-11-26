"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Archive, Loader2, Play, Pause, Trash2 } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { CitedAnswer, type Citation } from "@/components/sales-coach/CitedAnswer";

/**
 * Ask the coach about one folder's calls (F13.10, 2026-11-26) — the same Ask Coach as Search (/api/coach/remote/ask,
 * up to 10 calls, newest first). Offered only when you can open every call in the folder: Ask Coach opens each call
 * through your own access, and a folder you see by a rep's consent may hold calls you can listen to but not open.
 */
function AskFolder({ name, items }: { name: string; items: Item[] }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<{ text: string; citations: Citation[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const sessionIds = [...new Set(items.map((i) => i.sessionId))].slice(0, 10);
  const more = new Set(items.map((i) => i.sessionId)).size > sessionIds.length;
  return (
    <form
      className="rounded-xl border border-default bg-base/40 p-2 text-xs"
      aria-label={`Ask about ${name}`}
      onSubmit={async (e) => {
        e.preventDefault();
        if (q.trim().length < 3) return;
        setBusy(true);
        setErr(null);
        setAnswer(null);
        try {
          const r = await fetch("/api/coach/remote/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q.trim(), sessionIds }) });
          const j = (await r.json().catch(() => ({}))) as { answer?: string | null; citations?: Citation[]; error?: string };
          if (!r.ok) setErr(j.error ?? "The coach couldn't answer.");
          else setAnswer({ text: j.answer ?? "The coach isn't answering on this account right now.", citations: j.citations ?? [] });
        } catch {
          setErr("Couldn't reach the server.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block text-[11px] text-muted">
        Ask the coach about {more ? "the 10 most recently saved calls in this folder" : "the calls in this folder"}
        <input value={q} onChange={(e) => setQ(e.target.value)} maxLength={2000} placeholder="e.g. What do these calls have in common?" className="mt-1 w-full rounded-lg border border-default bg-surface px-2 py-1.5 text-xs text-primary" />
      </label>
      <button type="submit" disabled={busy || q.trim().length < 3} className="mt-1 rounded-lg border border-default px-3 py-1 text-xs text-secondary hover:text-primary disabled:opacity-50">
        {busy ? "Asking…" : "Ask"}
      </button>
      {err && <p role="alert" className="mt-1 text-amber-700 dark:text-amber-300">{err}</p>}
      {answer && <CitedAnswer text={answer.text} citations={answer.citations} labelFor={(c) => items.find((i) => i.sessionId === c.sessionId)?.callLabel ?? "call"} />}
    </form>
  );
}

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
  /** F12.9: managers in the company library — distinct teammates (not the rep) who played it; null otherwise. */
  heardBy?: number | null;
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
type Wire = { available: false; reason: string } | { available: true; isManager: boolean; items: Item[]; folders?: Folder[]; truncated?: boolean };

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
  // 0359: a course lesson links here with ?scope=company&item=<id>&from=training — open on that item, say plainly when
  // it isn't one this person may hear, and offer the way back to the course.
  const [focus, setFocus] = useState<{ item: string; fromTraining: boolean } | null>(null);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("scope") === "company") setScope("company");
    const item = q.get("item");
    if (item) setFocus({ item, fromTraining: q.get("from") === "training" });
  }, []);
  const [wire, setWire] = useState<Wire | null>(null);
  const [failed, setFailed] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  // Only the newest load writes (2026-11-26): switching tabs, or opening on ?scope=company, starts a second load, and an
  // older answer arriving last must not put the other tab's calls on screen.
  const loadSeq = useRef(0);
  const load = useCallback(async (s: "mine" | "company") => {
    const seq = ++loadSeq.current;
    setWire(null);
    setFailed(false);
    try {
      const r = await fetch(`/api/coach/remote/library?scope=${s}`);
      if (!r.ok) throw new Error(String(r.status));
      const w = (await r.json()) as Wire;
      if (seq === loadSeq.current) setWire(w);
    } catch {
      if (seq === loadSeq.current) setFailed(true);
    }
  }, []);
  // The linked item (0359): scrolled to once the list is in; null = not here for this person.
  // Judged on the company tab only (review 2026-11-26): the linked call is a company-library call, so "not here" on the
  // Mine tab would be wrong.
  const focusFound = focus && scope === "company" && wire && wire.available ? wire.items.some((i) => i.id === focus.item) : null;
  useEffect(() => {
    if (focus && focusFound) document.getElementById(`library-item-${focus.item}`)?.scrollIntoView?.({ block: "center" });
  }, [focus, focusFound]);
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
  // 0360 (F12.6): move a folder — the server (and the database) refuse a loop or a fourth level, with a sentence.
  const moveFolder = async (folderId: string, toFolderId: string | null) => {
    const r = await fetch("/api/coach/remote/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "move", folderId, toFolderId }),
    }).catch(() => null);
    const j = r ? ((await r.json().catch(() => ({}))) as { error?: string }) : {};
    if (r?.ok) {
      setNote("Folder moved.");
      void load(scope);
    } else setNote(j.error ?? "Couldn't move the folder.");
  };
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
  // Where a folder can go: any live folder of this library except itself, anything inside it, and its current parent.
  const movableTargets = (id: string) => {
    const all = wire && wire.available ? wire.folders ?? [] : [];
    const inside = (f: Folder): boolean => {
      let p = f.parentId ? folderInfo.get(f.parentId) : undefined;
      for (let i = 0; p && i < 5; i += 1) {
        if (p.id === id) return true;
        p = p.parentId ? folderInfo.get(p.parentId) : undefined;
      }
      return false;
    };
    return all
      .filter((f) => f.id !== id && !f.archived && !f.insideArchived && !inside(f) && f.id !== folderInfo.get(id)?.parentId)
      .sort((a, b) => a.name.localeCompare(b.name));
  };
  const archivedFolders = wire && wire.available ? (wire.folders ?? []).filter((f) => f.archived) : [];
  // Folders with nothing you can see in them still need an Archive button (review 2026-11-26).
  const emptyFolders = wire && wire.available ? (wire.folders ?? []).filter((f) => !f.archived && !f.insideArchived && f.canArchive && !groups.has(f.id)) : [];
  // 0353: by path, so a folder's subfolders follow it ("Objections", then "Objections / Pricing").
  const sortedGroups = [...groups].sort(([, a], [, b]) => a.name.localeCompare(b.name));

  return (
    <>
      <TopBar title="Library" subtitle="Calls and clips worth hearing again" />
      <div className="flex-1 overflow-y-auto bg-base px-4 md:px-8 py-4 space-y-4">
        {focus && (focus.fromTraining || focusFound === false) && (
          <div className="rounded-2xl border border-default bg-surface p-3 text-xs" role="status">
            {focusFound === false && wire && wire.available && wire.truncated && (
              <p className="text-secondary">That call is older than the newest ones shown here — find it in Search.</p>
            )}
            {focusFound === false && !(wire && wire.available && wire.truncated) && (
              <p className="text-secondary">That call isn&apos;t in the library for you — it may be waiting on the rep&apos;s approval, or it was taken out. Ask your manager.</p>
            )}
            {focus.fromTraining && (
              <Link href="/dashboard/remote-sales/training" className="font-semibold text-brand hover:underline">Back to Training</Link>
            )}
          </div>
        )}
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

        {wire && wire.available && wire.truncated && (
          <p className="text-xs text-secondary">Showing the {wire.items.length} most recently saved. Older ones are still here — find them in Search.</p>
        )}
        {sortedGroups.map(([folderKey, { name: folder, items }]) => (
          <section key={folderKey} className="space-y-2" aria-label={folder}>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-primary">{folder}</h2>
              {folderInfo.get(folderKey)?.canArchive && (
                <select
                  aria-label={`Move folder ${folder}`}
                  value=""
                  onChange={(e) => {
                    const v = e.currentTarget.value;
                    if (v) void moveFolder(folderKey, v === "__top__" ? null : v);
                  }}
                  className="ml-auto rounded border border-default bg-base px-1 py-0.5 text-[11px] text-secondary"
                >
                  <option value="">Move…</option>
                  {folderInfo.get(folderKey)?.parentId && <option value="__top__">To the top level</option>}
                  {movableTargets(folderKey).map((t) => (
                    <option key={t.id} value={t.id}>Into {t.name}</option>
                  ))}
                </select>
              )}
              {folderInfo.get(folderKey)?.canArchive && (
                <button type="button" onClick={() => void setArchived(folderKey, true)} aria-label={`Archive folder ${folder}`} className="inline-flex items-center gap-1 text-xs text-muted hover:text-primary">
                  <Archive className="h-3.5 w-3.5" aria-hidden /> Archive folder
                </button>
              )}
            </div>
            {items.length > 0 && items.every((i) => i.canOpenCall) && <AskFolder name={folder} items={items} />}
            <ul className="space-y-2">
              {items.map((i) => (
                <li key={i.id} id={`library-item-${i.id}`} className={`flex items-start gap-3 rounded-2xl border bg-surface p-3 ${focus?.item === i.id ? "border-strong" : "border-default"}`}>
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
                    {typeof i.heardBy === "number" && (
                      <p className="mt-1 text-muted">{i.heardBy === 0 ? "No one on the team has played it yet" : `Played by ${i.heardBy} ${i.heardBy === 1 ? "teammate" : "teammates"}`}</p>
                    )}
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
                  {/* Inside a folder that is also archived: restoring this one alone would show nothing (review 2026-11-26). */}
                  {f.canArchive && f.insideArchived ? (
                    <span className="ml-auto text-muted">Restore the folder it&apos;s in first</span>
                  ) : f.canArchive && (
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
