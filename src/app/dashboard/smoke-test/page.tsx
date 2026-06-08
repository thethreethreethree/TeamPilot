"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  HelpCircle,
  Loader2,
  ServerCog,
  Users,
  XCircle,
} from "lucide-react";
import TopBar from "@/components/layout/TopBar";
import { useToast } from "@/components/ui/toast";

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
    toast.success(
      status === "pass" ? "Marked pass" : status === "fail" ? "Marked fail" : "Marked unable"
    );
    void load();
  };

  return (
    <div className="min-h-screen bg-base">
      <TopBar title="Smoke test" subtitle="Verify the System against the published checklist" />
      <div className="p-6 max-w-3xl mx-auto space-y-6">
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
          <>
            <div className="glass-card p-5">
              <div className="flex items-center gap-2 mb-1">
                <ClipboardList className="w-4 h-4 text-brand" aria-hidden />
                <h2 className="text-sm font-semibold text-primary">
                  {version.label}
                </h2>
              </div>
              <p className="text-xs text-muted leading-relaxed">
                Walk each item. Mark pass, fail, or unable. Notes are
                required when marking fail or unable so the chain captures
                why (≥5 characters). Your results are private to you;
                admins see the aggregate.
              </p>
            </div>

            <div className="space-y-3">
              {version.items.map((item, i) => (
                <SmokeTestItemCard
                  key={item.id}
                  index={i + 1}
                  item={item}
                  result={results[item.id] ?? null}
                  onSubmit={(status, notes) => submitResult(item, status, notes)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SmokeTestItemCard({
  index,
  item,
  result,
  onSubmit,
}: {
  index: number;
  item: SmokeTestItem;
  result: SmokeTestResult | null;
  onSubmit: (status: "pass" | "fail" | "unable", notes: string) => void;
}) {
  const [notes, setNotes] = useState(result?.notes ?? "");
  const [pending, setPending] = useState<null | "pass" | "fail" | "unable">(null);

  const wrap = async (status: "pass" | "fail" | "unable") => {
    setPending(status);
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
                className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold text-[#C8232C] bg-[#C8232C]/10 border border-[#C8232C]/30 px-1.5 py-0.5 rounded-full"
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
          </div>
          <p className="text-sm font-semibold text-primary mb-1">{item.title}</p>
        </div>
      </div>

      {/* Partner-facing note: John-owned items don't require partner
          action, but partners should still SEE them on the record so
          they know coverage is happening across the board. */}
      {johnOwns && (
        <div className="mb-3 rounded-lg border border-[#C8232C]/25 bg-[#C8232C]/5 px-3 py-2">
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
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Notes (required for fail / unable; ≥5 chars)"
        className="w-full bg-surface border border-default rounded-lg px-3 py-2 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-[#C8232C]/50 focus:ring-1 focus:ring-[#C8232C]/30 resize-none mb-3"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={() => void wrap("pass")}
          disabled={pending !== null}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-500/40 hover:bg-emerald-500/10 text-emerald-300 disabled:opacity-40"
        >
          {pending === "pass" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
          )}
          Pass
        </button>
        <button
          onClick={() => void wrap("fail")}
          disabled={pending !== null}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-500/40 hover:bg-red-500/10 text-red-300 disabled:opacity-40"
        >
          {pending === "fail" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          ) : (
            <XCircle className="w-3.5 h-3.5" aria-hidden />
          )}
          Fail
        </button>
        <button
          onClick={() => void wrap("unable")}
          disabled={pending !== null}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-yellow-500/40 hover:bg-yellow-500/10 text-accent-text disabled:opacity-40"
        >
          {pending === "unable" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
          ) : (
            <AlertCircle className="w-3.5 h-3.5" aria-hidden />
          )}
          Unable
        </button>
      </div>
    </div>
  );
}
