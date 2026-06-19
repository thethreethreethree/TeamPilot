"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  Heart,
  Loader2,
  MessageCircleQuestion,
  Sparkles,
  X,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { LearningHint } from "@/components/learning/LearningHint";
import { useToast } from "@/components/ui/toast";
import { useCompanyName } from "@/lib/hooks/useCompany";

/**
 * /dashboard/admin/team-check — Pillar 2 admin digest.
 *
 * Surfaces (user, task) pairs that may need a check-in, derived
 * from observable engagement signals on the §3.1 chain. Every row
 * pairs a count (last engagement N days ago) with a constructive
 * next step (A7); no row is shown as a standalone warning.
 *
 * The page itself follows the mirror frame (A11): the System
 * surfaces the fact ("X days since last meaningful action on this
 * task"), the admin decides whether to act and how. The
 * "Send check-in" button does not auto-send — it opens a modal
 * with the suggested text editable so the admin can adjust the
 * voice to their relationship with the teammate.
 *
 * A10 self-view note: every row shown here about user X is data
 * X can also see about themselves on /dashboard/operations/[id]
 * (the task page renders their own staleness + count under
 * "Your engagement on this task"). No shadow read.
 */

type DigestRow = {
  userId: string;
  userName: string;
  taskId: string;
  taskTitle: string;
  taskStatus: string;
  taskPriority: string;
  participantRole: string;
  joinedAt: string;
  lastEngagedAt: string | null;
  engagementCount: number;
  daysStale: number;
  suggestedNextStep: string;
};

export default function TeamCheckPage() {
  const companyName = useCompanyName();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<DigestRow[]>([]);
  const [error, setError] = useState("");
  const [staleDays, setStaleDays] = useState(4);
  const [nudgeRow, setNudgeRow] = useState<DigestRow | null>(null);

  useEffect(() => {
    void load();
  }, []);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/admin/team-check");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't load digest.");
      setRows(data.rows ?? []);
      setStaleDays(data.staleDays ?? 4);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error.");
    } finally {
      setLoading(false);
    }
  };

  const onNudgeSent = () => {
    toast.success(
      "Check-in posted",
      "It landed in the task thread. The §3.1 chain has the event."
    );
    setNudgeRow(null);
    void load();
  };

  return (
    <div className="min-h-screen bg-base">
      <TopBar
        title="Team check"
        subtitle={`${companyName} · Pillar 2 · who might need a doorway today`}
      />
      <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
        <ConstitutionalBanner />

        {loading && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted py-12">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            Reading the chain…
          </div>
        )}

        {!loading && error && (
          <div className="glass-card p-4 border border-red-500/30 bg-red-500/5">
            <p className="text-sm text-primary mb-1">Couldn&apos;t load digest.</p>
            <p className="text-xs text-secondary">{error}</p>
          </div>
        )}

        {!loading && !error && rows.length === 0 && (
          <EmptyState staleDays={staleDays} />
        )}

        {!loading && !error && rows.length > 0 && (
          <div className="space-y-3">
            <p className="text-[10px] text-muted uppercase tracking-widest font-mono px-1">
              {rows.length} {rows.length === 1 ? "row" : "rows"} · staleness
              threshold: {staleDays} days
            </p>
            {rows.map((r) => (
              <DigestRowCard
                key={`${r.taskId}:${r.userId}`}
                row={r}
                onSendCheckIn={() => setNudgeRow(r)}
              />
            ))}
          </div>
        )}
      </div>

      {nudgeRow && (
        <NudgeModal
          row={nudgeRow}
          onClose={() => setNudgeRow(null)}
          onSent={onNudgeSent}
        />
      )}
    </div>
  );
}

// ─── Constitutional banner ─────────────────────────────────────

function ConstitutionalBanner() {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-ember-400/5 border border-ember-400/20">
      <Heart className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" aria-hidden />
      <p className="text-xs text-secondary leading-relaxed">
        This is a doorway, not a dashboard. Every row pairs a count with one
        constructive next step. The System never decides for you — you read
        the signal, you choose whether to open the conversation. The same data
        shown about each teammate is also visible to them on their own task page.
      </p>
    </div>
  );
}

// ─── Empty state ───────────────────────────────────────────────

function EmptyState({ staleDays }: { staleDays: number }) {
  return (
    <div className="glass-card p-8 text-center">
      <CheckCircle2
        className="w-7 h-7 text-emerald-400 mx-auto mb-3"
        aria-hidden
      />
      <p className="text-sm text-primary mb-1">
        No rows in the digest right now.
      </p>
      <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
        Every active participant has touched their open tasks within the
        last {staleDays} days. Either the team is moving, or no tasks are
        old enough to flag yet. Check back tomorrow.
      </p>
    </div>
  );
}

// ─── Row card ──────────────────────────────────────────────────

function DigestRowCard({
  row,
  onSendCheckIn,
}: {
  row: DigestRow;
  onSendCheckIn: () => void;
}) {
  const subtle =
    row.engagementCount === 1
      ? "1 meaningful action"
      : `${row.engagementCount} meaningful actions`;
  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-semibold text-primary">
              {row.userName}
            </span>
            <span className="text-xs text-muted">·</span>
            <span className="text-xs text-secondary">
              {row.participantRole}
            </span>
            {row.taskStatus === "Blocked" && (
              <span className="text-[10px] uppercase tracking-widest font-mono px-1.5 py-0.5 rounded bg-red-500/10 text-red-300 border border-red-500/30">
                Blocked
              </span>
            )}
          </div>
          <Link
            href={`/dashboard/operations/${row.taskId}`}
            className="text-xs text-brand hover:text-primary inline-flex items-center gap-1 mb-2"
          >
            {row.taskTitle}
            <ArrowRight className="w-3 h-3" aria-hidden />
          </Link>
          <p className="text-xs text-muted flex items-center gap-1.5 mb-3">
            <Clock className="w-3 h-3" aria-hidden />
            {row.lastEngagedAt
              ? `${row.daysStale} days since last meaningful action · ${subtle} total`
              : `Joined ${row.daysStale} days ago · no meaningful action yet`}
          </p>
        </div>
        <LearningHint
          category="Team check · Pillar 2"
          title="Send check-in"
          whatItIs="Opens the NudgeModal — a structured way to send a single check-in message to a teammate whose task has been stale (4+ days without activity). Pre-populated with a suggested doorway-framed message you can edit. Sending writes a chain event so the §4 readout can later measure whether the nudge moved the work."
          why="Standing micromanagement corrodes the team; ignoring stalled work is irresponsible. The check-in is the middle path: ONE structured message at the right moment, framed as a doorway not a deadline. The chain event makes the §4 measurement possible — did nudges actually shift outcomes?"
          how="Click. Read the suggested message. Edit it to match your voice and your relationship with the person — the suggestion is a starting point, not a verdict. Aim for ≥12 chars. Send. The system tracks whether the task moves within a meaningful window."
          principle="The leader's job at this surface is to open doors, not push backs. The discipline is in the framing of the message."
        >
          <button
            type="button"
            onClick={onSendCheckIn}
            className="flex items-center gap-1.5 bg-ember-400 hover:bg-ember-500 text-[#09090B] font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors flex-shrink-0"
          >
            <MessageCircleQuestion className="w-3.5 h-3.5" aria-hidden />
            Send check-in
          </button>
        </LearningHint>
      </div>
      <div className="mt-2 p-3 rounded-lg bg-ember-400/[0.04] border border-ember-400/15">
        <p className="text-[10px] uppercase tracking-widest text-brand mb-1 flex items-center gap-1">
          <Sparkles className="w-3 h-3" aria-hidden />
          Suggested next step
        </p>
        <p className="text-xs text-primary leading-relaxed">
          {row.suggestedNextStep}
        </p>
      </div>
    </div>
  );
}

// ─── Nudge modal ───────────────────────────────────────────────

function NudgeModal({
  row,
  onClose,
  onSent,
}: {
  row: DigestRow;
  onClose: () => void;
  onSent: () => void;
}) {
  const [body, setBody] = useState(row.suggestedNextStep);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Min length is 12 chars (NudgeSchema in the route enforces
  // .min(12). Earlier message read "at least 12 characters" but
  // the check rejected length < 12, meaning 12 itself was the
  // floor. Aligning the message to the actual rule.
  const MIN_BODY_CHARS = 12;
  const submit = async () => {
    if (body.trim().length < MIN_BODY_CHARS) {
      setError(
        `Check-in message needs at least ${MIN_BODY_CHARS} characters — currently ${body.trim().length}.`
      );
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/admin/team-check/nudge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ taskId: row.taskId, body }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Send failed.");
      onSent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Send failed.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/70 backdrop-blur-sm">
      <div className="w-full max-w-lg glass-card p-5">
        <div className="flex items-start justify-between mb-3 gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-muted uppercase tracking-widest mb-0.5">
              Send check-in
            </p>
            <p className="text-sm text-primary truncate" title={`${row.userName} · ${row.taskTitle}`}>
              {row.userName} · {row.taskTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-secondary p-2 -m-2 rounded-md"
            aria-label="Close"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <p className="text-[11px] text-muted leading-relaxed mb-3">
          This posts as a system nudge into the task thread. It lands on the
          §3.1 chain as <code className="font-mono">task.nudge_sent</code>;
          the §4 readout will measure whether the nudge moved the work or
          not. Edit the suggested text to match your voice and relationship
          with {row.userName.split(" ")[0]}.
        </p>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          spellCheck
          autoComplete="off"
          placeholder="Open the conversation. Frame as a doorway, not a deadline."
          className="w-full bg-surface border border-default rounded-lg px-3 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 resize-none leading-relaxed"
        />
        <div className="flex items-center justify-between gap-2 mt-1">
          <p className="text-[10px] text-muted">
            Minimum {MIN_BODY_CHARS} characters.
          </p>
          <p
            className={`text-[10px] tabular-nums ${
              body.trim().length < MIN_BODY_CHARS ? "text-muted" : "text-emerald-400"
            }`}
          >
            {body.trim().length} / {MIN_BODY_CHARS}+
          </p>
        </div>
        {error && (
          <p className="text-[11px] text-red-400 mt-2" role="alert">
            {error}
          </p>
        )}
        <div className="flex items-center justify-end gap-2 mt-3">
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-muted hover:text-secondary px-3 py-2"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting || body.trim().length < MIN_BODY_CHARS}
            className="flex items-center gap-1.5 bg-ember-400 hover:bg-ember-500 disabled:opacity-40 text-[#09090B] font-semibold px-3 py-2 rounded-lg text-xs transition-colors"
          >
            {submitting ? "Sending…" : "Send check-in"}
          </button>
        </div>
      </div>
    </div>
  );
}
