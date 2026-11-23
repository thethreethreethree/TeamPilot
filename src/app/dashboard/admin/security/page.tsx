"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";

/**
 * Founders' inbox of public security reports (/security → 0312). Newest first; each report's status is the latest
 * event recorded on it ("received" until someone acts). Setting a status appends an event — reports are never edited.
 */
type Report = {
  id: string;
  reference: string;
  summary: string;
  details: string;
  affected: string | null;
  reporterName: string | null;
  reporterContact: string | null;
  receivedAt: string;
  status: string;
  note: string | null;
  statusAt: string | null;
};
const LABEL: Record<string, string> = { received: "New", triaged: "Looked at", fixed: "Fixed", not_an_issue: "Not an issue", duplicate: "Duplicate" };

export default function SecurityReportsPage() {
  const [reports, setReports] = useState<Report[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [notReady, setNotReady] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const r = await fetch("/api/admin/security-reports", { cache: "no-store" });
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { reports: Report[]; notReady?: string };
      setNotReady(j.notReady ?? null);
      setReports(j.reports);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const setStatus = async (reportId: string, status: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/admin/security-reports", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportId, status, note }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? "Couldn't save the status.");
      setNote("");
      setMsg(`Marked “${LABEL[status]}”.`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't save the status.");
    } finally {
      setBusy(false);
    }
  };

  const fresh = (reports ?? []).filter((r) => r.status === "received").length;

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <div>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-primary">
          <ShieldAlert className="h-5 w-5 text-brand" aria-hidden /> Security reports
        </h1>
        <p className="text-xs text-secondary">
          Sent from the public page elostate.com/security (linked from /.well-known/security.txt). Only founders see this.
        </p>
      </div>
      {msg && <p role="status" className="text-xs text-secondary">{msg}</p>}
      {failed ? (
        <p className="rounded-xl border border-default bg-surface p-4 text-xs text-muted">
          Couldn&apos;t load the security reports.{" "}
          <button type="button" onClick={() => void load()} className="underline">Try again</button>
        </p>
      ) : notReady ? (
        <p className="text-xs text-muted">{notReady}</p>
      ) : !reports ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted" aria-hidden />
      ) : reports.length === 0 ? (
        <p className="rounded-xl border border-default bg-surface p-4 text-xs text-secondary">No reports yet.</p>
      ) : (
        <>
          <p className="text-xs text-secondary">{fresh} new · {reports.length} in total</p>
          <ul className="space-y-2">
            {reports.map((r) => (
              <li key={r.id} className={`rounded-xl border bg-surface p-3 ${r.status === "received" ? "border-brand" : "border-default"}`}>
                <button type="button" onClick={() => setOpenId(openId === r.id ? null : r.id)} aria-expanded={openId === r.id} className="w-full text-left">
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-semibold text-primary">{r.summary}</span>
                    <span className="text-[11px] text-muted">
                      {r.reference} · {new Date(r.receivedAt).toLocaleString()} · {LABEL[r.status] ?? r.status}
                    </span>
                  </span>
                </button>
                {openId === r.id && (
                  <div className="mt-2 space-y-2 text-xs">
                    <p className="whitespace-pre-wrap text-secondary">{r.details}</p>
                    {r.affected && <p className="text-muted">Affected: {r.affected}</p>}
                    <p className="text-muted">
                      From: {r.reporterName ?? "no name"} · {r.reporterContact ?? "no contact left"}
                    </p>
                    {r.note && <p className="text-muted">Last note: {r.note}</p>}
                    <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} rows={2} placeholder="Note (optional) — what was done, a link, the original if a duplicate" aria-label="Note" className="w-full rounded-lg border border-default bg-base px-2 py-1 text-xs text-primary" />
                    <div className="flex flex-wrap gap-2">
                      {(["triaged", "fixed", "not_an_issue", "duplicate"] as const).map((s) => (
                        <button key={s} type="button" disabled={busy} onClick={() => void setStatus(r.id, s)} className="rounded-lg border border-default px-2.5 py-1 text-xs text-primary hover:border-brand/60 disabled:opacity-50">
                          {LABEL[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
