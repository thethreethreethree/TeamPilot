"use client";

import { useCallback, useEffect, useState } from "react";
import { ListChecks, Trash2 } from "lucide-react";

/**
 * Brief templates for managers (2026-11-26, Gong F13.2; migration 0364): write the questions a call should answer, each
 * with optional instructions; retire one that's no longer wanted. A template never changes — retire it and write a new
 * one — so a stored answer always names the questions it answered. Anyone on the team runs them from a call's page.
 * Renders nothing for someone who can't manage templates.
 */
type Template = { id: string; name: string; sections: Array<{ question: string; instructions: string }> };
const input = "w-full rounded-lg border border-default bg-base px-2 py-1.5 text-xs text-primary";

export function BriefTemplatesManager() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [canManage, setCanManage] = useState(false);
  const [failed, setFailed] = useState(false);
  const [editing, setEditing] = useState<{ name: string; sections: Array<{ question: string; instructions: string }> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/coach/remote/brief-templates");
      if (!r.ok) throw new Error(String(r.status));
      const j = (await r.json()) as { available?: boolean; canManage?: boolean; templates?: Template[] };
      setTemplates(j.available ? (j.templates ?? []) : []);
      setCanManage(j.canManage === true);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  if (failed && !templates) return <p className="rounded-2xl border border-default bg-surface p-4 text-xs text-muted">Couldn&apos;t load brief templates.</p>;
  if (!templates || !canManage) return null;
  const send = async (method: string, body: unknown, ok: string) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await fetch("/api/coach/remote/brief-templates", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) {
        setMsg(j.error ?? "That didn't save.");
        return false;
      }
      setMsg(ok);
      await load();
      return true;
    } catch {
      setMsg("Couldn't reach the server.");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const setSection = (i: number, patch: Partial<{ question: string; instructions: string }>) =>
    editing && setEditing({ ...editing, sections: editing.sections.map((s, k) => (k === i ? { ...s, ...patch } : s)) });

  return (
    <section className="rounded-2xl border border-default bg-surface p-4 space-y-2" aria-label="Brief templates">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-primary"><ListChecks className="h-4 w-4 text-brand" aria-hidden /> Brief templates</h2>
        {!editing && (
          <button type="button" onClick={() => setEditing({ name: "", sections: [{ question: "", instructions: "" }] })} className="rounded-lg border border-default px-2 py-1 text-xs text-secondary hover:text-primary">
            New template
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted">Questions anyone on the team can have answered from a call — on the call&apos;s page, under Briefs. Each answer shows the lines it comes from.</p>
      {msg && <p role="status" className="text-xs text-secondary">{msg}</p>}
      {editing && (
        <div className="space-y-2 rounded-xl border border-default p-3" aria-label="New brief template">
          <label className="block text-[11px] text-muted">Name<input value={editing.name} maxLength={60} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={input} /></label>
          <ol className="space-y-2">
            {editing.sections.map((s, i) => (
              <li key={i} className="space-y-1 rounded-lg border border-default p-2">
                <div className="flex items-center gap-1">
                  <span className="w-5 text-[11px] text-muted">{i + 1}</span>
                  <input aria-label={`Question ${i + 1}`} placeholder="e.g. What budget did they mention?" value={s.question} maxLength={200} onChange={(e) => setSection(i, { question: e.target.value })} className={input} />
                  <button type="button" aria-label={`Remove question ${i + 1}`} disabled={editing.sections.length === 1} onClick={() => setEditing({ ...editing, sections: editing.sections.filter((_, k) => k !== i) })} className="p-1 text-muted disabled:opacity-30"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
                <input aria-label={`Question ${i + 1} instructions`} placeholder="Instructions (optional), e.g. give a number if they said one" value={s.instructions} maxLength={600} onChange={(e) => setSection(i, { instructions: e.target.value })} className={input} />
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={editing.sections.length >= 8} onClick={() => setEditing({ ...editing, sections: [...editing.sections, { question: "", instructions: "" }] })} className="rounded-lg border border-default px-2 py-1 text-xs text-secondary">Add question</button>
            <button
              type="button"
              disabled={busy || !editing.name.trim() || editing.sections.some((s) => !s.question.trim())}
              onClick={async () => {
                if (await send("POST", { name: editing.name, sections: editing.sections }, "Saved. It's under Briefs on every phone and video call's page.")) setEditing(null);
              }}
              className="rounded-lg bg-ember-400 px-3 py-1 text-xs font-semibold text-ink-950 disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save template"}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-lg px-2 py-1 text-xs text-muted">Cancel</button>
          </div>
        </div>
      )}
      {templates.length === 0 && !editing && <p className="text-xs text-muted">No templates yet.</p>}
      <ul className="space-y-1.5">
        {templates.map((t) => (
          <li key={t.id} className="rounded-lg border border-default p-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-primary">{t.name}</span>
              <span className="text-muted">{t.sections.length} question{t.sections.length === 1 ? "" : "s"}</span>
              <span className="ml-auto flex gap-2">
                <button type="button" onClick={() => setEditing({ name: t.name, sections: t.sections.map((s) => ({ ...s })) })} className="text-secondary hover:text-primary" title="Start a new template from this one">Copy</button>
                <button type="button" disabled={busy} onClick={() => { if (window.confirm(`Retire “${t.name}”? Answers already given keep it; it can't be run again.`)) void send("PATCH", { id: t.id, retire: true }, "Retired."); }} className="text-muted hover:text-primary">Retire</button>
              </span>
            </div>
            <ol className="mt-1 list-decimal pl-5 text-secondary">
              {t.sections.map((s, i) => (
                <li key={i}>{s.question}</li>
              ))}
            </ol>
          </li>
        ))}
      </ul>
    </section>
  );
}
