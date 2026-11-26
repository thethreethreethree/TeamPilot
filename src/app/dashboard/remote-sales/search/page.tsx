"use client";

import { FOLLOW_SEEN_EVENT } from "@/components/sales-coach/NotificationBell";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bell, BellRing, Download, Loader2, Search, Share2, Star, X } from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useIsSalesCoachManager } from "@/lib/hooks/useCurrentUserRole";
import { CitedAnswer, type Citation } from "@/components/sales-coach/CitedAnswer";
import { ELEMENTS } from "@/lib/coach/pitchScore/rubric";
import { REMOTE_ELEMENTS } from "@/lib/coach/pitchScore/rubricRemote";

/**
 * Sales Coach → Search calls (RSS Phase 5; docs/rss/docs/06-UI-SPEC.md "Find").
 *
 * A filter rail (words, channel, rep, outcome, dates, score range, keyword tracker, rubric item + grade, talk share,
 * disputed), the matching calls with the
 * lines that matched (each opens the call at that moment), *Save search*, saved searches, and *Export CSV* for
 * managers, and *Ask about these calls* (RSS Phase 6, Gong F13.13): one question over the newest ten results,
 * answered with time chips that open each call at the cited moment. Everything is searched through the viewer's own access: a rep finds their calls, a manager their team's.
 */
type Hit = { seq: number; speaker: string; text: string; atMs: number | null };
type Row = { sessionId: string; repName: string | null; channel: string; callLabel: string | null; startedAt: string; outcome: string | null; score: number | null; hits: Hit[] };
// following/newCount: 0342 (F12.7) — a followed search shows how many calls matched since you last opened it.
// mine/shared/sharedBy: 0362 (F12.7) — a manager can share a search with the team; others see it and can follow it.
type Saved = { id: string; name: string; query: string; following?: boolean; newCount?: number | null; newCapped?: boolean; mine?: boolean; shared?: boolean; sharedBy?: string | null };
type Filters = {
  q: string; channel: string; rep: string; outcome: string; from: string; to: string; scoreMin: string; scoreMax: string; tracker: string;
  // 2026-11-22 (Phase 5): a rubric item and the grade the call got on it, the rep's talk share, disputed calls.
  element: string; grade: string; talkMin: string; talkMax: string; disputed: string;
  // F11.12: a topic or competitor the call's AI read found.
  topic: string;
  // F10.10 (0367): the call's current category.
  category: string;
};

const EMPTY: Filters = {
  q: "", channel: "all", rep: "", outcome: "all", from: "", to: "", scoreMin: "", scoreMax: "", tracker: "",
  element: "", grade: "missed", talkMin: "", talkMax: "", disputed: "", topic: "", category: "",
};
const CHANNEL: Record<string, string> = { phone: "Phone", video: "Video" }; // Remote Sales: phone and video only
const OUTCOME: Record<string, string> = { sold: "Sold", follow_up: "Follow-up", no_sale: "No sale", undecided: "Undecided" };
const SPEAKER: Record<string, string> = { rep: "Rep", customer: "Customer" };

const toQuery = (f: Filters) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v && v !== "all") p.set(k, v);
  return p.toString();
};
const fromQuery = (q: string): Filters => {
  const p = new URLSearchParams(q);
  const f = { ...EMPTY };
  for (const k of Object.keys(EMPTY) as (keyof Filters)[]) f[k] = p.get(k) ?? EMPTY[k];
  return f;
};

export default function SearchCallsPage() {
  const isManager = useIsSalesCoachManager();
  const [f, setF] = useState<Filters>(EMPTY);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [narrower, setNarrower] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved[]>([]);
  const [savedAvailable, setSavedAvailable] = useState(true);
  const [trackers, setTrackers] = useState<Array<{ id: string; name: string }>>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([]);
  const [categoriesFailed, setCategoriesFailed] = useState(false);
  const [reps, setReps] = useState<Array<{ id: string; full_name: string | null }>>([]);
  // Failed reads are said, not shown as "none" (2026-11-23).
  const [listFailed, setListFailed] = useState({ saved: false, trackers: false, reps: false });
  const [saveName, setSaveName] = useState("");
  const [askQ, setAskQ] = useState("");
  const [asking, setAsking] = useState(false);
  const [askAnswer, setAskAnswer] = useState<{ text: string; citations: Citation[] } | null>(null);

  const run = useCallback(async (filters: Filters) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/coach/remote/search?${toQuery(filters)}`);
      const j = (await r.json().catch(() => ({}))) as { rows?: Row[]; truncated?: boolean; narrower?: boolean; error?: string };
      if (!r.ok) {
        setErr(j.error ?? "The search failed.");
        return;
      }
      setRows(j.rows ?? []);
      setTruncated(!!j.truncated);
      setNarrower(!!j.narrower);
    } catch {
      setErr("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    // Filters can arrive in the URL (2026-11-25): Team call stats links a rep's row to ?rep=<id>, and any shared
    // search link opens as that search. Same parser as a saved search (fromQuery); unknown keys are ignored.
    const initial = typeof window !== "undefined" && window.location.search ? fromQuery(window.location.search.slice(1)) : EMPTY;
    setF(initial);
    void run(initial);
    fetch("/api/coach/remote/saved-searches")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { available: boolean; searches: Saved[] } | null) => {
        if (!j) return;
        setSavedAvailable(j.available);
        setSaved(j.searches);
        // Opened from the bell (F12.7, 2026-11-26): ?saved=<id> names the followed search this link opens. Its new
        // calls are now seen — the same record openSaved writes; the count clears only once the server has it.
        const openedId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("saved") : null;
        const opened = openedId ? j.searches.find((s) => s.id === openedId) : undefined;
        if (opened?.following && (opened.newCount || opened.newCapped)) {
          void fetch("/api/coach/remote/saved-searches/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: opened.id, kind: "seen" }) })
            .then((r) => {
              if (!r.ok) return;
              setSaved((xs) => xs.map((x) => (x.id === opened.id ? { ...x, newCount: 0, newCapped: false } : x)));
              window.dispatchEvent(new Event(FOLLOW_SEEN_EVENT)); // the bell refreshes
            })
            .catch(() => null);
        }
      })
      .catch(() => setListFailed((x) => ({ ...x, saved: true })));
    fetch("/api/coach/remote/trackers")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      // A draft tracker (0352) has never been checked on a call, so it can't find any: not offered as a filter.
      .then((j: { trackers?: Array<{ id: string; name: string; draft?: boolean }> } | null) => setTrackers((j?.trackers ?? []).filter((t) => !t.draft)))
      .catch(() => setListFailed((x) => ({ ...x, trackers: true })));
    // F10.10 (0367): the company's call categories, for the Category filter.
    fetch("/api/coach/remote/call-categories")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { categories?: Array<{ id: string; name: string }> }) => setCategories(j.categories ?? []))
      .catch(() => setCategoriesFailed(true));
  }, [run]);

  useEffect(() => {
    if (!isManager) return;
    fetch("/api/team")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: { members?: Array<{ id: string; full_name: string | null }> } | null) => setReps(j?.members ?? []))
      .catch(() => setListFailed((x) => ({ ...x, reps: true })));
  }, [isManager]);

  const query = useMemo(() => toQuery(f), [f]);
  const set = (k: keyof Filters) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    const r = await fetch("/api/coach/remote/saved-searches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: saveName.trim(), query }),
    }).catch(() => null);
    const j = r ? ((await r.json().catch(() => ({}))) as { search?: Saved; error?: string }) : {};
    if (r?.ok && j.search) {
      setSaved([j.search, ...saved]);
      setSaveName("");
    } else setErr(j.error ?? "Couldn't save the search.");
  };
  const toggleShare = async (s: Saved) => {
    const r = await searchEvent(s.id, s.shared ? "unshare" : "share");
    if (r?.ok) setSaved((xs) => xs.map((x) => (x.id === s.id ? { ...x, shared: !s.shared } : x)));
    else setErr("Couldn't change who sees that saved search.");
  };
  const searchEvent = (id: string, kind: "follow" | "unfollow" | "seen" | "share" | "unshare") =>
    fetch("/api/coach/remote/saved-searches/events", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, kind }) }).catch(() => null);
  const openSaved = (s: Saved) => {
    const nf = fromQuery(s.query);
    setF(nf);
    void run(nf);
    if (s.following && (s.newCount || s.newCapped)) {
      // Opened: the new calls are seen. The badge clears only once the server has the record.
      void searchEvent(s.id, "seen").then((r) => r?.ok && setSaved((xs) => xs.map((x) => (x.id === s.id ? { ...x, newCount: 0, newCapped: false } : x))));
    }
  };
  const toggleFollow = async (s: Saved) => {
    const r = await searchEvent(s.id, s.following ? "unfollow" : "follow");
    if (r?.ok) setSaved((xs) => xs.map((x) => (x.id === s.id ? { ...x, following: !s.following, newCount: 0, newCapped: false } : x)));
    else setErr("Couldn't change that saved search.");
  };
  const unsave = async (id: string) => {
    const r = await fetch("/api/coach/remote/saved-searches", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => null);
    if (r?.ok) setSaved(saved.filter((s) => s.id !== id));
  };

  const input = "w-full rounded-lg border border-default bg-surface px-2 py-1.5 text-xs text-primary";
  return (
    <>
      <TopBar title="Search calls" subtitle="Find a call by what was said and how it went" />
      <div className="flex-1 overflow-y-auto bg-base px-4 md:px-8 py-4">
        <div className="grid gap-4 md:grid-cols-[16rem_1fr]">
          <form
            className="space-y-2"
            aria-label="Filters"
            onSubmit={(e) => {
              e.preventDefault();
              void run(f);
            }}
          >
            <label className="block text-[11px] text-muted">
              Words said
              <input value={f.q} onChange={set("q")} placeholder={'e.g. contract, "free trial", -price'} className={input} />
            </label>
            <label className="block text-[11px] text-muted">
              Channel
              <select value={f.channel} onChange={set("channel")} className={input}>
                <option value="all">All</option>
                {Object.entries(CHANNEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            {isManager && reps.length > 0 && (
              <label className="block text-[11px] text-muted">
                Rep
                <select value={f.rep} onChange={set("rep")} className={input}>
                  <option value="">Everyone</option>
                  {reps.map((r) => <option key={r.id} value={r.id}>{r.full_name ?? "Unnamed"}</option>)}
                  {listFailed.reps && <option disabled>Couldn&apos;t load your team — refresh</option>}
                </select>
              </label>
            )}
            <label className="block text-[11px] text-muted">
              Outcome
              <select value={f.outcome} onChange={set("outcome")} className={input}>
                <option value="all">Any</option>
                {Object.entries(OUTCOME).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] text-muted">From<input type="date" value={f.from} onChange={set("from")} className={input} /></label>
              <label className="block text-[11px] text-muted">To<input type="date" value={f.to} onChange={set("to")} className={input} /></label>
              <label className="block text-[11px] text-muted">Score ≥<input inputMode="numeric" value={f.scoreMin} onChange={set("scoreMin")} className={input} /></label>
              <label className="block text-[11px] text-muted">Score ≤<input inputMode="numeric" value={f.scoreMax} onChange={set("scoreMax")} className={input} /></label>
            </div>
            <label className="block text-[11px] text-muted">
              Topic or competitor
              <input value={f.topic} onChange={set("topic")} placeholder="e.g. pricing, Spectrum" maxLength={60} className={input} />
            </label>
            {(categories.length > 0 || categoriesFailed) && (
              <label className="block text-[11px] text-muted">
                Category
                <select value={f.category} onChange={set("category")} className={input}>
                  <option value="">Any</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  {categoriesFailed && <option disabled>Couldn&apos;t load categories — refresh</option>}
                </select>
              </label>
            )}
            {trackers.length > 0 && (
              <label className="block text-[11px] text-muted">
                Mentions tracker
                <select value={f.tracker} onChange={set("tracker")} className={input}>
                  <option value="">Any</option>
                  {trackers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  {listFailed.trackers && <option disabled>Couldn&apos;t load trackers — refresh</option>}
                </select>
              </label>
            )}
            <div className="grid grid-cols-[1fr_auto] gap-2">
              <label className="block text-[11px] text-muted">
                Rubric item
                <select value={f.element} onChange={set("element")} className={input}>
                  <option value="">Any</option>
                  {/* Remote Search: the phone & video rubric's items (D6), then door-only items for calls scored before it. */}
                  {REMOTE_ELEMENTS.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
                  {ELEMENTS.filter((e) => !REMOTE_ELEMENTS.some((r) => r.id === e.id)).map((e) => (
                    <option key={e.id} value={e.id}>{e.label} (door rubric)</option>
                  ))}
                </select>
              </label>
              <label className="block text-[11px] text-muted">
                Graded
                <select value={f.grade} onChange={set("grade")} disabled={!f.element} className={input}>
                  <option value="missed">Missed</option>
                  <option value="partial">Partial</option>
                  <option value="hit">Hit</option>
                </select>
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block text-[11px] text-muted">Rep talk % ≥<input inputMode="numeric" value={f.talkMin} onChange={set("talkMin")} className={input} /></label>
              <label className="block text-[11px] text-muted">Rep talk % ≤<input inputMode="numeric" value={f.talkMax} onChange={set("talkMax")} className={input} /></label>
            </div>
            <label className="flex items-center gap-2 text-[11px] text-muted">
              <input type="checkbox" checked={f.disputed === "1"} onChange={(e) => setF((x) => ({ ...x, disputed: e.target.checked ? "1" : "" }))} />
              Only calls whose score the rep disputed
            </label>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={busy} className="inline-flex items-center gap-1 rounded-lg bg-ember-400 px-3 py-1.5 text-xs font-semibold text-ink-950 disabled:opacity-60">
                <Search className="h-3.5 w-3.5" aria-hidden /> Search
              </button>
              <button type="button" onClick={() => { setF(EMPTY); void run(EMPTY); }} className="rounded-lg px-2 py-1.5 text-xs text-muted hover:text-primary">Clear</button>
            </div>

            {listFailed.saved && <p className="border-t border-default pt-3 text-[11px] text-muted">Couldn&apos;t load your saved searches. Refresh to try again.</p>}
            {savedAvailable && !listFailed.saved && (
              <div className="space-y-1 border-t border-default pt-3">
                <div className="flex gap-1">
                  <input value={saveName} onChange={(e) => setSaveName(e.target.value)} maxLength={60} placeholder="Name this search" aria-label="Saved search name" className={input} />
                  <button type="button" disabled={!saveName.trim()} onClick={save} aria-label="Save search" className="rounded-lg border border-default px-2 text-muted hover:text-primary disabled:opacity-50">
                    <Star className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
                {saved.map((s) => (
                  <div key={s.id} className="flex items-center gap-1 text-xs">
                    <button type="button" onClick={() => openSaved(s)} className="min-w-0 flex-1 truncate text-left text-brand hover:underline" title={s.mine === false ? `Shared by ${s.sharedBy ?? "a manager"}` : undefined}>
                      {s.name}
                      {s.mine === false && <span className="ml-1 text-[10px] text-muted">· shared by {s.sharedBy ?? "a manager"}</span>}
                    </button>
                    {s.following && !s.newCount && s.newCapped ? (
                      <span className="rounded-full bg-brand/10 px-1.5 text-[10px] text-secondary" title="Too many matches to count — open the search to see them">
                        new?
                      </span>
                    ) : null}
                    {s.following && s.newCount ? (
                      <span className="rounded-full bg-brand/15 px-1.5 text-[10px] font-semibold text-primary" title="Calls that matched since you last opened this search">
                        {s.newCount}
                        {s.newCapped ? "+" : ""} new
                      </span>
                    ) : null}
                    {s.following && s.newCount === null && <span className="text-[10px] text-muted" title="Couldn't check for new calls">?</span>}
                    <button
                      type="button"
                      onClick={() => void toggleFollow(s)}
                      aria-pressed={s.following === true}
                      aria-label={s.following ? `Stop following ${s.name}` : `Follow ${s.name}: show new matching calls`}
                      title={s.following ? "Following: new matching calls are counted here" : "Follow: count new matching calls here"}
                      className={`p-0.5 ${s.following ? "text-brand" : "text-muted hover:text-primary"}`}
                    >
                      {s.following ? <BellRing className="h-3 w-3" aria-hidden /> : <Bell className="h-3 w-3" aria-hidden />}
                    </button>
                    {isManager && s.mine !== false && (
                      <button
                        type="button"
                        onClick={() => void toggleShare(s)}
                        aria-pressed={s.shared === true}
                        aria-label={s.shared ? `Stop sharing ${s.name} with the team` : `Share ${s.name} with the team`}
                        title={s.shared ? "Shared: your team sees this search and can follow it (each sees only calls they can open)" : "Share with the team"}
                        className={`p-0.5 ${s.shared ? "text-brand" : "text-muted hover:text-primary"}`}
                      >
                        <Share2 className="h-3 w-3" aria-hidden />
                      </button>
                    )}
                    {s.mine !== false && (
                      <button type="button" onClick={() => unsave(s.id)} aria-label={`Remove saved search ${s.name}`} className="p-0.5 text-muted hover:text-primary">
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <Link href="/dashboard/remote-sales/library" className="block pt-2 text-xs text-brand hover:underline">Open the library</Link>
          </form>

          <section aria-label="Results" className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted">
                {busy ? "Searching…" : rows ? `${rows.length} call${rows.length === 1 ? "" : "s"}${truncated ? " (showing the newest 200)" : ""}${narrower ? " · more calls may match than one search reads; add a rep, channel or date to narrow it" : ""}` : ""}
              </span>
              {isManager && rows && rows.length > 0 && (
                <a href={`/api/coach/remote/search/export?${query}`} className="ml-auto inline-flex items-center gap-1 text-xs text-brand hover:underline">
                  <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
                </a>
              )}
            </div>
            {err && <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">{err}</p>}
            {busy && !rows && <Loader2 className="h-4 w-4 animate-spin text-muted" aria-hidden />}
            {rows && rows.length === 0 && !busy && <p className="text-xs text-muted">No calls match.</p>}
            {rows && rows.length > 0 && (
              <form
                className="rounded-2xl border border-default bg-surface p-3 space-y-2"
                aria-label="Ask about these calls"
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (askQ.trim().length < 3) return;
                  setAsking(true);
                  setAskAnswer(null);
                  try {
                    const r = await fetch("/api/coach/remote/ask", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ question: askQ.trim(), sessionIds: rows.slice(0, 10).map((x) => x.sessionId) }),
                    });
                    const j = (await r.json().catch(() => ({}))) as { answer?: string | null; citations?: Citation[]; error?: string };
                    if (!r.ok) setErr(j.error ?? "The coach couldn't answer.");
                    else setAskAnswer({ text: j.answer ?? "The coach isn't answering on this account right now.", citations: j.citations ?? [] });
                  } finally {
                    setAsking(false);
                  }
                }}
              >
                <label className="block text-[11px] text-muted">
                  Ask the coach about {Math.min(10, rows.length) === rows.length ? "these calls" : "the newest 10 of these calls"}
                  <input value={askQ} onChange={(e) => setAskQ(e.target.value)} maxLength={2000} placeholder="e.g. How do customers react when we mention the setup fee?" className={input} />
                </label>
                <button type="submit" disabled={asking || askQ.trim().length < 3} className="rounded-lg border border-default px-3 py-1 text-xs text-secondary hover:text-primary disabled:opacity-50">
                  {asking ? "Asking…" : "Ask"}
                </button>
                {askAnswer && (
                  <CitedAnswer
                    text={askAnswer.text}
                    citations={askAnswer.citations}
                    labelFor={(c) => rows.find((x) => x.sessionId === c.sessionId)?.callLabel ?? "call"}
                  />
                )}
              </form>
            )}
            <ul className="space-y-2">
              {(rows ?? []).map((r) => (
                <li key={r.sessionId} className="rounded-2xl border border-default bg-surface p-3 text-xs">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <Link href={`/dashboard/remote-sales/calls/${r.sessionId}`} className="font-semibold text-brand hover:underline">{r.callLabel || "Untitled call"}</Link>
                    <span className="text-muted">
                      {r.repName ?? "A rep"} · {CHANNEL[r.channel] ?? r.channel} · {new Date(r.startedAt).toLocaleDateString()}
                      {r.outcome ? ` · ${OUTCOME[r.outcome] ?? r.outcome}` : ""}
                      {r.score !== null ? ` · score ${r.score}` : ""}
                    </span>
                  </div>
                  {r.hits.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {r.hits.map((h) => (
                        <li key={h.seq} className="text-secondary">
                          {h.atMs !== null ? (
                            <Link href={`/dashboard/remote-sales/calls/${r.sessionId}?t=${Math.floor(h.atMs / 1000)}`} className="mr-1 tabular-nums text-brand hover:underline">
                              {Math.floor(h.atMs / 60000)}:{String(Math.floor((h.atMs % 60000) / 1000)).padStart(2, "0")}
                            </Link>
                          ) : null}
                          <span className="text-muted">{SPEAKER[h.speaker] ?? "Unclear"}:</span> {h.text}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
