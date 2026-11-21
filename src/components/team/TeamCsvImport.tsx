"use client";

import { useState } from "react";
import { FileUp, Loader2 } from "lucide-react";

/**
 * Team page → Import from a CSV (RSS Phase 9; Gong F2.8). Company admins only (the page shows it on amAdmin; the route
 * checks again). Choose a file → see what each row will do → Import. A file with any bad row imports nothing.
 */
type PlanRow = { line: number; email: string; person: "invite" | "member" | "pending" | "ambiguous"; role: string; manager: string; managerEmail: string | null };
type Result = { line: number; email: string; ok: boolean; result: string };

const PERSON: Record<PlanRow["person"], string> = {
  invite: "will be invited",
  member: "already on the team (role unchanged)",
  pending: "already has an invitation",
  ambiguous: "more than one account uses this email: add them on this page",
};
function managerWords(p: PlanRow): string {
  switch (p.manager) {
    case "set": return `reports to ${p.managerEmail}`;
    case "on_join": return `will report to ${p.managerEmail} when they join`;
    case "after_join": return `set their manager (${p.managerEmail}) here once they've joined`;
    case "not_found": return `${p.managerEmail} isn't on the team or in this file`;
    case "ambiguous": return `more than one account uses ${p.managerEmail}`;
    case "loop": return `${p.managerEmail} would create a reporting loop, so it's skipped`;
    default: return "";
  }
}

export function TeamCsvImport({ onDone }: { onDone: () => void | Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState<PlanRow[] | null>(null);
  const [errors, setErrors] = useState<Array<{ line: number; message: string }>>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [results, setResults] = useState<Result[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const send = async (text: string, apply: boolean) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/team/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ csv: text, apply }) });
      const j = (await r.json().catch(() => ({}))) as { plan?: PlanRow[] | null; errors?: Array<{ line: number; message: string }>; warnings?: string[]; results?: Result[]; error?: string };
      if (j.error) setMsg(j.error);
      setErrors(j.errors ?? []);
      setWarnings(j.warnings ?? []);
      setPlan(j.plan ?? null);
      if (apply && j.results) {
        setResults(j.results);
        await onDone();
      }
    } catch {
      setMsg("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const pick = async (f: File | undefined) => {
    setResults(null);
    setPlan(null);
    if (!f) return;
    if (f.size > 200_000) return setMsg("That file is too large.");
    const text = await f.text();
    setCsv(text);
    setName(f.name);
    await send(text, false);
  };

  const actions = plan ? plan.filter((p) => p.person === "invite" || p.manager === "set").length : 0; // on_join rides on its invite

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 text-xs text-brand hover:underline">
        <FileUp className="h-3.5 w-3.5" aria-hidden /> Import a team from a CSV file
      </button>
    );
  }
  return (
    <section className="glass-card space-y-3 p-4" aria-label="Import a team from a CSV file">
      <div className="flex items-start gap-2">
        <div>
          <h2 className="text-sm font-semibold text-primary">Import a team from a CSV file</h2>
          <p className="mt-1 text-xs text-secondary">
            Columns: <code>email</code> (required), <code>role</code>, <code>manager_email</code>. New people are invited, as if you
            invited each one; managers are set for people already on the team. You&apos;ll see what will happen before anything does.
          </p>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="ml-auto text-xs text-muted hover:text-primary">Close</button>
      </div>
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-default px-3 py-1.5 text-xs text-primary hover:bg-base">
        <FileUp className="h-3.5 w-3.5" aria-hidden /> {name || "Choose a CSV file"}
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} />
      </label>
      {busy && <p className="flex items-center gap-2 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Checking…</p>}
      {msg && <p className="text-xs text-secondary" role="status">{msg}</p>}
      {warnings.map((w) => <p key={w} className="text-xs text-muted">{w}</p>)}
      {errors.length > 0 && (
        <div className="text-xs" role="alert">
          <p className="text-primary">Fix these rows and choose the file again. Nothing has been imported.</p>
          <ul className="mt-1 space-y-0.5 text-secondary">{errors.map((e) => <li key={`${e.line}-${e.message}`}>Row {e.line}: {e.message}</li>)}</ul>
        </div>
      )}
      {plan && !results && (
        <div className="space-y-2">
          <ul className="space-y-1 text-xs">
            {plan.map((p) => (
              <li key={p.line} className="border-b border-default pb-1 last:border-b-0">
                <span className="text-primary">{p.email}</span> <span className="text-secondary">· {PERSON[p.person]}{p.person === "invite" ? ` as ${p.role}` : ""}</span>
                {managerWords(p) && <span className="block text-muted">{managerWords(p)}</span>}
              </li>
            ))}
          </ul>
          <button type="button" disabled={busy || actions === 0 || !csv} onClick={() => csv && void send(csv, true)}
            className="rounded-lg bg-ember-400 px-3 py-1.5 text-xs font-semibold text-ink-950 disabled:opacity-50">
            {actions === 0 ? "Nothing to do" : busy ? "Importing…" : `Import (${actions} change${actions === 1 ? "" : "s"})`}
          </button>
        </div>
      )}
      {results && (
        <div className="text-xs">
          <p className="text-primary">Done. New invitations are listed below with their links.</p>
          <ul className="mt-1 space-y-0.5">{results.map((r, i) => (
            <li key={`${r.line}-${i}`} className={r.ok ? "text-secondary" : "text-primary"}>{r.email}: {r.result}</li>
          ))}</ul>
        </div>
      )}
    </section>
  );
}
