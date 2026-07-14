"use client";

import { useEffect, useState, useCallback } from "react";
import TopBar from "@/components/layout/TopBar";
import FinanceNav from "@/components/finance/FinanceNav";
import { useToast } from "@/components/ui/toast";
import { ShieldCheck, XCircle, CheckCircle2, RefreshCw } from "lucide-react";

/**
 * Ledger integrity.
 *
 * THE PAGE MUST NEVER SHOW GREEN WHEN IT DOES NOT KNOW.
 *
 * That sounds obvious and it is the entire reason this page exists. Every company has backups; almost none
 * can tell you whether a restore actually worked. The failure is never "the backup was missing" — it is
 * that the restore ran, the app came up, everyone exhaled, and the ledger came back subtly wrong. Nothing
 * announces it. The pages render. The numbers look like numbers.
 *
 * So a check that could not RUN is rendered as loudly as a check that FAILED. An unverified ledger is not a
 * healthy ledger — it is an unknown one, and on this screen those must never look the same.
 */

type Check = { check_name: string; passed: boolean; detail: string };

export default function IntegrityPage() {
  const toast = useToast();
  const [checks, setChecks] = useState<Check[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const run = useCallback(async () => {
    setBusy(true);
    try {
      const res = await fetch("/api/finance/integrity");
      const j = await res.json();
      if (!res.ok || j.error) {
        setChecks(null);
        setError(j.error ?? "The integrity check could not run.");
        return;
      }
      setError(null);
      setChecks(j.checks ?? []);
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    run().catch(() => setError("The integrity check could not run."));
  }, [run]);

  const failed = (checks ?? []).filter((c) => !c.passed);
  const allPass = checks != null && checks.length > 0 && failed.length === 0;

  return (
    <>
      <TopBar title="Ledger integrity" />
      <FinanceNav />
      <main className="mx-auto max-w-3xl px-4 py-6 space-y-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ShieldCheck size={18} /> Is the ledger sound?
            </h2>
            <p className="mt-1 text-sm text-neutral-600">
              Run this after restoring a backup, and on a schedule. Every check below asserts something that
              should be <strong>impossible</strong> — the database already enforces it. If one fails,
              something has bypassed those guarantees, and you want to know today rather than at year-end.
            </p>
          </div>
          <button
            onClick={() => {
              run().then(() => toast.success("Integrity check complete"));
            }}
            disabled={busy}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-neutral-300 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            <RefreshCw size={14} className={busy ? "animate-spin" : ""} /> Re-run
          </button>
        </div>

        {/* A check that could not RUN is not a check that PASSED. Rendered as loudly as a failure. */}
        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            <strong>The integrity check could not run.</strong> {error}
            <p className="mt-1">
              This is <strong>not</strong> a pass. An unverified ledger is not a healthy ledger — it is an
              unknown one.
            </p>
          </div>
        )}

        {failed.length > 0 && (
          <div className="rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800">
            <div className="font-semibold">
              {failed.length} {failed.length === 1 ? "check has" : "checks have"} failed. Do not trade on
              this ledger.
            </div>
            <p className="mt-1">
              Restore an earlier snapshot and check again. <strong>Do not post a balancing entry</strong> to
              make this page go green — that would make the <em>check</em> pass while leaving the corruption
              in place, which is the worst outcome available: an invisible problem wearing a green tick.
            </p>
          </div>
        )}

        {allPass && (
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
            <div className="font-semibold">All {checks!.length} checks pass.</div>
            <p className="mt-1">
              The trial balance balances, every entry balances on its own, no lines are orphaned, closed
              periods are untouched, and the audit trail is intact.
            </p>
          </div>
        )}

        <ul className="space-y-2">
          {(checks ?? []).map((c) => (
            <li
              key={c.check_name}
              className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                c.passed ? "border-neutral-200" : "border-red-300 bg-red-50"
              }`}
            >
              {c.passed ? (
                <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
              ) : (
                <XCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
              )}
              <div>
                <div className={`font-medium ${c.passed ? "" : "text-red-800"}`}>{c.check_name}</div>
                {/* The database wrote this sentence, and it names the consequence, not just the fault. */}
                <p className={`mt-0.5 text-xs ${c.passed ? "text-neutral-600" : "text-red-800"}`}>
                  {c.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}
