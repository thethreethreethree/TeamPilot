"use client";

import { useEffect, useState } from "react";
import { Loader2, KeyRound, X, Plus, Trash2, Copy, Check } from "lucide-react";
import { validateStrongPassword, PASSWORD_POLICY_TEXT } from "@/lib/auth/passwordPolicy";

/**
 * Team passwords management (2026-08-21). Create/view/change/delete the titled shared credentials an admin hands
 * to new team members (the picked one is their first-login password). The secret is shown so the admin can
 * distribute it. All calls go to the admin-gated, service-role /api/team/passwords route.
 */

type TeamPassword = { id: string; title: string; secret: string; created_at: string };

export function TeamPasswordsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [list, setList] = useState<TeamPassword[] | null>(null);
  const [title, setTitle] = useState("");
  const [secret, setSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/team/passwords").catch(() => null);
    if (res && res.ok) setList((await res.json()).passwords ?? []);
    else setList([]);
  };

  useEffect(() => {
    if (!open) return;
    setTitle(""); setSecret(""); setError(null); setList(null);
    void load();
  }, [open]);

  if (!open) return null;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!title.trim()) { setError("Give the team password a title."); return; }
    const check = validateStrongPassword(secret);
    if (!check.ok) { setError(check.error); return; }
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/team/passwords", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), secret }),
      });
      if (!res.ok) { const j = await res.json().catch(() => null); setError(j?.error ?? "Couldn't create it."); return; }
      setTitle(""); setSecret("");
      await load();
    } catch { setError("Couldn't reach the server."); }
    finally { setBusy(false); }
  };

  const remove = async (id: string) => {
    setList((l) => (l ?? []).filter((p) => p.id !== id));
    const res = await fetch("/api/team/passwords", {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
    }).catch(() => null);
    if (!res || !res.ok) void load(); // restore true state on failure
  };

  const copy = async (p: TeamPassword) => {
    try { await navigator.clipboard.writeText(p.secret); setCopied(p.id); setTimeout(() => setCopied(null), 1500); } catch { /* clipboard blocked */ }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-brand" aria-hidden />
            <h2 className="text-sm font-semibold text-primary">Team passwords</h2>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-primary"><X className="w-4 h-4" aria-hidden /></button>
        </div>
        <p className="text-[11px] text-muted mb-4 leading-relaxed">
          A shared password you hand to a new team member. When you add them as a new user, this becomes their
          first-login password — they set their own right after. You can keep several (titled), change, or delete them.
        </p>

        {/* Create */}
        <form onSubmit={create} className="rounded-xl border border-white/10 bg-white/[0.02] p-3 mb-4 space-y-2">
          <div className="flex gap-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title (e.g. Sales Team)" maxLength={80}
              className="flex-1 rounded-lg bg-base border border-white/10 px-3 py-2 text-xs text-primary placeholder:text-muted" />
          </div>
          <div className="flex gap-2">
            <input value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Password" maxLength={200}
              className="flex-1 rounded-lg bg-base border border-white/10 px-3 py-2 text-xs font-mono text-primary placeholder:text-muted" />
            <button type="submit" disabled={busy}
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-ember-400 text-[#09090B] px-3 py-2 rounded-lg disabled:opacity-50 hover:bg-ember-300 transition-colors">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <Plus className="w-3.5 h-3.5" aria-hidden />}
              Create
            </button>
          </div>
          <p className="text-[10px] text-muted">{PASSWORD_POLICY_TEXT}</p>
          {error && <p className="text-[11px] text-rose-400">{error}</p>}
        </form>

        {/* List */}
        {list === null ? (
          <div className="flex items-center gap-2 text-[11px] text-muted py-6 justify-center"><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Loading…</div>
        ) : list.length === 0 ? (
          <p className="text-[11px] text-muted py-6 text-center">No team passwords yet — create one above.</p>
        ) : (
          <div className="rounded-xl border border-white/10 divide-y divide-default overflow-hidden">
            {list.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs text-primary truncate">{p.title}</p>
                  <p className="text-[11px] font-mono text-secondary truncate">{p.secret}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button type="button" onClick={() => void copy(p)} title="Copy password"
                    className="inline-flex items-center gap-1 text-[10px] text-secondary hover:text-primary border border-default rounded px-2 py-1 transition-colors">
                    {copied === p.id ? <Check className="w-3 h-3 text-emerald-400" aria-hidden /> : <Copy className="w-3 h-3" aria-hidden />}
                    {copied === p.id ? "Copied" : "Copy"}
                  </button>
                  <button type="button" onClick={() => void remove(p.id)} title="Delete"
                    className="text-muted hover:text-rose-400 border border-default hover:border-rose-400/40 rounded px-2 py-1 transition-colors">
                    <Trash2 className="w-3 h-3" aria-hidden />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
