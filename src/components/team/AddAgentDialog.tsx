"use client";

import { useEffect, useState } from "react";
import { Loader2, UserPlus, X, KeyRound, Mail } from "lucide-react";

/**
 * Streamlined "Add agent" (2026-08-21). Two paths, no manual invite link:
 *   - Existing: the email already has an Elostate / Sales Coach account → added to the team immediately.
 *   - New: brand-new person → created with a picked TEAM PASSWORD; they set their own password on first login.
 * Optionally grants a Sales Coach role at add time (so it's one step, not two). POSTs /api/team/add-member.
 */

type TeamPassword = { id: string; title: string; secret: string; created_at: string };
type CoachRole = "staff" | "admin" | null;

export function AddAgentDialog({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: (msg: string) => void }) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [email, setEmail] = useState("");
  const [coachRole, setCoachRole] = useState<CoachRole>("staff");
  const [passwords, setPasswords] = useState<TeamPassword[] | null>(null);
  const [teamPasswordId, setTeamPasswordId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setEmail(""); setError(null); setMode("existing"); setCoachRole("staff");
    // Load team passwords (for the "new user" path picker).
    void (async () => {
      const res = await fetch("/api/team/passwords").catch(() => null);
      if (res && res.ok) {
        const d = await res.json();
        const list: TeamPassword[] = d.passwords ?? [];
        setPasswords(list);
        setTeamPasswordId(list[0]?.id ?? "");
      } else setPasswords([]);
    })();
  }, [open]);

  if (!open) return null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const addr = email.trim();
    if (!addr || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) { setError("Enter a valid email address."); return; }
    if (mode === "new" && !teamPasswordId) { setError("Create or pick a team password first."); return; }
    setBusy(true); setError(null);
    try {
      const payload = mode === "new"
        ? { mode: "new", email: addr, teamPasswordId, salesCoachRole: coachRole }
        : { mode: "existing", email: addr, salesCoachRole: coachRole };
      const res = await fetch("/api/team/add-member", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      if (!res.ok) { const j = await res.json().catch(() => null); setError(j?.error ?? "Couldn't add that member."); return; }
      onAdded(mode === "new"
        ? `${addr} was added. Share the team password with them — they'll set their own on first login.`
        : `${addr} was added to the team.`);
      onClose();
    } catch { setError("Couldn't reach the server."); }
    finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-brand" aria-hidden />
            <h2 className="text-sm font-semibold text-primary">Add agent</h2>
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-primary"><X className="w-4 h-4" aria-hidden /></button>
        </div>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-white/[0.03] border border-white/10 mb-4">
          {([["existing", "Existing user"], ["new", "New user"]] as const).map(([v, label]) => (
            <button key={v} type="button" onClick={() => { setMode(v); setError(null); }}
              className={`text-xs font-medium py-1.5 rounded-md transition-colors ${mode === v ? "bg-ember-400 text-[#09090B]" : "text-secondary hover:text-primary"}`}>
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-secondary mb-1">Email</label>
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden />
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" autoFocus placeholder="person@company.com"
                className="w-full rounded-lg bg-base border border-white/10 pl-8 pr-3 py-2 text-xs text-primary placeholder:text-muted" />
            </div>
            <p className="text-[10px] text-muted mt-1">
              {mode === "existing"
                ? "They already have an Elostate / Sales Coach account — they're added to the team right away."
                : "No account yet — they'll be created with the team password below and set their own on first login."}
            </p>
          </div>

          {mode === "new" && (
            <div>
              <label className="block text-[11px] font-medium text-secondary mb-1">Team password (their first login)</label>
              {passwords === null ? (
                <div className="flex items-center gap-2 text-[11px] text-muted py-2"><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Loading…</div>
              ) : passwords.length === 0 ? (
                <p className="text-[11px] text-amber-300 bg-amber-400/10 border border-amber-400/30 rounded-lg px-2.5 py-2">
                  No team password yet — create one with <span className="font-semibold">Team passwords</span> first, then add the user.
                </p>
              ) : (
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" aria-hidden />
                  <select value={teamPasswordId} onChange={(e) => setTeamPasswordId(e.target.value)}
                    className="w-full appearance-none rounded-lg bg-base border border-white/10 pl-8 pr-3 py-2 text-xs text-primary">
                    {passwords.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
                  </select>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-secondary mb-1">Sales Coach access</label>
            <div className="flex items-center gap-1.5">
              {([[null, "None"], ["staff", "Staff"], ["admin", "Admin"]] as const).map(([v, label]) => (
                <button key={String(v)} type="button" onClick={() => setCoachRole(v)}
                  className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${coachRole === v ? "border-ember-400/50 bg-ember-400/10 text-brand" : "border-default text-secondary hover:text-primary"}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-[11px] text-rose-400">{error}</p>}

          <button type="submit" disabled={busy || (mode === "new" && (passwords?.length ?? 0) === 0)}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-ember-400 text-[#09090B] font-semibold text-xs py-2 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-ember-300 transition-colors">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> : <UserPlus className="w-3.5 h-3.5" aria-hidden />}
            Add to team
          </button>
        </form>
      </div>
    </div>
  );
}
