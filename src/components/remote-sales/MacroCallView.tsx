"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, Check, ClipboardCopy, Loader2, Mail, MessageSquareText, Plus, Sparkles } from "lucide-react";
import { RemoteCallComments } from "@/components/remote-sales/RemoteCallComments";

/**
 * Remote Sales Macro Mode — one call, three tabs (docs/rss/MACRO-MODE-SPEC.md: "KEEP IT SIMPLE … 3 tabs").
 *
 *   Highlights   — Call Brief (the factual summary), Key Points, Next Steps; follow-up email / text drafts.
 *   Coaching     — the score out of 100, what they did well, what to improve (the growth review, whose tone law is
 *                  strengths first and growth as opportunity — the motivating wording the team asked for).
 *   Next Meeting — the agenda, what to bring up again, and the checklist the rep must review; each kept item becomes a
 *                  Task with its due date (reminders), and the prospect's next call date is set here.
 *
 * The rep's flow (the spec): Highlights → Coaching right after the call; Next Meeting a few days later, before the
 * second meeting. Every tab reads stored results; nothing is generated on open except where the rep asks.
 */
type BriefItem = { text: string; seq: number };
type Brief = {
  id: string;
  keyPoints: BriefItem[];
  nextSteps: BriefItem[];
  nextMeeting: { agenda: Array<{ text: string }>; bringUp: BriefItem[]; checklist: Array<{ text: string; due: string | null }> };
};
type BriefRes = {
  available?: boolean;
  reason?: string;
  brief: Brief | null;
  review: { kept: Array<{ text: string; due: string | null; task_id: string | null }>; createdAt: string } | null;
  prospect: { id: string; name: string | null; status: string; nextCallDate: string | null } | null;
  label: string | null;
  /** The viewer took this call. Only they link it to a pipeline and review its checklist (0304); a manager reads. */
  isOwner?: boolean;
};
type Tab = "highlights" | "coaching" | "next";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "highlights", label: "Highlights" },
  { id: "coaching", label: "Coaching" },
  { id: "next", label: "Next Meeting" },
];

export function MacroCallView({ sessionId, onFullView, onSeek }: { sessionId: string; onFullView: () => void; onSeek?: (s: number) => void }) {
  const [tab, setTab] = useState<Tab>("highlights");
  const [b, setB] = useState<BriefRes | null>(null);
  const [failed, setFailed] = useState(false);
  const [briefing, setBriefing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/coach/remote/${encodeURIComponent(sessionId)}/brief`, { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      setB((await r.json()) as BriefRes);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [sessionId]);
  useEffect(() => {
    void load();
  }, [load]);

  const prepare = async () => {
    setBriefing(true);
    try {
      const r = await fetch(`/api/coach/remote/${encodeURIComponent(sessionId)}/brief`, { method: "POST" });
      const d = (await r.json().catch(() => ({}))) as BriefRes & { error?: string };
      if (!r.ok) throw new Error(d.error ?? "Couldn't prepare the brief.");
      setB(d);
    } catch (e) {
      setB((prev) => (prev ? { ...prev, reason: e instanceof Error ? e.message : "Couldn't prepare the brief." } : prev));
    } finally {
      setBriefing(false);
    }
  };

  return (
    <section className="rounded-xl border border-default bg-surface" aria-label="This call">
      <div role="tablist" aria-label="Call views" className="flex border-b border-default">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 border-b-2 px-2 py-2.5 text-sm ${tab === t.id ? "border-brand font-semibold text-primary" : "border-transparent text-muted hover:text-primary"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="space-y-4 p-4" role="tabpanel">
        {failed ? (
          <p className="text-xs text-muted">Couldn&apos;t load this call&apos;s notes. Refresh to try again.</p>
        ) : !b ? (
          <p className="flex items-center gap-2 text-xs text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Loading…
          </p>
        ) : b.available === false ? (
          <p className="text-xs text-secondary">{b.reason ?? "Not available yet."}</p>
        ) : tab === "highlights" ? (
          <Highlights sessionId={sessionId} b={b} briefing={briefing} onPrepare={() => void prepare()} onChanged={() => void load()} />
        ) : tab === "coaching" ? (
          <>
            <Coaching sessionId={sessionId} />
            {/* The coaching loop lives here too: a rep reads what their manager sent; a manager answers a feedback
                request from the inbox without leaving Macro Mode (the inbox links to this page). */}
            <RemoteCallComments sessionId={sessionId} onSeek={onSeek} />
          </>
        ) : (
          <NextMeeting sessionId={sessionId} b={b} briefing={briefing} onPrepare={() => void prepare()} onChanged={() => void load()} />
        )}
        <p className="border-t border-subtle pt-3 text-right">
          <button type="button" onClick={onFullView} className="text-[11px] text-muted underline-offset-2 hover:text-primary hover:underline">
            Show the full call page
          </button>
        </p>
      </div>
    </section>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">{children}</h3>;
}

function NoBrief({ briefing, onPrepare, reason }: { briefing: boolean; onPrepare: () => void; reason?: string }) {
  return (
    <div className="rounded-lg border border-dashed border-default p-3 text-xs text-secondary">
      <p>The key points, next steps and next-meeting plan are prepared once the call is transcribed.</p>
      {reason && <p className="mt-1 text-amber-700 dark:text-amber-300">{reason}</p>}
      <button
        type="button"
        onClick={onPrepare}
        disabled={briefing}
        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
      >
        {briefing ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
        Prepare it now
      </button>
    </div>
  );
}

/* ── Highlights ─────────────────────────────────────────────────────────────────────────────── */

function Highlights({ sessionId, b, briefing, onPrepare, onChanged }: { sessionId: string; b: BriefRes; briefing: boolean; onPrepare: () => void; onChanged: () => void }) {
  const [summary, setSummary] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    fetch(`/api/coach/sales-session/${encodeURIComponent(sessionId)}/summarize`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { summary: null }))
      .then((d: { summary?: string | null }) => live && setSummary(d.summary ?? null))
      .catch(() => live && setSummary(null));
    return () => {
      live = false;
    };
  }, [sessionId]);

  return (
    <div className="space-y-4">
      <ProspectStrip b={b} sessionId={sessionId} onChanged={onChanged} />
      <div>
        <H>Call brief</H>
        {summary === undefined ? (
          <p className="text-xs text-muted">Loading…</p>
        ) : summary ? (
          <p className="text-sm leading-relaxed text-primary">{summary}</p>
        ) : (
          <p className="text-xs text-secondary">The brief appears once the call is transcribed and analyzed.</p>
        )}
      </div>
      {!b.brief ? (
        <NoBrief briefing={briefing} onPrepare={onPrepare} reason={b.reason} />
      ) : (
        <>
          <div>
            <H>Key points</H>
            {b.brief.keyPoints.length ? (
              <ol className="list-decimal space-y-1 pl-5 text-sm text-primary">
                {b.brief.keyPoints.map((k, i) => (
                  <li key={i}>{k.text}</li>
                ))}
              </ol>
            ) : (
              <p className="text-xs text-secondary">Nothing stood out enough to list.</p>
            )}
          </div>
          <div>
            <H>Next steps</H>
            {b.brief.nextSteps.length ? (
              <ul className="space-y-1 text-sm text-primary">
                {b.brief.nextSteps.map((k, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                    {k.text}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-secondary">No next step was agreed on the call.</p>
            )}
          </div>
        </>
      )}
      <FollowUp sessionId={sessionId} />
    </div>
  );
}

function ProspectStrip({ b, sessionId, onChanged }: { b: BriefRes; sessionId: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (b.prospect) {
    return (
      <Link
        href={`/dashboard/remote-sales/pipeline?p=${b.prospect.id}`}
        className="flex items-center justify-between rounded-lg border border-default bg-base/40 px-3 py-2 text-xs hover:border-brand"
      >
        <span className="text-primary">
          In your pipeline: <b>{b.prospect.name ?? "Unnamed prospect"}</b>
        </span>
        <span className="text-muted">
          {b.prospect.status === "won" ? "Closed won" : b.prospect.status === "lost" ? "Closed lost" : "Open"}
          {b.prospect.nextCallDate ? ` · next call ${b.prospect.nextCallDate}` : ""}
        </span>
      </Link>
    );
  }
  if (!b.isOwner) {
    return <p className="rounded-lg border border-dashed border-default px-3 py-2 text-xs text-secondary">This call isn&apos;t in its rep&apos;s pipeline yet — the rep adds it from their side.</p>;
  }
  const add = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/coach/remote/prospects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: (b.label ?? "New prospect").slice(0, 120), sessionId }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(d.error ?? "Couldn't add to the pipeline.");
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't add to the pipeline.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-default px-3 py-2 text-xs">
      <span className="text-secondary">This call isn&apos;t in your pipeline yet.</span>
      <button type="button" onClick={() => void add()} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-default px-2 py-1 text-primary hover:border-brand disabled:opacity-50">
        <Plus className="h-3.5 w-3.5" aria-hidden /> Add {b.label ? `“${b.label}”` : "this prospect"}
      </button>
      {err && <span className="w-full text-amber-700 dark:text-amber-300">{err}</span>}
    </div>
  );
}

type Draft = { id: string | null; channel: "email" | "text"; subject: string | null; body: string; createdAt: string };

function FollowUp({ sessionId }: { sessionId: string }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState<"email" | "text" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/coach/remote/${encodeURIComponent(sessionId)}/followup`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { drafts: [] }))
      .then((d: { drafts?: Draft[] }) => live && setDrafts(d.drafts ?? []))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [sessionId]);
  const write = async (channel: "email" | "text") => {
    setBusy(channel);
    setErr(null);
    try {
      const r = await fetch(`/api/coach/remote/${encodeURIComponent(sessionId)}/followup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      const d = (await r.json().catch(() => ({}))) as { draft?: Draft; error?: string };
      if (!r.ok || !d.draft) throw new Error(d.error ?? "Couldn't write the follow-up.");
      setDrafts((p) => [d.draft!, ...p]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't write the follow-up.");
    } finally {
      setBusy(null);
    }
  };
  const copy = async (d: Draft) => {
    try {
      await navigator.clipboard.writeText(d.subject ? `Subject: ${d.subject}\n\n${d.body}` : d.body);
      setCopied(d.createdAt);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setErr("Couldn't copy — select the text and copy it instead.");
    }
  };
  const latest = drafts[0];
  return (
    <div className="border-t border-subtle pt-4">
      <H>Follow up</H>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => void write("email")} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50">
          {busy === "email" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Mail className="h-3.5 w-3.5" aria-hidden />}
          Draft an email
        </button>
        <button type="button" onClick={() => void write("text")} disabled={!!busy} className="inline-flex items-center gap-1.5 rounded-lg border border-default px-3 py-1.5 text-xs text-primary hover:border-brand disabled:opacity-50">
          {busy === "text" ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <MessageSquareText className="h-3.5 w-3.5" aria-hidden />}
          Draft a text
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{err}</p>}
      {latest && (
        <div className="mt-3 rounded-lg border border-default bg-base/40 p-3">
          <p className="text-[11px] text-muted">
            {latest.channel === "email" ? "Email" : "Text"} draft · edit it, then send it from your own email or phone.
          </p>
          {latest.subject && <p className="mt-1 text-sm font-semibold text-primary">{latest.subject}</p>}
          <p className="mt-1 whitespace-pre-wrap text-sm text-primary">{latest.body}</p>
          <button type="button" onClick={() => void copy(latest)} className="mt-2 inline-flex items-center gap-1 text-xs text-secondary hover:text-primary">
            {copied === latest.createdAt ? <Check className="h-3.5 w-3.5" aria-hidden /> : <ClipboardCopy className="h-3.5 w-3.5" aria-hidden />}
            {copied === latest.createdAt ? "Copied" : "Copy"}
          </button>
        </div>
      )}
      <p className="mt-2 text-[11px] text-muted">Sending to Salesforce or HubSpot comes later; for now, copy it.</p>
    </div>
  );
}

/* ── Coaching ───────────────────────────────────────────────────────────────────────────────── */

type Review = { strengths: Array<{ point: string; example: string }>; growthAreas: Array<{ opportunity: string; nextStep: string }>; closing?: string };

function Coaching({ sessionId }: { sessionId: string }) {
  const [score, setScore] = useState<{ base: number; bonus: number; total: number } | null | undefined>(undefined);
  const [review, setReview] = useState<Review | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/coach/sales-session/pitch-score?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { pitch: null }))
      .then((d: { pitch?: { base: number; bonus: number; total: number } | null }) => live && setScore(d.pitch ?? null))
      .catch(() => live && setScore(null));
    fetch(`/api/coach/sales-session/review?sessionId=${encodeURIComponent(sessionId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { review: null }))
      .then((d: { review?: Review | null }) => live && setReview(d.review ?? null))
      .catch(() => live && setReview(null));
    return () => {
      live = false;
    };
  }, [sessionId]);
  const generate = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/coach/sales-session/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const d = (await r.json().catch(() => ({}))) as { review?: Review & { hasSignal?: boolean }; error?: string };
      if (!r.ok) throw new Error(d.error ?? "Couldn't prepare your coaching.");
      if (!d.review?.hasSignal) throw new Error("There isn't enough of your side of the call to coach from yet.");
      setReview(d.review);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't prepare your coaching.");
    } finally {
      setBusy(false);
    }
  };
  const base = score ? Math.max(0, Math.min(100, Math.round(score.base))) : 0;
  return (
    <div className="space-y-4">
      <div>
        <H>Score</H>
        {score === undefined ? (
          <p className="text-xs text-muted">Loading…</p>
        ) : score === null ? (
          <p className="text-xs text-secondary">Your score appears once the call is scored.</p>
        ) : (
          <div>
            <p className="text-3xl font-semibold tabular-nums text-primary">
              {base}
              <span className="text-base font-normal text-muted"> / 100</span>
              {score.bonus > 0 && <span className="ml-2 text-sm font-medium text-brand">+{Math.round(score.bonus * 10) / 10} bonus</span>}
            </p>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-base" role="img" aria-label={`Score ${base} out of 100`}>
              <div className="h-full rounded-full bg-brand" style={{ width: `${base}%` }} />
            </div>
          </div>
        )}
      </div>
      {review === undefined ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : !review ? (
        <div className="rounded-lg border border-dashed border-default p-3 text-xs text-secondary">
          <p>What you did well and what to work on next appear here once your coaching is ready.</p>
          {err && <p className="mt-1 text-amber-700 dark:text-amber-300">{err}</p>}
          <button type="button" onClick={() => void generate()} disabled={busy} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Sparkles className="h-3.5 w-3.5" aria-hidden />}
            Prepare my coaching
          </button>
        </div>
      ) : (
        <>
          <div>
            <H>What you did well</H>
            {review.strengths.length ? (
              <ul className="space-y-2">
                {review.strengths.map((s, i) => (
                  <li key={i} className="rounded-lg border border-default bg-base/40 p-3">
                    <p className="text-sm font-medium text-primary">{s.point}</p>
                    {s.example && <p className="mt-0.5 text-xs italic text-secondary">“{s.example}”</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-secondary">Nothing to call out on this one.</p>
            )}
          </div>
          <div>
            <H>Your next level</H>
            {review.growthAreas.length ? (
              <ul className="space-y-2">
                {review.growthAreas.map((g, i) => (
                  <li key={i} className="rounded-lg border border-default bg-base/40 p-3">
                    <p className="text-sm font-medium text-primary">{g.opportunity}</p>
                    {g.nextStep && <p className="mt-0.5 text-xs text-secondary">Try: {g.nextStep}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-secondary">Nothing to work on from this call.</p>
            )}
          </div>
          {review.closing && <p className="text-sm text-primary">{review.closing}</p>}
        </>
      )}
    </div>
  );
}

/* ── Next Meeting ───────────────────────────────────────────────────────────────────────────── */

function NextMeeting({ sessionId, b, briefing, onPrepare, onChanged }: { sessionId: string; b: BriefRes; briefing: boolean; onPrepare: () => void; onChanged: () => void }) {
  // §3.3 — ASK FIRST. Before the coach's agenda appears, the rep says what THEY want to cover next time; their items
  // lead the checklist and the coach's plan follows as a second opinion (the follow-through outcome's rule, applied to
  // the next meeting). Skipping is allowed — asking is not optional. A reviewed checklist has already been through it.
  const [own, setOwn] = useState<string[] | null>(null);
  const [draft, setDraft] = useState("");
  if (!b.brief) return <NoBrief briefing={briefing} onPrepare={onPrepare} reason={b.reason} />;
  if (!b.review && own === null && b.isOwner) {
    const who = b.prospect?.name ?? b.label ?? "this prospect";
    return (
      <div className="space-y-3">
        <NextCallDate b={b} onChanged={onChanged} />
        <div className="rounded-lg border border-default bg-base/40 p-3">
          <label htmlFor="own-plan" className="text-sm font-semibold text-primary">
            What do you want to cover with {who} next time?
          </label>
          <p className="mt-0.5 text-xs text-secondary">Your plan first — one item per line. The coach&apos;s suggestions come after.</p>
          <textarea
            id="own-plan"
            value={draft}
            onChange={(e) => setDraft(e.currentTarget.value)}
            rows={3}
            placeholder={"Confirm the March go-live\nBring the pricing options"}
            className="mt-2 w-full rounded-lg border border-default bg-base p-2 text-sm text-primary"
          />
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!draft.trim()}
              onClick={() => setOwn(draft.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 8))}
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
            >
              Add my plan, then show the coach&apos;s
            </button>
            <button type="button" onClick={() => setOwn([])} className="rounded-lg border border-default px-3 py-1.5 text-xs text-secondary hover:text-primary">
              Skip to the coach&apos;s suggestions
            </button>
          </div>
        </div>
      </div>
    );
  }
  const nm = b.brief.nextMeeting;
  return (
    <div className="space-y-4">
      <NextCallDate b={b} onChanged={onChanged} />
      {own && own.length > 0 && (
        <div>
          <H>Your plan</H>
          <ul className="space-y-1 text-sm text-primary">
            {own.map((t, i) => (
              <li key={i} className="flex gap-2">
                <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <H>{own && own.length > 0 ? "The coach's agenda" : "Agenda"}</H>
        {nm.agenda.length ? (
          <ol className="list-decimal space-y-1 pl-5 text-sm text-primary">
            {nm.agenda.map((a, i) => (
              <li key={i}>{a.text}</li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-secondary">No agenda suggested from this call.</p>
        )}
      </div>
      <div>
        <H>Bring up again</H>
        {nm.bringUp.length ? (
          <ul className="space-y-1 text-sm text-primary">
            {nm.bringUp.map((k, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
                {k.text}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-secondary">Nothing left open from this call.</p>
        )}
      </div>
      {b.isOwner || b.review ? (
        <Checklist sessionId={sessionId} b={b} onChanged={onChanged} own={own ?? []} />
      ) : (
        <div>
          <H>Suggested checklist</H>
          <ul className="space-y-1 text-sm text-primary">
            {b.brief.nextMeeting.checklist.map((c, i) => (
              <li key={i}>
                {c.text}
                {c.due && <span className="ml-1 text-[11px] text-muted">due {c.due}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-muted">Waiting for the rep to review it — their plan comes first.</p>
        </div>
      )}
    </div>
  );
}

function NextCallDate({ b, onChanged }: { b: BriefRes; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!b.prospect) {
    return <p className="rounded-lg border border-dashed border-default px-3 py-2 text-xs text-secondary">Add this call to your pipeline (Highlights) to set the next call date and keep its to-dos together.</p>;
  }
  const set = async (date: string) => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/coach/remote/prospects/${b.prospect!.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "set", kind: "next_call", value: date || null }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? "Couldn't save the date.");
      }
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save the date.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <label className="flex flex-wrap items-center gap-2 text-xs text-secondary">
      <CalendarClock className="h-3.5 w-3.5" aria-hidden />
      Next call with {b.prospect.name ?? "this prospect"}
      <input
        type="date"
        defaultValue={b.prospect.nextCallDate ?? ""}
        disabled={busy}
        onChange={(e) => void set(e.currentTarget.value)}
        className="rounded-lg border border-default bg-base px-2 py-1 text-xs text-primary"
      />
      {err && <span className="w-full text-amber-700 dark:text-amber-300">{err}</span>}
    </label>
  );
}

function Checklist({ sessionId, b, onChanged, own }: { sessionId: string; b: BriefRes; onChanged: () => void; own: string[] }) {
  const brief = b.brief!;
  // The rep's own items lead; the coach's suggestions follow. All editable, all untickable, saved only on review.
  const [items, setItems] = useState(() => [
    ...own.map((text) => ({ text, due: null as string | null, keep: true })),
    ...brief.nextMeeting.checklist.map((c) => ({ ...c, keep: true })),
  ]);
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (b.review) {
    return (
      <div>
        <H>Checklist · reviewed</H>
        <ul className="space-y-1 text-sm text-primary">
          {b.review.kept.map((k, i) => (
            <li key={i} className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 text-brand" aria-hidden />
              {k.text}
              {k.due && <span className="text-[11px] text-muted">due {k.due}</span>}
              {!k.task_id && <span className="text-[11px] text-amber-700 dark:text-amber-300">not added to Tasks</span>}
            </li>
          ))}
        </ul>
        <p className="mt-1 text-[11px] text-muted">
          {b.prospect ? (
            <>
              Each item is a to-do on{" "}
              <Link href={`/dashboard/remote-sales/pipeline?p=${b.prospect.id}`} className="underline">
                {b.prospect.name ?? "this prospect"}
              </Link>{" "}
              in your pipeline, with its due date.
            </>
          ) : (
            "Each item is saved as a task with its due date."
          )}
        </p>
      </div>
    );
  }
  const save = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/coach/remote/${encodeURIComponent(sessionId)}/brief/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ briefId: brief.id, items: items.filter((i) => i.keep && i.text.trim()).map((i) => ({ text: i.text.trim(), due: i.due || null })) }),
      });
      const d = (await r.json().catch(() => ({}))) as { error?: string; failed?: number };
      if (!r.ok) {
        // Already reviewed (409), or to-dos added but the review row failed (500): reload rather than invite a re-save.
        if (r.status === 409) onChanged();
        throw new Error(d.error ?? "Couldn't save the checklist.");
      }
      if (d.failed) setErr(`${d.failed} item${d.failed === 1 ? "" : "s"} couldn't be added to Tasks.`);
      onChanged();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save the checklist.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <H>Checklist — review before it&apos;s saved</H>
      {!b.prospect && (
        <p className="mb-2 text-[11px] text-secondary">Tip: add this call to your pipeline first (Highlights), so the checklist becomes that prospect&apos;s to-dos.</p>
      )}
      {items.length === 0 && <p className="mb-2 text-xs text-secondary">Nothing was suggested from this call — add your own below.</p>}
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex flex-wrap items-center gap-2">
            <input
              type="checkbox"
              checked={it.keep}
              onChange={(e) => {
                const keep = e.currentTarget.checked;
                setItems((p) => p.map((x, j) => (j === i ? { ...x, keep } : x)));
              }}
              aria-label={`Keep: ${it.text}`}
              className="accent-brand"
            />
            <input
              value={it.text}
              onChange={(e) => {
                const text = e.currentTarget.value;
                setItems((p) => p.map((x, j) => (j === i ? { ...x, text } : x)));
              }}
              className="min-w-0 flex-1 rounded-lg border border-default bg-base px-2 py-1 text-sm text-primary"
            />
            <input
              type="date"
              value={it.due ?? ""}
              onChange={(e) => {
                const due = e.currentTarget.value || null;
                setItems((p) => p.map((x, j) => (j === i ? { ...x, due } : x)));
              }}
              aria-label="Due date"
              className="rounded-lg border border-default bg-base px-2 py-1 text-xs text-primary"
            />
          </li>
        ))}
      </ul>
      <div className="mt-2 flex gap-2">
        <input
          value={adding}
          onChange={(e) => setAdding(e.currentTarget.value)}
          placeholder="Add your own item"
          className="min-w-0 flex-1 rounded-lg border border-default bg-base px-2 py-1 text-sm text-primary"
        />
        <button
          type="button"
          disabled={!adding.trim()}
          onClick={() => {
            setItems((p) => [...p, { text: adding.trim(), due: null, keep: true }]);
            setAdding("");
          }}
          className="rounded-lg border border-default px-2 py-1 text-xs text-primary disabled:opacity-50"
        >
          Add
        </button>
      </div>
      <button
        type="button"
        onClick={() => void save()}
        disabled={busy || !items.some((i) => i.keep && i.text.trim())}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />}
        Save checklist to Tasks
      </button>
      {err && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">{err}</p>}
    </div>
  );
}
