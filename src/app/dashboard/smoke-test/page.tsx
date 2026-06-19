"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  HelpCircle,
  Loader2,
  ServerCog,
  Trophy,
  Users,
  XCircle,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { LearningHint } from "@/components/learning/LearningHint";
import { useToast } from "@/components/ui/toast";
import { MentionInput, type MentionMember } from "@/components/ui/MentionInput";
import { fetchTeam } from "@/lib/data/team";
import { CoachPanelV5 } from "@/components/chats/CoachPanelV5";
import { AskCoachButton } from "@/components/chats/AskCoachButton";
import type { CoachContextPayload } from "@/lib/coach/v5/types";
import { useCoachEnabled } from "@/lib/coach/useCoachEnabled";
import { hapticSend, hapticSuccess } from "@/lib/pwa/haptics";

/**
 * /dashboard/smoke-test
 *
 * Tester-facing checklist surface. Shows the active version published
 * by an admin, plus this tester's own results against each item.
 * Per the user's design choice, each tester's results are stored in
 * separate rows so multiple testers don't overwrite each other.
 *
 * Each submission emits a smoke_test.{pass,fail,unable} event into
 * the §3.1 chain. Fail and unable derive `user_friction` and
 * `test_unreachable` signals respectively (0018 signal_sources).
 */

type SmokeTestAssignee = "john" | "partners";

type SmokeTestItem = {
  id: string;
  title: string;
  instructions: string;
  expected: string;
  reference_image_url?: string;
  /** Who owns verifying this item. "john" = backend / infra surface
   *  (Supabase, Vercel, chain inspection, LLM config) the owner handles
   *  personally; partners observe but no action needed. "partners" =
   *  UI / functional / observable behavior testers can verify end-to-end
   *  without backend access. Defaults to "partners" when unset. */
  assignee?: SmokeTestAssignee;
  /** Structural priority flag. When true, this item verifies a load-
   *  bearing structural component of the system (chain integrity,
   *  Understanding Gate, guide-don't-overtake enforcement, append-
   *  only invariants, the Task Spawn lineage, etc.). The page renders
   *  the anvil badge next to the title so testers can scan which
   *  items the §1.7 audit considers foundational. */
  structural?: boolean;
};

type SmokeTestVersion = {
  id: string;
  label: string;
  items: SmokeTestItem[];
  created_at: string;
};

type SmokeTestResult = {
  id: string;
  item_id: string;
  status: "pass" | "fail" | "unable";
  notes: string;
  feedback_id: string | null;
  created_at: string;
};

type ItemState = SmokeTestResult | null;

export default function SmokeTestPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [version, setVersion] = useState<SmokeTestVersion | null>(null);
  const [results, setResults] = useState<Record<string, ItemState>>({});
  const [members, setMembers] = useState<MentionMember[]>([]);

  // Roster for @-tagging in the notes field. Fetched once on mount.
  useEffect(() => {
    let cancelled = false;
    void fetchTeam().then((snap) => {
      if (cancelled) return;
      setMembers(
        snap.members
          .filter((m) => m.status === "active" && m.fullName)
          .map((m) => ({ id: m.id, fullName: m.fullName as string }))
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/smoke-test/active");
      if (!res.ok) {
        toast.error("Couldn't load checklist");
        return;
      }
      const data = (await res.json()) as {
        version: SmokeTestVersion | null;
        myResults: Record<string, SmokeTestResult>;
      };
      setVersion(data.version);
      setResults(data.myResults);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submitResult = async (
    item: SmokeTestItem,
    status: "pass" | "fail" | "unable",
    notes: string
  ) => {
    if (!version) return;
    if ((status === "fail" || status === "unable") && notes.trim().length < 5) {
      toast.warn(
        "Notes required",
        "≥5 chars so the chain captures real substance."
      );
      return;
    }
    const res = await fetch("/api/smoke-test/result", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version_id: version.id,
        item_id: item.id,
        status,
        notes,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error("Submit failed", data.error ?? `HTTP ${res.status}`);
      return;
    }
    // Coach v2 mirror (A11) — log per-heuristic observations on the
    // submitted note so the next note's mirror chip has fresh counts.
    if (notes && notes.trim().length >= 6) {
      void import("@/lib/coach/observe").then(({ observePatterns }) =>
        observePatterns({
          subject: `smoke_test_result:draft:${item.id}`,
          bodyText: notes,
        })
      );
    }
    toast.success(
      status === "pass" ? "Marked pass" : status === "fail" ? "Marked fail" : "Marked unable"
    );
    void load();
  };

  return (
    <div className="min-h-screen bg-base">
      <TopBar title="Smoke test" subtitle="Verify the System against the published checklist" />
      <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
        {loading && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted py-10">
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Loading
            checklist…
          </div>
        )}

        {!loading && !version && (
          <div className="glass-card p-6 text-center">
            <ClipboardList className="w-6 h-6 text-muted mx-auto mb-2" aria-hidden />
            <p className="text-sm text-primary mb-1">No checklist published yet.</p>
            <p className="text-xs text-muted max-w-md mx-auto leading-relaxed">
              An admin hasn&apos;t published an active smoke test for your
              company. Check back when one is available, or use the feedback
              button at any time to leave a note.
            </p>
          </div>
        )}

        {!loading && version && (
          <SmokeTestList
            version={version}
            results={results}
            members={members}
            onSubmitResult={submitResult}
          />
        )}
      </div>
    </div>
  );
}

/**
 * SmokeTestList — splits the version's items into two buckets based on
 * whether the current tester has already submitted a result against
 * each item.
 *
 * Pending list = items the tester hasn't acted on yet. Rendered up top,
 * the active work surface.
 *
 * Completed list = items the tester has already marked pass/fail/unable.
 * Moved into a collapsed section below so the active list stays focused
 * on what the tester still needs to do. The completed bucket is still
 * accessible — clicking the header expands it — so the tester can
 * revisit and re-submit a result if they need to.
 *
 * The split is purely a UI organization layer. The data model is
 * unchanged: a result row still exists per (item, tester) and the
 * latest one wins. Resetting a result by re-submitting a different
 * status moves the item back to the appropriate bucket on next render.
 */
function SmokeTestList({
  version,
  results,
  members,
  onSubmitResult,
}: {
  version: SmokeTestVersion;
  results: Record<string, ItemState>;
  members: ReadonlyArray<MentionMember>;
  onSubmitResult: (
    item: SmokeTestItem,
    status: "pass" | "fail" | "unable",
    notes: string
  ) => Promise<void> | void;
}) {
  const [completedExpanded, setCompletedExpanded] = useState(false);

  const { pending, completed } = useMemo(() => {
    const p: Array<{ item: SmokeTestItem; originalIndex: number }> = [];
    const c: Array<{ item: SmokeTestItem; originalIndex: number }> = [];
    version.items.forEach((item, i) => {
      const r = results[item.id] ?? null;
      if (r) {
        c.push({ item, originalIndex: i });
      } else {
        p.push({ item, originalIndex: i });
      }
    });
    return { pending: p, completed: c };
  }, [version.items, results]);

  const totalCount = version.items.length;
  const completedCount = completed.length;
  const allDone = completedCount === totalCount && totalCount > 0;

  return (
    <>
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <ClipboardList className="w-4 h-4 text-brand" aria-hidden />
          <h2 className="text-sm font-semibold text-primary">{version.label}</h2>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          Walk each item. Mark pass, fail, or unable. Notes are required when
          marking fail or unable so the chain captures why (≥5 characters).
          Type <kbd className="font-mono text-brand">@</kbd> to tag a teammate
          inside a note. Your results are private to you; admins see the
          aggregate.
        </p>
        {/* Progress strip — shows the tester their progress at a glance.
            When everything's done, the strip becomes a small congratulatory
            note rather than a dry "N of N" — small piece of the third
            Coach contract (encourage growth) carried into smoke testing. */}
        <div className="mt-3 flex items-center gap-2 text-[11px]">
          {allDone ? (
            <>
              <Trophy className="w-3.5 h-3.5 text-emerald-300" aria-hidden />
              <span className="text-emerald-300">
                All {totalCount} items completed. Nice work.
              </span>
            </>
          ) : (
            <>
              <span className="text-muted">
                {completedCount} of {totalCount} completed
              </span>
              <div
                className="flex-1 max-w-xs h-1.5 rounded-full bg-surface overflow-hidden"
                role="progressbar"
                aria-valuenow={completedCount}
                aria-valuemin={0}
                aria-valuemax={totalCount}
              >
                <div
                  className="h-full bg-ember-400 transition-all duration-300"
                  style={{
                    width: totalCount > 0 ? `${(completedCount / totalCount) * 100}%` : "0%",
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Pending bucket — the active work surface. Renders empty state
          when the tester has cleared them all. */}
      {pending.length > 0 ? (
        <div className="space-y-3">
          {pending.map(({ item, originalIndex }) => (
            <SmokeTestItemCard
              key={item.id}
              index={originalIndex + 1}
              item={item}
              result={null}
              members={members}
              onSubmit={(status, notes) => onSubmitResult(item, status, notes)}
            />
          ))}
        </div>
      ) : completedCount > 0 ? (
        <div className="glass-card p-6 text-center">
          <Trophy className="w-6 h-6 text-emerald-300 mx-auto mb-2" aria-hidden />
          <p className="text-sm text-primary font-medium">
            You&apos;ve worked through every item in this version.
          </p>
          <p className="text-xs text-muted mt-1">
            Completed tests are tucked into the section below — you can
            still re-open any of them to revise a result.
          </p>
        </div>
      ) : null}

      {/* Completed bucket — collapsible. Closed by default while there's
          still pending work so the active list stays uncluttered; opens
          automatically when the tester finishes everything (no pending
          left) so they can scan what they did. */}
      {completed.length > 0 && (
        <div className="glass-card p-4">
          <button
            type="button"
            onClick={() => setCompletedExpanded((v) => !v)}
            aria-expanded={completedExpanded || allDone}
            className="w-full flex items-center justify-between gap-2 text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              {completedExpanded || allDone ? (
                <ChevronDown className="w-4 h-4 text-muted flex-shrink-0" aria-hidden />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" aria-hidden />
              )}
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" aria-hidden />
              <h3 className="text-sm font-semibold text-primary truncate">
                Completed Smoke Tests
              </h3>
              <span className="text-[10px] text-muted font-mono flex-shrink-0">
                ({completedCount})
              </span>
            </div>
          </button>
          {(completedExpanded || allDone) && (
            <div className="mt-3 space-y-3">
              {completed.map(({ item, originalIndex }) => (
                <SmokeTestItemCard
                  key={item.id}
                  index={originalIndex + 1}
                  item={item}
                  result={results[item.id] ?? null}
                  members={members}
                  onSubmit={(status, notes) => onSubmitResult(item, status, notes)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}

function SmokeTestItemCard({
  index,
  item,
  result,
  members,
  onSubmit,
}: {
  index: number;
  item: SmokeTestItem;
  result: SmokeTestResult | null;
  members: ReadonlyArray<MentionMember>;
  onSubmit: (status: "pass" | "fail" | "unable", notes: string) => void;
}) {
  const [notes, setNotes] = useState(result?.notes ?? "");
  // Coach v5 Ask-Coach token for the smoke-test note composer.
  const [askCoachToken, setAskCoachToken] = useState(0);
  // Coach v5 contextPayload — passes the item title so the Coach knows
  // what the user is testing when reading the note.
  const coachV5Payload = useMemo<CoachContextPayload>(
    () => ({ smokeTestItemTitle: item.title }),
    [item.title]
  );
  const [pending, setPending] = useState<null | "pass" | "fail" | "unable">(null);
  const { enabled: coachEnabled } = useCoachEnabled();

  const wrap = async (status: "pass" | "fail" | "unable") => {
    setPending(status);
    // Phase 5.3 — haptic on submit. Pass = success pulse (celebration
    // for the green path); fail / unable = standard send tap (action
    // landed, but not a celebration). Tactile distinction matches
    // the emotional tone of the result.
    if (status === "pass") hapticSuccess();
    else hapticSend();
    try {
      await onSubmit(status, notes);
    } finally {
      setPending(null);
    }
  };

  const statusBadge = result ? (
    result.status === "pass" ? (
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-emerald-300">
        <CheckCircle2 className="w-3 h-3" aria-hidden /> passed
      </span>
    ) : result.status === "fail" ? (
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-red-300">
        <XCircle className="w-3 h-3" aria-hidden /> failed
      </span>
    ) : (
      <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-accent-text">
        <AlertCircle className="w-3 h-3" aria-hidden /> unable
      </span>
    )
  ) : (
    <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-muted">
      <HelpCircle className="w-3 h-3" aria-hidden /> untested
    </span>
  );

  // Assignee defaults to "partners" so legacy items (no field set)
  // behave the same as items explicitly tagged for the wider team.
  const assignee: SmokeTestAssignee = item.assignee ?? "partners";
  const johnOwns = assignee === "john";

  return (
    <div className="glass-card p-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-mono text-muted">
              #{String(index).padStart(2, "0")}
            </span>
            {statusBadge}
            {johnOwns ? (
              <span
                className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-ember-400 bg-ember-400/10 border border-ember-400/30 px-1.5 py-0.5 rounded-full"
                title="Backend / infra item — John handles this verification personally"
              >
                <ServerCog className="w-3 h-3" aria-hidden /> John
              </span>
            ) : (
              <span
                className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-arc-300 bg-arc-400/10 border border-arc-400/30 px-1.5 py-0.5 rounded-full"
                title="Partners run this verification end-to-end"
              >
                <Users className="w-3 h-3" aria-hidden /> Partners
              </span>
            )}
            {item.structural && (
              <span
                className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-ember-400 bg-ember-400/10 border border-ember-400/30 px-1.5 py-0.5 rounded-full"
                title="Structural-priority test — foundational. A failure here propagates upward through every layer above it."
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/anvil-structural.png"
                  srcSet="/anvil-structural.png 1x, /anvil-structural@2x.png 2x"
                  alt=""
                  width={10}
                  height={10}
                  aria-hidden
                />
                Structural
              </span>
            )}
          </div>
          <p className="text-sm font-semibold text-primary mb-1">{item.title}</p>
        </div>
      </div>

      {/* Partner-facing note: John-owned items don't require partner
          action, but partners should still SEE them on the record so
          they know coverage is happening across the board. */}
      {johnOwns && (
        <div className="mb-3 rounded-lg border border-ember-400/25 bg-ember-400/5 px-3 py-2">
          <p className="text-[11px] text-secondary leading-relaxed">
            <ServerCog
              className="inline w-3 h-3 text-brand mr-1 -mt-0.5"
              aria-hidden
            />
            <span className="font-semibold text-brand">
              Backend test — John handles this.
            </span>{" "}
            Partners don&apos;t have Supabase / Vercel access, so this one
            isn&apos;t your action item. You can still submit a result if
            you observe something worth noting.
          </p>
        </div>
      )}

      <div className="text-xs text-secondary leading-relaxed space-y-1.5 mb-3">
        <p>
          <span className="text-muted font-mono">Steps:</span> {item.instructions}
        </p>
        <p>
          <span className="text-muted font-mono">Expected:</span> {item.expected}
        </p>
      </div>
      <div className="mb-3">
        {/* Coach v1.1 — surfaces in smoke-test notes when company-
            level coach_enabled is true. Subject is `smoke_test_result:
            draft` (no row id yet). The §4 readout buckets by surface
            prefix so smoke test notes attribute cleanly. */}
        {coachEnabled && (
          <>
            <CoachPanelV5
              draft={notes}
              contextType="smoke_test_note"
              contextPayload={coachV5Payload}
              askCoachToken={askCoachToken}
              onAcceptRevision={(revised) => setNotes(revised)}
            />
            <div className="mb-2 flex justify-end">
              <AskCoachButton
                disabled={!notes.trim()}
                onAsk={() => setAskCoachToken((t) => t + 1)}
              />
            </div>
          </>
        )}
        <MentionInput
          value={notes}
          onChange={setNotes}
          members={members}
          rows={2}
          placeholder="Notes (required for fail / unable; ≥5 chars) — type @ to tag a teammate"
          className="w-full bg-surface border border-default rounded-lg px-3 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-ember-400/50 focus:ring-1 focus:ring-ember-400/30 resize-none"
        />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <LearningHint
          category="Smoke test · Verdict"
          title="Pass"
          whatItIs="Marks this checklist item as verified — the team confirmed the behavior works as documented. Writes a chain event with your user ID + timestamp so the audit trail records WHO verified what, WHEN."
          why="Pilot acceptance is the single moment where claims trade for evidence. Without recorded passes the team could say 'we tested it' but couldn't prove which items, by whom, when. Pass + the audit trail IS the proof."
          how="Click only after you've actually performed the verification described in the checklist row. Notes are optional on pass but a sentence about what you confirmed compounds the audit value."
          principle="Pass is a recorded act of verification, not a checkbox. The chain event is the structural defense against retroactive 'we tested it' claims."
        >
          <button
            type="button"
            onClick={() => void wrap("pass")}
            disabled={pending !== null}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-300 disabled:opacity-40"
          >
            {pending === "pass" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
            )}
            Pass
          </button>
        </LearningHint>
        <LearningHint
          category="Smoke test · Verdict"
          title="Fail"
          whatItIs="Marks this checklist item as failed — the team verified the behavior does NOT work as documented. Requires a note explaining WHAT failed and HOW the actual behavior differs from documented. The note lands on the admin's Feedback inbox for triage."
          why="Fails are the most valuable smoke-test signal — they surface real product gaps before customers hit them. Notes are required because 'fail' without context can't be triaged; the next admin needs to see WHAT failed to know whether to fix product, fix docs, or correct the checklist."
          how="Click. Write a specific note: what step you performed, what the docs said would happen, what actually happened. The note becomes the feedback row's body; admins triage it from /dashboard/admin/feedback."
          principle="A fail without a note is unactionable. The note requirement is structural triage routing."
        >
          <button
            type="button"
            onClick={() => void wrap("fail")}
            disabled={pending !== null}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-red-500/40 hover:bg-red-500/10 text-red-300 disabled:opacity-40"
          >
            {pending === "fail" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            ) : (
              <XCircle className="w-3.5 h-3.5" aria-hidden />
            )}
            Fail
          </button>
        </LearningHint>
        <LearningHint
          category="Smoke test · Verdict"
          title="Unable"
          whatItIs="Marks this checklist item as NOT verifiable in the current state — usually because a precondition isn't in place (no data yet, feature gated by something else, environment-specific). Requires a note explaining the precondition."
          why="Unable is the third honest verdict. Without it, testers would either skip rows (silent gap) or mark them as fail (misleading triage). Unable preserves the honest 'we couldn't verify this yet' state with the reason captured."
          how="Click when you can't actually run the verification. Write a note explaining what's missing — 'needs at least 3 customers in trial state', 'requires Stripe live mode on', etc. The admin reviewing decides whether to update the checklist precondition or unblock the path."
          principle="Three states honest the actual verification surface: passed, failed, couldn't-yet. Forcing pass/fail erases the third real state."
        >
          <button
            type="button"
            onClick={() => void wrap("unable")}
            disabled={pending !== null}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-yellow-500/40 hover:bg-yellow-500/10 text-accent-text disabled:opacity-40"
          >
            {pending === "unable" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
            ) : (
              <AlertCircle className="w-3.5 h-3.5" aria-hidden />
            )}
            Unable
          </button>
        </LearningHint>
      </div>
    </div>
  );
}
