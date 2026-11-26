"use client";

import { useCallback, useEffect, useState } from "react";
import { TrackerAdoption } from "./TrackerAdoption";
import { AdoptionBoard } from "./AdoptionBoard";

/**
 * Keyword trackers — the manager screen (RSS Phase 3 step 3, Gong F11.1). In Settings → Coaching.
 *
 * Branches on `canManage` from GET /api/coach/remote/trackers (the requireSalesCoachManager verdict). Reps see
 * the list read-only: it says what their calls are listened for. A tracker is never edited: "Switch off" keeps
 * its past hits explainable, and changing the words means a new tracker (0276). After creating one, the screen
 * offers to scan recent phone/video calls, since a tracker otherwise only applies to calls that land later.
 *
 * Smart trackers (0329): example sentences instead of exact words; an AI read finds lines that mean the same thing in
 * any words. Saving one reads the last calls for it in the background (the route), so there is no preview or scan.
 */
type Kind = "keyword" | "smart";
type Tracker = { id: string; name: string; phrases: string[]; side: "rep" | "customer" | "any"; active: boolean; draft?: boolean; kind?: Kind; within_first_seconds?: number | null; starts_on?: string | null; ends_on?: string | null; channels?: string[] | null };
/** 0361 (F11.3): which call types a tracker listens to. "both" is stored as no limit. */
type Channels = "both" | "phone" | "video";
const channelsBody = (c: Channels) => (c === "both" ? null : [c]);
const channelsLabel = (t: Tracker) => (t.channels?.length === 1 ? ` · ${t.channels[0] === "phone" ? "phone" : "video"} calls only` : "");
/** 0344 (F11.5): "from 1 Dec" / "until 31 Dec" / "1–31 Dec"; future start = scheduled. */
const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
function datesLabel(t: Tracker): string {
  if (!t.starts_on && !t.ends_on) return "";
  const today = new Date().toISOString().slice(0, 10);
  if (t.ends_on && t.ends_on < today) return ` · ended ${fmtDay(t.ends_on)}`;
  if (t.starts_on && t.starts_on > today) return ` · scheduled from ${fmtDay(t.starts_on)}${t.ends_on ? ` until ${fmtDay(t.ends_on)}` : ""}`;
  if (t.starts_on && t.ends_on) return ` · ${fmtDay(t.starts_on)} – ${fmtDay(t.ends_on)}`;
  return t.starts_on ? ` · from ${fmtDay(t.starts_on)}` : ` · until ${fmtDay(t.ends_on!)}`;
}
type Preview = {
  callsChecked: number;
  callsWithHits: number;
  hitCount: number;
  perPhrase: Array<{ phrase: string; hits: number; calls: number }>;
  examples: Array<{ sessionId: string; label: string | null; startedAt: string; atMs: number | null; speaker: string; matched: string; text: string }>;
};
type Read =
  | { available: true; trackers: Tracker[]; canManage: boolean }
  | { available: false; reason: string; canManage: boolean };

const SIDE: Record<Tracker["side"], string> = { rep: "Rep says it", customer: "Customer says it", any: "Either side" };
const API = "/api/coach/remote/trackers";

export function KeywordTrackers() {
  const [read, setRead] = useState<Read | null>(null);
  // Which tracker's adoption panel is open (2026-11-23).
  const [adoptionFor, setAdoptionFor] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phrases, setPhrases] = useState("");
  const [side, setSide] = useState<Tracker["side"]>("any");
  const [kind, setKind] = useState<Kind>("keyword");
  // 0335 (F11.3): only the first N minutes of a call; empty = the whole call.
  const [windowMin, setWindowMin] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [endsOn, setEndsOn] = useState("");
  const [channels, setChannels] = useState<Channels>("both");
  const windowMinutes = (): number | null | "bad" => {
    if (!windowMin.trim()) return null;
    const n = Number(windowMin);
    return Number.isFinite(n) && n >= 0.5 && n <= 60 ? n : "bad";
  };
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // F11.4: try the phrases on recent calls before saving — what it would catch, and which phrase is noisy.
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const runPreview = async () => {
    const list = phrases.split("\n").map((p) => p.trim()).filter(Boolean);
    if (list.length === 0) {
      setMsg("Write at least one phrase to preview.");
      return;
    }
    setPreviewing(true);
    setMsg(null);
    try {
      const r = await fetch("/api/coach/remote/trackers/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phrases: list, side, withinFirstMinutes: windowMinutes() === "bad" ? null : windowMinutes(), startsOn: startsOn || null, endsOn: endsOn || null, channels: channelsBody(channels) }),
      });
      const j = (await r.json().catch(() => ({}))) as { preview?: Preview; error?: string };
      if (!r.ok || !j.preview) throw new Error(j.error ?? "Couldn't preview the tracker.");
      setPreview(j.preview);
    } catch (e) {
      setPreview(null);
      setMsg(e instanceof Error ? e.message : "Couldn't preview the tracker.");
    } finally {
      setPreviewing(false);
    }
  };

  const load = useCallback(async () => {
    try {
      const r = await fetch(API);
      if (r.ok) setRead((await r.json()) as Read);
    } catch {
      /* the section stays as it was */
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const send = async (method: "POST" | "PATCH", body: unknown) => {
    const r = await fetch(API, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => ({}))) as { error?: string; scanned?: number; hits?: number; backfilling?: number };
    return { ok: r.ok, j };
  };

  const create = async (draft = false) => {
    const list = phrases.split("\n").map((p) => p.trim()).filter(Boolean);
    if (!name.trim() || list.length === 0) {
      setMsg(kind === "smart" ? "Give the tracker a name and at least one example sentence." : "Give the tracker a name and at least one word or phrase.");
      return;
    }
    const w = windowMinutes();
    if (w === "bad") {
      setMsg("The window is between 0.5 and 60 minutes — or leave it empty for the whole call.");
      return;
    }
    if (startsOn && endsOn && endsOn < startsOn) {
      setMsg("The end date can't be before the start date.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const { ok, j } = await send("POST", { name: name.trim(), phrases: list, side, kind, withinFirstMinutes: w, startsOn: startsOn || null, endsOn: endsOn || null, channels: channelsBody(channels), ...(draft ? { draft: true } : {}) });
      if (!ok) return setMsg(j.error ?? "Couldn't save the tracker.");
      setName("");
      setPhrases("");
      setSide("any");
      setWindowMin("");
      setStartsOn("");
      setEndsOn("");
      setChannels("both");
      setPreview(null);
      setMsg(
        draft
          ? "Saved as a draft. It isn't checked on any call until you put it live."
          : kind === "smart"
          ? j.backfilling
            ? `Saved. Reading your last ${j.backfilling} ${j.backfilling === 1 ? "call" : "calls"} for it now — mentions show on those calls within a few minutes. New calls are checked as they land.`
            : "Saved. New phone and video calls will be checked for it."
          : "Saved. New phone and video calls will be checked for it.",
      );
      await load();
    } finally {
      setBusy(false);
    }
  };

  const scan = async () => {
    setBusy(true);
    setMsg("Checking recent calls…");
    try {
      const { ok, j } = await send("POST", { action: "scan" });
      setMsg(ok ? `Checked ${j.scanned ?? 0} recent calls; ${j.hits ?? 0} new mentions found.` : j.error ?? "Couldn't check recent calls.");
    } finally {
      setBusy(false);
    }
  };

  // 0352 (F11.4): a draft goes live once; a smart one then reads back recent calls, as a new one does.
  const goLive = async (t: Tracker) => {
    setBusy(true);
    try {
      const { ok, j } = await send("PATCH", { id: t.id, action: "publish" });
      setMsg(
        !ok
          ? j.error ?? "Couldn't put it live."
          : j.backfilling
            ? `"${t.name}" is live. Reading your last ${j.backfilling} ${j.backfilling === 1 ? "call" : "calls"} for it now.`
            : `"${t.name}" is live. New phone and video calls will be checked for it.`,
      );
      await load();
    } finally {
      setBusy(false);
    }
  };
  // A tracker's words never change (0276), a draft's included: to adjust one, copy it into the form, preview, save anew.
  const copyToForm = (t: Tracker) => {
    setName(t.name);
    setPhrases(t.phrases.join("\n"));
    setSide(t.side);
    setKind(t.kind ?? "keyword");
    setWindowMin(t.within_first_seconds ? String(Math.round((t.within_first_seconds / 60) * 10) / 10) : "");
    setStartsOn(t.starts_on ?? "");
    setEndsOn(t.ends_on ?? "");
    setChannels(t.channels?.length === 1 ? (t.channels[0] as Channels) : "both");
    setPreview(null);
    setMsg(`Copied "${t.name}" into the form below — change it, preview it, then save it as a new draft or put it live. Switch the old draft off when you're done.`);
  };

  const switchOff = async (t: Tracker) => {
    setBusy(true);
    try {
      const { ok, j } = await send("PATCH", { id: t.id });
      setMsg(ok ? `"${t.name}" switched off. Its past mentions stay on the record.` : j.error ?? "Couldn't switch it off.");
      await load();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-default bg-surface p-4" aria-label="Keyword trackers">
      <h3 className="text-sm font-semibold text-primary">Keyword trackers</h3>
      <p className="mb-3 text-xs text-muted">
        Exact words or phrases to listen for on phone and video calls — competitors, products, required disclosures.
        Each call shows where they were said. Reps see this list too.
      </p>
      {!read ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !read.available ? (
        <p className="text-sm text-muted">{read.reason}</p>
      ) : (
        <>
          {read.trackers.length === 0 ? (
            <p className="mb-3 text-sm text-muted">No trackers yet.</p>
          ) : (
            <>
            {/* All messages at a glance (F18.1); choosing one opens its Adoption view in the list. */}
            <AdoptionBoard onOpen={(id) => setAdoptionFor(id)} canManage={read.canManage} />
            <ul className="mb-3 space-y-1.5">
              {read.trackers.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className={t.active ? "font-medium text-primary" : "text-muted line-through"}>{t.name}</span>
                  {t.active && t.draft && (
                    <span className="rounded-full border border-dashed border-default px-1.5 py-px text-[10px] text-secondary" title="Not checked on any call until it goes live">
                      Draft
                    </span>
                  )}
                  {t.kind === "smart" && (
                    <span className="rounded-full border border-default px-1.5 py-px text-[10px] text-secondary" title="Finds the same idea in any words">
                      Smart
                    </span>
                  )}
                  <span className="text-xs text-muted">
                    {t.active ? SIDE[t.side] : "Switched off"}
                    {t.within_first_seconds ? ` · first ${Math.round((t.within_first_seconds / 60) * 10) / 10} min` : ""}
                    {datesLabel(t)}
                    {channelsLabel(t)} ·{" "}
                    {t.kind === "smart" ? t.phrases.map((p) => `“${p}”`).join(" ") : t.phrases.join(", ")}
                  </span>
                  <button
                    type="button"
                    aria-expanded={adoptionFor === t.id}
                    onClick={() => setAdoptionFor(adoptionFor === t.id ? null : t.id)}
                    className="ml-auto rounded-lg border border-default px-2 py-0.5 text-xs text-secondary hover:text-primary"
                  >
                    Adoption
                  </button>
                  {read.canManage && t.active && t.draft && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void goLive(t)}
                        className="rounded-lg bg-ember-400 px-2 py-0.5 text-xs font-semibold text-ink-950 disabled:opacity-50"
                      >
                        Go live
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => copyToForm(t)}
                        className="rounded-lg border border-default px-2 py-0.5 text-xs text-secondary hover:text-primary disabled:opacity-50"
                      >
                        Copy to form
                      </button>
                    </>
                  )}
                  {read.canManage && t.active && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void switchOff(t)}
                      className="rounded-lg border border-default px-2 py-0.5 text-xs text-muted hover:text-primary disabled:opacity-50"
                    >
                      Switch off
                    </button>
                  )}
                  {adoptionFor === t.id && <TrackerAdoption trackerId={t.id} />}
                </li>
              ))}
            </ul>
            </>
          )}
          {read.canManage && (
            <div className="grid gap-2 md:grid-cols-2">
              <fieldset className="md:col-span-2">
                <legend className="text-xs text-muted">What to listen for</legend>
                <div className="mt-1 flex flex-wrap gap-2" role="radiogroup">
                  {(
                    [
                      ["keyword", "Exact words", "Matches the words you write"],
                      ["smart", "Same idea, any words", "AI finds lines that mean what your examples say"],
                    ] as const
                  ).map(([k, label, hint]) => (
                    <label key={k} className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs ${kind === k ? "border-ember-400 text-primary" : "border-default text-secondary"}`}>
                      <input
                        type="radio"
                        name="tracker-kind"
                        value={k}
                        checked={kind === k}
                        onChange={() => {
                          setKind(k);
                          setPreview(null);
                          setMsg(null);
                        }}
                      />
                      <span>
                        {label} <span className="text-muted">· {hint}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label className="text-xs text-muted">
                Name
                <input
                  value={name}
                  maxLength={60}
                  onChange={(e) => setName(e.currentTarget.value)}
                  placeholder="e.g. Competitors"
                  className="mt-1 w-full rounded-lg border border-default bg-base p-2 text-sm text-primary"
                />
              </label>
              <label className="text-xs text-muted">
                Who has to say it
                <select
                  value={side}
                  onChange={(e) => setSide(e.currentTarget.value as Tracker["side"])}
                  className="mt-1 w-full rounded-lg border border-default bg-base p-2 text-sm text-primary"
                >
                  <option value="any">Either side</option>
                  <option value="rep">The rep</option>
                  <option value="customer">The customer</option>
                </select>
              </label>
              <label className="text-xs text-muted">
                Only in the first … minutes (optional)
                <input
                  value={windowMin}
                  inputMode="decimal"
                  onChange={(e) => setWindowMin(e.currentTarget.value)}
                  placeholder="Whole call"
                  aria-label="Only in the first minutes"
                  className="mt-1 w-full rounded-lg border border-default bg-base p-2 text-sm text-primary"
                />
                <span className="mt-0.5 block text-[11px]">e.g. 2 — for a disclosure that must come early. Lines with no time aren&apos;t counted.</span>
              </label>
              <label className="text-xs text-muted">
                Call types
                <select value={channels} onChange={(e) => setChannels(e.currentTarget.value as Channels)} aria-label="Call types" className="mt-1 w-full rounded-lg border border-default bg-base p-2 text-sm text-primary">
                  <option value="both">Phone and video calls</option>
                  <option value="phone">Phone calls only</option>
                  <option value="video">Video calls only</option>
                </select>
                <span className="mt-0.5 block text-[11px]">e.g. &ldquo;share my screen&rdquo; belongs to video calls; a phone call that never says it isn&apos;t a miss.</span>
              </label>
              <label className="text-xs text-muted">
                Start date (optional)
                <input type="date" value={startsOn} onChange={(e) => setStartsOn(e.currentTarget.value)} aria-label="Start date" className="mt-1 w-full rounded-lg border border-default bg-base p-2 text-sm text-primary" />
                <span className="mt-0.5 block text-[11px]">Only calls from this day on. A past date reads back from then; a future one waits until that day.</span>
              </label>
              <label className="text-xs text-muted">
                End date (optional)
                <input type="date" value={endsOn} onChange={(e) => setEndsOn(e.currentTarget.value)} aria-label="End date" className="mt-1 w-full rounded-lg border border-default bg-base p-2 text-sm text-primary" />
                <span className="mt-0.5 block text-[11px]">Calls after this day aren&apos;t counted — e.g. the end of a campaign.</span>
              </label>
              <label className="text-xs text-muted md:col-span-2">
                {kind === "smart"
                  ? "Example sentences, one per line (up to 10) — write them the way a customer or rep might say it"
                  : "Words or phrases, one per line (whole words, any capitalisation)"}
                <textarea
                  value={phrases}
                  rows={3}
                  onChange={(e) => setPhrases(e.currentTarget.value)}
                  placeholder={kind === "smart" ? "We're locked into a contract until June\nOur deal with the other company hasn't ended yet" : "spectrum\nxfinity"}
                  className="mt-1 w-full rounded-lg border border-default bg-base p-2 text-sm text-primary"
                />
              </label>
              <div className="flex flex-wrap gap-2 md:col-span-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void create()}
                  className="rounded-lg bg-ember-400 px-3 py-2 text-xs font-semibold text-ink-950 disabled:opacity-50"
                >
                  Add tracker
                </button>
                {/* F11.4: save without switching it on — preview, come back, put it live when it's right. */}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void create(true)}
                  className="rounded-lg border border-default px-3 py-2 text-xs text-primary hover:border-ember-400 disabled:opacity-50"
                >
                  Save as draft
                </button>
                {kind === "keyword" && (
                <button
                  type="button"
                  disabled={busy || previewing}
                  onClick={() => void runPreview()}
                  className="rounded-lg border border-default px-3 py-2 text-xs text-primary hover:border-ember-400 disabled:opacity-50"
                >
                  {previewing ? "Previewing…" : "Preview on recent calls"}
                </button>
                )}
                {kind === "keyword" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void scan()}
                  className="rounded-lg border border-default px-3 py-2 text-xs text-muted hover:text-primary disabled:opacity-50"
                >
                  Check recent calls
                </button>
                )}
                {kind === "smart" && (
                  <p className="basis-full text-[11px] text-muted">
                    After you add it, your last 10 calls are read for it. Each call is read once for all your smart trackers (up to 10). A mention shows the example it matched.
                  </p>
                )}
              </div>
              {preview && (
                <div className="rounded-lg border border-default bg-base/40 p-3 text-xs md:col-span-2" aria-label="Tracker preview">
                  <p className="text-primary">
                    {preview.callsChecked === 0
                      ? "No finished phone or video calls to try it on yet."
                      : `Would catch ${preview.hitCount} ${preview.hitCount === 1 ? "mention" : "mentions"} in ${preview.callsWithHits} of your last ${preview.callsChecked} calls.`}{" "}
                    <span className="text-muted">Nothing is saved until you add it.</span>
                  </p>
                  {preview.perPhrase.length > 1 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {preview.perPhrase.map((p) => (
                        <li
                          key={p.phrase}
                          className={`rounded-full border px-2 py-0.5 ${preview.callsChecked > 0 && p.calls / preview.callsChecked > 0.6 ? "border-amber-500/60 text-amber-700 dark:text-amber-300" : "border-default text-secondary"}`}
                          title={preview.callsChecked > 0 && p.calls / preview.callsChecked > 0.6 ? "On most calls — probably too common to mean much" : undefined}
                        >
                          {p.phrase} · {p.calls} {p.calls === 1 ? "call" : "calls"}
                        </li>
                      ))}
                    </ul>
                  )}
                  {preview.examples.length > 0 && (
                    <ul className="mt-2 space-y-1.5">
                      {preview.examples.map((e) => (
                        <li key={e.sessionId}>
                          <a
                            href={`/dashboard/remote-sales/calls/${e.sessionId}${e.atMs !== null ? `?t=${Math.floor(e.atMs / 1000)}` : ""}`}
                            className="block rounded-md px-1 py-0.5 hover:bg-surface"
                          >
                            <span className="text-muted">
                              {e.label ?? "Untitled call"} · {e.speaker === "rep" ? "Rep" : e.speaker === "customer" ? "Customer" : "Unlabelled"}
                              {e.atMs !== null ? ` · ${Math.floor(e.atMs / 60000)}:${String(Math.floor((e.atMs % 60000) / 1000)).padStart(2, "0")}` : ""}:
                            </span>{" "}
                            <span className="text-primary">“{e.text}”</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
      {msg && (
        <p className="mt-2 text-xs text-muted" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}
