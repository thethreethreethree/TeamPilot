"use client";

import { useCallback, useEffect, useState } from "react";
import { HidePhrasesPanel } from "@/components/remote-sales/HidePhrasesPanel";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { VocabularySettings } from "@/components/remote-sales/VocabularySettings";

/**
 * Settings → Protection (RSS Phase 8, migration 0284; docs/rss/docs/06-UI-SPEC.md "Admin"). Company admins only — the
 * page shows this tab on the settings route's isCompanyAdmin verdict, and every route below checks again.
 *
 *   · Recording retention (F33.1, D14): how many recordings each rep keeps. Saved recordings are never removed.
 *   · Audit log (F31.5): who re-scored, overrode, deleted, trimmed, exported or changed retention, newest first.
 *   · Erasing a customer's data (F33.6; CLAUDE.md §3.1.1, AMD-014): find the calls by phone, email or client name,
 *     review each with the line that matched, confirm. Their words, recordings and the AI's reads of them are deleted;
 *     that the call happened, its rep and its score stay. The typed identifier is never stored (hash + hint only).
 *   · Webhooks (F31.8): send session.scored / session.closed / deal.closed to the company's own https address,
 *     signed with that endpoint's secret.
 */
type Retention = { keepLastPerRep: number | null; transcriptOnly?: boolean; graceHours?: number; isDefault: boolean; defaultKeep: number; defaultDays: number; min: number; max: number; canManage: boolean; notReady?: string };
type AuditRow = { id: number; at: string; action: string; actorName: string | null; objectType: string; objectId: string; meta: Record<string, unknown> };

const ACTION_WORDS: Record<string, string> = {
  "score.rescore": "Re-scored a call",
  "score.override": "Corrected a score",
  "recording.delete": "Deleted a recording",
  "recording.trim": "Trimmed a call",
  "recording.trim_restore": "Restored a trimmed section",
  "session.export": "Exported calls",
  "session.download": "Downloaded a call",
  "retention.set": "Changed recording retention",
  "vocabulary.set": "Changed the transcription vocabulary",
  "mfa.enabled": "Turned on sign-in codes",
  "mfa.removed": "Removed an authenticator",
  "mfa.reset": "Reset a member's sign-in codes",
  "transcript.edit": "Corrected a transcript line",
  "transcript.refresh_notes": "Refreshed a call's AI notes after corrections",
  "erasure.request": "Asked for a customer's data to be erased",
  "webhook.add": "Added a webhook",
  "webhook.off": "Turned off a webhook",
  "recording.orphan_purge": "Removed recordings no call or file pointed to",
};
// Actions the system takes on its own (actor_id null) — named as such, not as "someone no longer on the team".
const SYSTEM_ACTIONS = new Set(["recording.orphan_purge"]);

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

function detail(r: AuditRow): string {
  const m = r.meta ?? {};
  const mmss = (ms: unknown) => {
    const s = Math.round(Number(ms) / 1000);
    return Number.isFinite(s) ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "?";
  };
  switch (r.action) {
    case "retention.set":
      if (m.transcriptOnly) return "Keep transcripts only (audio removed after transcription)";
      return m.useDefault ? `Back to the standard ${String(m.defaultDays ?? 90)} days` : `Keep the last ${String(m.keepLastPerRep)} per rep`;
    case "vocabulary.set":
      return Number(m.count) ? `${String(m.count)} term${m.count === 1 ? "" : "s"}` : "Turned off";
    case "recording.trim":
    case "recording.trim_restore":
      return `${mmss(m.startMs)}–${mmss(m.endMs)}`;
    case "score.rescore":
    case "score.override":
      return typeof m.reason === "string" && m.reason ? `“${m.reason}”` : "";
    case "session.export":
      return `${String(m.rows ?? 0)} call${m.rows === 1 ? "" : "s"}`;
    case "session.download":
      return m.kind === "audio" ? "Audio" : "Transcript";
    case "webhook.add":
    case "webhook.off":
      return String(m.url ?? "");
    case "erasure.request":
      return `${String(m.hint ?? "")}, ${String(m.sessions ?? 0)} call${m.sessions === 1 ? "" : "s"}`;
    case "recording.orphan_purge":
      return `${String(m.files ?? 0)} recording${m.files === 1 ? "" : "s"}, ${(Number(m.bytes ?? 0) / 1048576).toFixed(1)} MB`;
    default:
      return "";
  }
}

export function ProtectionSettings() {
  const [ret, setRet] = useState<Retention | null>(null);
  const [keep, setKeep] = useState("");
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  const [more, setMore] = useState(false);
  const [filter, setFilter] = useState("");
  const [auditNote, setAuditNote] = useState<string | null>(null);
  // A failed read is said, not left as "Loading…" forever (2026-11-23).
  const [retFailed, setRetFailed] = useState(false);
  const [confirmTranscriptOnly, setConfirmTranscriptOnly] = useState(false);

  const loadRetention = useCallback(async () => {
    const r = await fetch("/api/coach/remote/settings/retention").catch(() => null);
    if (r?.ok) {
      const j = (await r.json()) as Retention;
      setRet(j);
      setRetFailed(false);
      setKeep(String(j.keepLastPerRep ?? j.defaultKeep));
    } else setRetFailed(true);
  }, []);

  const loadAudit = useCallback(async (action: string, before?: number) => {
    const qs = new URLSearchParams();
    if (action) qs.set("action", action);
    if (before) qs.set("before", String(before));
    const r = await fetch(`/api/coach/remote/audit?${qs}`).catch(() => null);
    const j = r ? ((await r.json().catch(() => ({}))) as { rows?: AuditRow[]; more?: boolean; notReady?: string; error?: string }) : { error: "Couldn't reach the server." };
    if (!r?.ok) {
      setAuditNote(j.error ?? "Couldn't load the audit log.");
      return;
    }
    setAuditNote(j.notReady ?? null);
    setRows((prev) => (before && prev ? [...prev, ...(j.rows ?? [])] : (j.rows ?? [])));
    setMore(!!j.more);
  }, []);

  useEffect(() => {
    void loadRetention();
  }, [loadRetention]);
  useEffect(() => {
    void loadAudit(filter);
  }, [loadAudit, filter]);

  const save = async (useDefault = false, transcriptOnly = false) => {
    setSaving(true);
    setNote(null);
    try {
      const r = await fetch("/api/coach/remote/settings/retention", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(useDefault ? { useDefault: true } : transcriptOnly ? { transcriptOnly: true } : { keepLastPerRep: Number(keep) }),
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setNote(j.error ?? "Couldn't save it.");
        return;
      }
      setNote("Saved. The nightly clean-up uses it from its next run.");
      setConfirmTranscriptOnly(false);
      await loadRetention();
      await loadAudit(filter);
    } catch {
      setNote("Couldn't reach the server.");
    } finally {
      setSaving(false);
    }
  };

  const n = Number(keep);
  const valid = ret ? Number.isInteger(n) && n >= ret.min && n <= ret.max : false;
  // Switching from the 90-day default to a count, or lowering a count, can remove recent audio at the next clean-up.
  const shrinking = ret && valid && (ret.keepLastPerRep === null || n < ret.keepLastPerRep);

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-default bg-surface p-4" aria-label="Recording retention">
        <h3 className="text-sm font-semibold text-primary">Recording retention</h3>
        <p className="mt-1 text-xs text-secondary">
          How long call audio is kept. Older recordings lose their audio in the nightly clean-up; the transcript, scores
          and coaching stay. Recordings anyone saved are never removed.
        </p>
        {retFailed && !ret ? (
          <p className="mt-3 text-xs text-muted">
            Couldn&apos;t load the retention setting.{" "}
            <button type="button" onClick={() => void loadRetention()} className="underline">Try again</button>
          </p>
        ) : !ret ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…</p>
        ) : (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-primary">
              {ret.transcriptOnly ? (
                <>
                  Now: <span className="font-semibold">transcripts only</span> — each call&apos;s audio is removed{" "}
                  {ret.graceHours ?? 24} hours after its transcript is ready
                </>
              ) : ret.keepLastPerRep === null ? (
                <>
                  Now: audio is kept for <span className="font-semibold tabular-nums">{ret.defaultDays}</span> days
                  <span className="text-muted"> (the standard setting)</span>
                </>
              ) : (
                <>
                  Now: keep each rep&apos;s last <span className="font-semibold tabular-nums">{ret.keepLastPerRep}</span> recordings
                </>
              )}
            </p>
            {ret.notReady ? (
              <p className="text-xs text-muted">{ret.notReady}</p>
            ) : ret.canManage ? (
              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="keep-per-rep" className="text-xs text-secondary">Keep the last</label>
                <input id="keep-per-rep" inputMode="numeric" value={keep} onChange={(e) => setKeep(e.target.value.replace(/[^\d]/g, ""))}
                  className="w-20 rounded-lg border border-default bg-base px-2 py-1.5 text-xs tabular-nums text-primary" />
                <span className="text-xs text-secondary">recordings per rep</span>
                <button type="button" disabled={!valid || saving || n === ret.keepLastPerRep} onClick={() => void save()}
                  className="rounded-lg bg-ember-400 px-3 py-1.5 text-xs font-semibold text-ink-950 disabled:opacity-50">
                  {saving ? "Saving…" : "Save"}
                </button>
                {!ret.transcriptOnly && (
                  <button type="button" disabled={saving} onClick={() => setConfirmTranscriptOnly(true)}
                    className="rounded-lg border border-default px-3 py-1.5 text-xs text-primary hover:bg-base disabled:opacity-50">
                    Keep transcripts only
                  </button>
                )}
                {(ret.keepLastPerRep !== null || ret.transcriptOnly) && (
                  <button type="button" disabled={saving} onClick={() => void save(true)}
                    className="rounded-lg border border-default px-3 py-1.5 text-xs text-primary hover:bg-base disabled:opacity-50">
                    Use the standard {ret.defaultDays} days
                  </button>
                )}
              </div>
            ) : null}
            {keep && !valid && ret.canManage && <p className="text-xs text-secondary">Pick a whole number from {ret.min} to {ret.max}.</p>}
            {confirmTranscriptOnly && ret.canManage && (
              <div className="space-y-2 rounded-lg border border-default bg-base p-3 text-xs text-secondary" role="alertdialog" aria-label="Keep transcripts only">
                <p className="font-semibold text-primary">Keep transcripts only?</p>
                <p>
                  Every call still has to be recorded so it can be transcribed. From the next nightly clean-up, a call&apos;s
                  audio is removed once its transcript is ready and the call is {ret.graceHours ?? 24} hours old — including
                  the calls you have now. Transcripts, scores and coaching stay.
                </p>
                <p>Once a call&apos;s audio is gone: no playback, no audio clips in patterns or the library, no re-transcribing. Recordings someone saved are kept. This can&apos;t be undone for the audio already removed.</p>
                <div className="flex gap-2">
                  <button type="button" disabled={saving} onClick={() => void save(false, true)} className="rounded-lg bg-ember-400 px-3 py-1.5 text-xs font-semibold text-ink-950 disabled:opacity-50">
                    {saving ? "Saving…" : "Yes, keep transcripts only"}
                  </button>
                  <button type="button" disabled={saving} onClick={() => setConfirmTranscriptOnly(false)} className="rounded-lg border border-default px-3 py-1.5 text-xs text-primary">
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {shrinking && <p className="text-xs text-secondary">Saving removes the audio of each rep&apos;s recordings beyond that number at the next clean-up, however recent. That can&apos;t be undone.</p>}
            {note && <p className="text-xs text-secondary" role="status">{note}</p>}
          </div>
        )}
      </section>

      <VocabularySettings />

      <section className="rounded-xl border border-default bg-surface p-4" aria-label="Audit log">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-primary">Audit log</h3>
          <label htmlFor="audit-filter" className="sr-only">Show</label>
          <select id="audit-filter" value={filter} onChange={(e) => setFilter(e.target.value)}
            className="ml-auto rounded-lg border border-default bg-base px-2 py-1 text-xs text-primary">
            <option value="">Everything</option>
            {Object.entries(ACTION_WORDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <p className="mt-1 text-xs text-secondary">Every re-score, correction, deletion, trim, export, retention change and erasure, and who did it. Entries can&apos;t be edited or removed.</p>
        {auditNote && <p className="mt-2 text-xs text-muted">{auditNote}</p>}
        {rows === null ? (
          <p className="mt-3 flex items-center gap-2 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…</p>
        ) : rows.length === 0 ? (
          !auditNote && <p className="mt-3 text-xs text-muted">Nothing recorded yet. The first re-score, correction, deletion, trim or export will appear here.</p>
        ) : (
          <ul className="mt-3">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-baseline gap-x-2 border-b border-default py-1.5 text-xs last:border-b-0">
                <span className="tabular-nums text-muted">{when(r.at)}</span>
                <span className="font-medium text-primary">{r.actorName ?? (SYSTEM_ACTIONS.has(r.action) ? "The system" : "Someone no longer on the team")}</span>
                <span className="text-secondary">{(ACTION_WORDS[r.action] ?? r.action).toLowerCase()}</span>
                {detail(r) && <span className="text-secondary">· {detail(r)}</span>}
                {r.objectType === "coaching_session" && (
                  <Link href={`/dashboard/sales-coach/${encodeURIComponent(r.objectId)}`} className="ml-auto text-brand hover:underline">Open the call</Link>
                )}
              </li>
            ))}
          </ul>
        )}
        {more && rows && (
          <button type="button" onClick={() => void loadAudit(filter, rows[rows.length - 1]?.id)}
            className="mt-2 text-xs text-brand hover:underline">Show older</button>
        )}
      </section>

      <ErasurePanel />
      <WebhooksPanel />
      {/* 0337 (F33.8): admin phrases that hide calls from all but the rep and admins. */}
      <HidePhrasesPanel />
    </div>
  );
}

type Unfinished = { id: string; kind: string; hint: string; createdAt: string; requestedBy: string | null };
type Found = { sessionId: string; startedAt: string; repName: string | null; clientLabel: string | null; channel: string; line: string | null };
const KIND_WORDS = { phone: "Phone number", email: "Email", client_label: "Client name" } as const;
const CHANNEL_WORDS: Record<string, string> = { phone: "Phone", video: "Video", in_person: "In person" };

type DayPlanMatch = { id: number; repName: string | null; day: string };
type ProspectMatch = { id: string; repName: string | null; name: string | null; organization: string | null };

function ErasurePanel() {
  const [kind, setKind] = useState<keyof typeof KIND_WORDS>("phone");
  const [value, setValue] = useState("");
  const [found, setFound] = useState<{ hint: string; capped: boolean; matches: Found[]; dayPlans?: DayPlanMatch[]; prospects?: ProspectMatch[] } | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // Reps' day plans that mention the customer (0322) — rep and day only; a plan's words are the rep's own.
  const [pickedPlans, setPickedPlans] = useState<Set<number>>(new Set());
  // Pipeline prospects whose name/organization mentions the customer (0323) — shown by name; ticked by default.
  const [pickedProspects, setPickedProspects] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Requests that did not finish (a failure between recording the request and erasing — OPEN.md 2026-11-20).
  const [unfinished, setUnfinished] = useState<Unfinished[]>([]);
  const loadUnfinished = useCallback(async () => {
    try {
      const r = await fetch("/api/coach/remote/erasure");
      if (!r.ok) return; // the notice is an aid; a failed read shows nothing rather than a wrong list
      const j = (await r.json()) as { unfinished?: Unfinished[] };
      setUnfinished(j.unfinished ?? []);
    } catch {
      /* same: no notice rather than a guess */
    }
  }, []);
  useEffect(() => {
    void loadUnfinished();
  }, [loadUnfinished]);

  const call = async (body: Record<string, unknown>) => {
    const r = await fetch("/api/coach/remote/erasure", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    return { ok: r.ok, j: (await r.json().catch(() => ({}))) as Record<string, unknown> };
  };

  const find = async () => {
    setBusy(true);
    setMsg(null);
    setFound(null);
    setConfirming(false);
    try {
      const { ok, j } = await call({ action: "find", kind, value });
      if (!ok) {
        setMsg(String(j.error ?? "The search failed."));
        return;
      }
      const f = j as unknown as { hint: string; capped: boolean; matches: Found[]; dayPlans?: DayPlanMatch[]; prospects?: ProspectMatch[] };
      setFound(f);
      setPicked(new Set(f.matches.map((m) => m.sessionId)));
      setPickedPlans(new Set((f.dayPlans ?? []).map((d) => d.id)));
      setPickedProspects(new Set((f.prospects ?? []).map((p) => p.id)));
    } catch {
      setMsg("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const erase = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { ok, j } = await call({ action: "erase", kind, value, sessionIds: [...picked], dayPlanIds: [...pickedPlans], prospectIds: [...pickedProspects] });
      if (!ok) {
        setMsg(String(j.error ?? "Nothing was erased."));
        return;
      }
      const plans = Number(j.plansErased ?? 0);
      const prospects = Number(j.prospectsErased ?? 0);
      const extra = [plans ? `${plans} day plan${plans === 1 ? "" : "s"}` : "", prospects ? `${prospects} pipeline prospect${prospects === 1 ? "" : "s"}` : ""].filter(Boolean);
      setMsg(
        `Erased ${String(j.erased)} call${j.erased === 1 ? "" : "s"}${extra.length ? ` and removed them from ${extra.join(" and ")}` : ""} for ${String(j.hint)}. The audit log below records it.`,
      );
      setFound(null);
      setValue("");
      setConfirming(false);
    } catch {
      setMsg("Couldn't reach the server. Search again to see what was erased.");
    } finally {
      setBusy(false);
      void loadUnfinished(); // a success may finish an older request; a failure may leave a new one
    }
  };

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="rounded-xl border border-default bg-surface p-4" aria-label="Erasing a customer's data">
      <h3 className="text-sm font-semibold text-primary">Erasing a customer&apos;s data</h3>
      <p className="mt-1 text-xs text-secondary">
        When a customer asks to be erased, find their calls here. What they said, the recordings and the AI&apos;s reads of
        those calls are deleted for good. That the call happened, who took it and its score stay. What you type is never
        stored.
      </p>
      {unfinished.length > 0 && (
        <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-3" role="status">
          <p className="text-xs font-semibold text-primary">
            {unfinished.length === 1 ? "An erasure didn't finish" : `${unfinished.length} erasures didn't finish`}
          </p>
          <ul className="mt-1 space-y-0.5 text-xs text-secondary">
            {unfinished.map((u) => (
              <li key={u.id}>
                {KIND_WORDS[u.kind as keyof typeof KIND_WORDS] ?? u.kind} {u.hint} — asked
                {u.requestedBy ? ` by ${u.requestedBy}` : ""} on {new Date(u.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-secondary">
            Search for that customer again below and erase the calls to finish. It&apos;s safe to repeat: calls already
            erased simply won&apos;t be found.
          </p>
        </div>
      )}
      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void find();
        }}
      >
        <label htmlFor="erase-kind" className="sr-only">Find by</label>
        <select id="erase-kind" value={kind} onChange={(e) => setKind(e.target.value as keyof typeof KIND_WORDS)}
          className="rounded-lg border border-default bg-base px-2 py-1.5 text-xs text-primary">
          {Object.entries(KIND_WORDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <label htmlFor="erase-value" className="sr-only">{KIND_WORDS[kind]}</label>
        <input id="erase-value" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off"
          placeholder={kind === "phone" ? "(555) 010-0123" : kind === "email" ? "name@example.com" : "As entered on the call"}
          className="min-w-0 flex-1 rounded-lg border border-default bg-base px-2 py-1.5 text-xs text-primary" />
        <button type="submit" disabled={busy || !value.trim()}
          className="rounded-lg border border-default px-3 py-1.5 text-xs text-primary hover:bg-base disabled:opacity-50">
          {busy && !found ? "Searching…" : "Find calls"}
        </button>
      </form>
      {kind === "phone" && (
        <p className="mt-1 text-[11px] text-muted">Numbers are found when the transcript wrote them as digits. A number said as words may be missed, so also search by name.</p>
      )}
      {kind === "client_label" && (
        <p className="mt-1 text-[11px] text-muted">
          Calls match the client name exactly as entered. Reps&apos; day plans and the pipeline match any mention of it, so a
          shorter form (&ldquo;Betty&rdquo; for &ldquo;Betty Ross&rdquo;) is found only by searching it too.
        </p>
      )}

      {found && (
        <div className="mt-3 space-y-2">
          {found.matches.length === 0 && (found.dayPlans?.length ?? 0) === 0 && (found.prospects?.length ?? 0) === 0 ? (
            <p className="text-xs text-secondary">No calls, day plans or pipeline prospects mention {found.hint}.</p>
          ) : (
            <>
              {found.matches.length > 0 && (
              <p className="text-xs text-primary">
                {found.matches.length} call{found.matches.length === 1 ? "" : "s"} mention {found.hint}
                {found.capped ? " (the first 200; erase these, then search again)" : ""}. Untick any that are someone else.
              </p>
              )}
              <ul className="space-y-1">
                {found.matches.map((m) => (
                  <li key={m.sessionId} className="flex items-start gap-2 rounded-lg border border-default p-2 text-xs">
                    <input type="checkbox" checked={picked.has(m.sessionId)} onChange={() => toggle(m.sessionId)}
                      aria-label={`Erase the call of ${new Date(m.startedAt).toLocaleDateString()}`} className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block text-primary">
                        {new Date(m.startedAt).toLocaleDateString(undefined, { dateStyle: "medium" })} · {CHANNEL_WORDS[m.channel] ?? m.channel} ·{" "}
                        {m.repName ?? "a former rep"}{m.clientLabel ? ` · ${m.clientLabel}` : ""}
                      </span>
                      {m.line && <span className="block truncate text-secondary">“{m.line}”</span>}
                    </span>
                  </li>
                ))}
              </ul>
              {(found.dayPlans?.length ?? 0) > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-primary">
                    {found.dayPlans!.length} rep day plan{found.dayPlans!.length === 1 ? "" : "s"} mention {found.hint}. Only the
                    customer&apos;s details are removed from them; a plan is the rep&apos;s own, so its words aren&apos;t shown here.
                  </p>
                  <ul className="space-y-1">
                    {found.dayPlans!.map((d) => (
                      <li key={d.id} className="flex items-center gap-2 rounded-lg border border-default p-2 text-xs">
                        <input
                          type="checkbox"
                          checked={pickedPlans.has(d.id)}
                          onChange={() => setPickedPlans((cur) => {
                            const next = new Set(cur);
                            if (next.has(d.id)) next.delete(d.id);
                            else next.add(d.id);
                            return next;
                          })}
                          aria-label={`Remove the customer from ${d.repName ?? "a former rep"}'s plan for ${d.day}`}
                        />
                        <span className="text-primary">
                          {new Date(`${d.day}T12:00:00Z`).toLocaleDateString(undefined, { dateStyle: "medium", timeZone: "UTC" })} · {d.repName ?? "a former rep"}&apos;s day plan
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {(found.prospects?.length ?? 0) > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-primary">
                    {found.prospects!.length} pipeline prospect{found.prospects!.length === 1 ? "" : "s"} mention {found.hint}. Their name and
                    organization are removed; the deal&apos;s stage, amount and dates stay. Untick any that are someone else.
                  </p>
                  <ul className="space-y-1">
                    {found.prospects!.map((p) => (
                      <li key={p.id} className="flex items-center gap-2 rounded-lg border border-default p-2 text-xs">
                        <input
                          type="checkbox"
                          checked={pickedProspects.has(p.id)}
                          onChange={() => setPickedProspects((cur) => {
                            const next = new Set(cur);
                            if (next.has(p.id)) next.delete(p.id);
                            else next.add(p.id);
                            return next;
                          })}
                          aria-label={`Erase the prospect ${p.name ?? "unnamed"}`}
                        />
                        <span className="text-primary">
                          {p.name ?? "Unnamed prospect"}{p.organization ? ` · ${p.organization}` : ""} · {p.repName ?? "a former rep"}&apos;s pipeline
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {confirming ? (
                <div className="rounded-lg border border-default bg-base p-3 text-xs">
                  <p className="text-primary">
                    Erase {picked.size} call{picked.size === 1 ? "" : "s"}
                    {pickedPlans.size ? ` and remove them from ${pickedPlans.size} day plan${pickedPlans.size === 1 ? "" : "s"}` : ""}
                    {pickedProspects.size ? `${pickedPlans.size ? " and" : " and remove them from"} ${pickedProspects.size} pipeline prospect${pickedProspects.size === 1 ? "" : "s"}` : ""} for {found.hint}?
                    The calls&apos; transcripts, recordings, the AI&apos;s summaries and quotes, saved clips and Ask Coach chats about them
                    are deleted. This can&apos;t be undone.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button type="button" disabled={busy || picked.size + pickedPlans.size + pickedProspects.size === 0} onClick={() => void erase()}
                      className="rounded-lg bg-ember-400 px-3 py-1.5 font-semibold text-ink-950 disabled:opacity-50">
                      {busy ? "Erasing…" : `Erase ${picked.size + pickedPlans.size + pickedProspects.size}`}
                    </button>
                    <button type="button" onClick={() => setConfirming(false)} className="px-2 text-muted hover:text-primary">Keep them</button>
                  </div>
                </div>
              ) : (
                <button type="button" disabled={picked.size + pickedPlans.size + pickedProspects.size === 0} onClick={() => setConfirming(true)}
                  className="rounded-lg border border-default px-3 py-1.5 text-xs text-primary hover:bg-base disabled:opacity-50">
                  Erase {picked.size + pickedPlans.size + pickedProspects.size} selected…
                </button>
              )}
            </>
          )}
        </div>
      )}
      {msg && <p className="mt-2 text-xs text-secondary" role="status">{msg}</p>}
    </section>
  );
}

type Endpoint = {
  id: string; url: string; events: string[]; active: boolean; createdAt: string;
  last: { ok: boolean; status: number | null; error: string | null; at: string; event: string } | null;
};
const EVENT_WORDS: Record<string, string> = {
  "session.scored": "A call is scored",
  "session.closed": "A call ends",
  "deal.closed": "A deal is marked sold",
  "call.to_crm": "A call is sent to your CRM (from Highlights)",
};

function WebhooksPanel() {
  const [data, setData] = useState<{ configured: boolean; endpoints: Endpoint[]; notReady?: string; historyUnreadable?: boolean } | null>(null);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<Set<string>>(new Set(Object.keys(EVENT_WORDS)));
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [secret, setSecret] = useState<{ id: string; value: string } | null>(null);
  const [confirmOff, setConfirmOff] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/coach/remote/webhooks").catch(() => null);
    if (r?.ok) setData(await r.json());
    else setMsg("Couldn't load webhooks.");
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const send = async (method: "POST" | "PATCH", body: Record<string, unknown>, key: string) => {
    setBusy(key);
    setMsg(null);
    try {
      const r = await fetch("/api/coach/remote/webhooks", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
      return { ok: r.ok, j };
    } catch {
      return { ok: false, j: { error: "Couldn't reach the server." } as Record<string, unknown> };
    } finally {
      setBusy(null);
    }
  };

  const add = async () => {
    const { ok, j } = await send("POST", { action: "add", url, events: [...events] }, "add");
    if (!ok) return setMsg(String(j.error ?? "Couldn't add it."));
    setUrl("");
    setMsg("Added. Send a test to check your receiver, then use its secret to verify signatures.");
    await load();
  };
  const test = async (id: string) => {
    const { ok, j } = await send("POST", { action: "test", endpointId: id }, `test:${id}`);
    if (!ok) return setMsg(String(j.error ?? "Couldn't send the test."));
    setMsg(j.ok ? `Test delivered (${String(j.status)}).` : `Your address didn't accept the test: ${String(j.error ?? j.status)}.`);
    await load();
  };
  const reveal = async (id: string) => {
    const { ok, j } = await send("POST", { action: "secret", endpointId: id }, `secret:${id}`);
    if (!ok) return setMsg(String(j.error ?? "Couldn't show the secret."));
    setSecret({ id, value: String(j.secret) });
  };
  const off = async (id: string) => {
    const { ok, j } = await send("PATCH", { endpointId: id }, `off:${id}`);
    setConfirmOff(null);
    if (!ok) return setMsg(String(j.error ?? "Couldn't turn it off."));
    setMsg("Turned off. Nothing more is sent to it, including retries.");
    await load();
  };

  return (
    <section className="rounded-xl border border-default bg-surface p-4" aria-label="Webhooks">
      <h3 className="text-sm font-semibold text-primary">Webhooks</h3>
      <p className="mt-1 text-xs text-secondary">
        Tell your own systems when a call is scored, ends, or closes a deal. We send ids, times, outcome, deal value and
        score, never what was said or the customer&apos;s name. Each request is signed so you can check it came from us.
      </p>
      {!data ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…</p>
      ) : data.notReady ? (
        <p className="mt-3 text-xs text-muted">{data.notReady}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {!data.configured && (
            <p className="rounded-lg border border-default bg-base p-2 text-xs text-primary" role="alert">
              Sending isn&apos;t switched on for this server yet (its signing key is missing). You can add addresses now;
              nothing is sent until it&apos;s set.
            </p>
          )}
          {data.endpoints.length > 0 && (
            <ul className="space-y-2">
              {data.endpoints.map((e) => (
                <li key={e.id} className="rounded-lg border border-default p-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`font-medium break-all ${e.active ? "text-primary" : "text-muted line-through"}`}>{e.url}</span>
                    {!e.active && <span className="text-muted">off</span>}
                  </div>
                  <p className="mt-0.5 text-secondary">{e.events.map((ev) => EVENT_WORDS[ev] ?? ev).join(" · ")}</p>
                  <p className="mt-0.5 text-muted">
                    {e.last
                      ? `Last: ${e.last.ok ? "delivered" : "failed"}${e.last.status ? ` (${e.last.status})` : e.last.error ? ` (${e.last.error})` : ""}, ${new Date(e.last.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}`
                      : data.historyUnreadable
                        ? "Couldn't load the last delivery."
                        : "Nothing sent yet."}
                  </p>
                  {e.active && (
                    <div className="mt-1 flex flex-wrap gap-3">
                      <button type="button" disabled={!!busy || !data.configured} onClick={() => void test(e.id)} className="text-brand hover:underline disabled:opacity-50">
                        {busy === `test:${e.id}` ? "Sending…" : "Send a test"}
                      </button>
                      <button type="button" disabled={!!busy || !data.configured} onClick={() => void reveal(e.id)} className="text-brand hover:underline disabled:opacity-50">
                        Show signing secret
                      </button>
                      {confirmOff === e.id ? (
                        <span className="inline-flex gap-2">
                          <span className="text-secondary">Stop sending to this address?</span>
                          <button type="button" disabled={!!busy} onClick={() => void off(e.id)} className="font-semibold text-primary hover:underline">Turn off</button>
                          <button type="button" onClick={() => setConfirmOff(null)} className="text-muted hover:text-primary">Keep</button>
                        </span>
                      ) : (
                        <button type="button" onClick={() => setConfirmOff(e.id)} className="text-muted hover:text-primary">Turn off…</button>
                      )}
                    </div>
                  )}
                  {secret?.id === e.id && (
                    <div className="mt-2 rounded-lg bg-base p-2">
                      <p className="text-secondary">Signing secret for this address only. Keep it in your receiver&apos;s settings.</p>
                      <code className="mt-1 block break-all text-primary">{secret.value}</code>
                      <p className="mt-2 text-secondary">To check a request: take the <code>X-Elostate-Timestamp</code> header and the raw body; compute
                        HMAC-SHA256 of <code>timestamp + &quot;.&quot; + body</code> with this secret, as hex; it must equal <code>X-Elostate-Signature</code>, and
                        the timestamp must be within 5 minutes of now. The <code>id</code> field is the same on a retry, so you can ignore repeats.</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          <form className="space-y-2 rounded-lg border border-default p-2" onSubmit={(e) => { e.preventDefault(); void add(); }}>
            <label htmlFor="webhook-url" className="block text-xs text-secondary">Add an address</label>
            <input id="webhook-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://your-system.example.com/elostate"
              className="w-full rounded-lg border border-default bg-base px-2 py-1.5 text-xs text-primary" inputMode="url" autoComplete="off" />
            <fieldset className="flex flex-wrap gap-3 text-xs">
              <legend className="sr-only">Send when</legend>
              {Object.entries(EVENT_WORDS).map(([k, v]) => (
                <label key={k} className="inline-flex items-center gap-1 text-primary">
                  <input type="checkbox" checked={events.has(k)}
                    onChange={() => setEvents((prev) => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; })} />
                  {v}
                </label>
              ))}
            </fieldset>
            <button type="submit" disabled={!!busy || !url.trim() || events.size === 0}
              className="rounded-lg bg-ember-400 px-3 py-1.5 text-xs font-semibold text-ink-950 disabled:opacity-50">
              {busy === "add" ? "Adding…" : "Add webhook"}
            </button>
          </form>
        </div>
      )}
      {msg && <p className="mt-2 text-xs text-secondary" role="status">{msg}</p>}
    </section>
  );
}
