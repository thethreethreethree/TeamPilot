"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

/**
 * ELOSALES Standard revision (PDF Sessions item 1a/1b) — the MANAGER view of the Standard Sessions tab:
 * a roster of team members → click a name → that rep's recordings from the past 2 days. Each recording links
 * to the existing session detail (playback/transcript) and has a Save toggle so it survives the 2-day purge.
 *
 * A rep (non-manager) never sees this — they keep their own Sessions self-view (A10), passed as `fallback`.
 * Standard-only; Expert is untouched. Layer-4 polish restrained + open to iteration.
 */

type Member = { id: string; fullName: string | null; companyRole: string | null; salesCoachRole: "admin" | "staff" | null };
type Recording = { id: string; clientLabel: string | null; createdAt: string; saved: boolean };

export function StandardSessionsManagerView({ fallback }: { fallback: React.ReactNode }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [isManager, setIsManager] = useState<boolean | null>(null);
  const [selected, setSelected] = useState<Member | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/coach/sales-session/team")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled) return;
        if (!d) { setIsManager(false); return; }
        setMembers(d.members ?? []);
        setIsManager(Boolean(d.isManager));
      })
      .catch(() => setIsManager(false));
    return () => { cancelled = true; };
  }, []);

  if (isManager === false) return <>{fallback}</>;
  if (isManager === null) return <div className="text-sm text-muted">Loading team…</div>;
  if (selected) return <RepRecordings member={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="glass-card p-5">
      <h2 className="text-sm font-semibold text-primary mb-1">Your team</h2>
      <p className="text-[11px] text-muted mb-4">
        Open a rep to review their recent recordings. Recordings clear after 2 days unless saved.
      </p>
      <div className="flex flex-col divide-y divide-white/5">
        {(members ?? []).map((m) => (
          <button
            key={m.id}
            onClick={() => setSelected(m)}
            className="flex items-center justify-between py-3 text-left hover:opacity-80"
          >
            <span className="text-sm text-primary">{m.fullName ?? "Unnamed rep"}</span>
            <span className="text-[11px] text-muted">{m.salesCoachRole ?? m.companyRole ?? ""} →</span>
          </button>
        ))}
        {(members ?? []).length === 0 && <p className="py-3 text-sm text-muted">No team members yet.</p>}
      </div>
    </div>
  );
}

function RepRecordings({ member, onBack }: { member: Member; onBack: () => void }) {
  const [recordings, setRecordings] = useState<Recording[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/coach/sales-session/recordings?agentId=${encodeURIComponent(member.id)}`);
      setRecordings(r.ok ? (await r.json()).recordings ?? [] : []);
    } finally {
      setLoading(false);
    }
  }, [member.id]);

  useEffect(() => { void load(); }, [load]);

  const toggleSave = async (rec: Recording) => {
    setSavingId(rec.id);
    // optimistic
    setRecordings((rs) => (rs ?? []).map((x) => (x.id === rec.id ? { ...x, saved: !x.saved } : x)));
    try {
      const res = await fetch(`/api/coach/sales-session/${rec.id}/save-recording`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ saved: !rec.saved }),
      });
      if (!res.ok) {
        // revert on failure
        setRecordings((rs) => (rs ?? []).map((x) => (x.id === rec.id ? { ...x, saved: rec.saved } : x)));
      }
    } catch {
      setRecordings((rs) => (rs ?? []).map((x) => (x.id === rec.id ? { ...x, saved: rec.saved } : x)));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="glass-card p-5">
      <button onClick={onBack} className="text-[11px] text-muted hover:opacity-80 mb-3">← Team</button>
      <h2 className="text-sm font-semibold text-primary mb-1">{member.fullName ?? "Rep"}</h2>
      <p className="text-[11px] text-muted mb-4">Recordings from the last 2 days. Save one to keep it longer.</p>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : (recordings ?? []).length === 0 ? (
        <p className="text-sm text-muted">No recordings in the last 2 days.</p>
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {(recordings ?? []).map((rec) => (
            <div key={rec.id} className="flex items-center justify-between py-3 gap-3">
              <Link href={`/dashboard/sales-coach/${rec.id}`} className="min-w-0 hover:opacity-80">
                <span className="block text-sm text-primary truncate">{rec.clientLabel ?? "Session"}</span>
                <span className="block text-[11px] text-muted">
                  {new Date(rec.createdAt).toLocaleString()}
                </span>
              </Link>
              <button
                onClick={() => void toggleSave(rec)}
                disabled={savingId === rec.id}
                className={`shrink-0 text-[11px] px-2 py-1 rounded border ${
                  rec.saved ? "border-brand text-brand" : "border-white/15 text-muted"
                } hover:opacity-80 disabled:opacity-50`}
              >
                {rec.saved ? "Saved" : "Save"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
