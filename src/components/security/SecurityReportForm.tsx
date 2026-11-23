"use client";

import { useState } from "react";

/** The public security-report form (/security; 2026-11-23, 0312). No account needed. */
const field = "w-full rounded-lg border border-default bg-surface px-3 py-2 text-sm text-primary";

export function SecurityReportForm() {
  const [f, setF] = useState({ summary: "", details: "", affected: "", name: "", contact: "", website: "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null | undefined>(undefined);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });

  if (done !== undefined) {
    return (
      <p role="status" className="rounded-xl border border-default bg-surface p-4 text-sm text-primary">
        Thank you — your report was received{done ? ` (reference ${done})` : ""}. The founders read every report. If you left a
        contact, we will reply there.
      </p>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        try {
          const r = await fetch("/api/security-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
          const j = (await r.json().catch(() => ({}))) as { error?: string; reference?: string | null };
          if (!r.ok) throw new Error(j.error ?? "Your report could not be sent. Please try again.");
          setDone(j.reference ?? null);
        } catch (x) {
          setErr(x instanceof Error ? x.message : "Your report could not be sent. Please try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="block text-xs text-secondary">
        Summary
        <input required minLength={5} maxLength={200} value={f.summary} onChange={set("summary")} className={field} placeholder="e.g. Another company's call list is readable at …" />
      </label>
      <label className="block text-xs text-secondary">
        What you found and how to reproduce it
        <textarea required minLength={20} maxLength={8000} rows={8} value={f.details} onChange={set("details")} className={field} placeholder="Steps, the request you sent, what came back, and why it matters." />
      </label>
      <label className="block text-xs text-secondary">
        Affected page or address (optional)
        <input maxLength={500} value={f.affected} onChange={set("affected")} className={field} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-secondary">
          Your name (optional)
          <input maxLength={100} value={f.name} onChange={set("name")} className={field} autoComplete="name" />
        </label>
        <label className="block text-xs text-secondary">
          How to reach you (optional)
          <input maxLength={200} value={f.contact} onChange={set("contact")} className={field} autoComplete="email" placeholder="Email or another way" />
        </label>
      </div>
      {/* A field people never see; bots fill it. */}
      <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={set("website")} className="hidden" name="website" />
      {err && (
        <p role="alert" className="text-sm text-amber-700 dark:text-amber-300">
          {err}
        </p>
      )}
      <button type="submit" disabled={busy} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-black disabled:opacity-60">
        {busy ? "Sending…" : "Send report"}
      </button>
    </form>
  );
}
