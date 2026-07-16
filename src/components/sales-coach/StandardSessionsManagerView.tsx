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
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/coach/sales-session/team")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("team read failed"))))
      .then((d) => {
        if (cancelled) return;
        setMembers(d.members ?? []);
        setIsManager(Boolean(d.isManager));
      })
      // §3.4: a failed read is not "not a manager"; show an honest error, never silently the rep view.
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);

  if (error) return <div className="text-sm text-muted">Couldn&apos;t load your team — refresh to try again.</div>;
  if (isManager === null) return <div className="text-sm text-muted">Loading team…</div>;
  if (isManager === false) return <>{fallback}</>;
  if (selected) return <RepRecordings member={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="glass-card p-5">
      <h2 className="text-sm font-semibold text-primary mb-1">Your team</h2>
      {/* A27 — this line used to read "Recordings clear after 2 days unless saved." That PROMISED an invariant
          nothing enforces: the retention purge is DORMANT (it needs 0187 applied plus CRON_SECRET and a schedule
          entry), so nothing deletes anything today. What actually happens is this list FILTERS to the last 2
          days — the recordings are hidden, not cleared, and they persist in storage. A promised-but-unenforced
          invariant is worse than silence (§3.4), and this one is a false PRIVACY assurance: a rep reading
          "clear" believes their calls are ephemeral when they are merely out of sight. The label now states
          only what is actually true and verifiable from this surface; when the purge is wired, it can promise
          deletion again — and A27's point is that the promise must follow the enforcement, never lead it. */}
      <p className="text-[11px] text-muted mb-4">
        Open a rep to review their recent recordings. This list shows the last 2 days, plus anything saved.
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
  const [savingAvailable, setSavingAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const r = await fetch(`/api/coach/sales-session/recordings?agentId=${encodeURIComponent(member.id)}`);
      if (!r.ok) throw new Error("recordings read failed");
      const d = await r.json();
      setRecordings(d.recordings ?? []);
      // §3.4 honesty: the endpoint tells us whether the save-past-2-days column (0187) is live. When it isn't,
      // don't render a Save button that can only silently fail — omit the affordance (AMD-006 L4).
      setSavingAvailable(d.savingAvailable !== false);
    } catch {
      // §3.4: a failed read must not read as "no recordings".
      setError(true);
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
      {/* A27 again — "Save one to keep it longer" implies the unsaved ones go away. They don't yet (dormant
          purge, see the note above). Saving is real and does exempt a recording from the purge once it runs, so
          the control is honest; the implied deletion is what had to go. */}
      <p className="text-[11px] text-muted mb-4">
        Recordings from the last 2 days. Saving one keeps it in this list.
      </p>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : error ? (
        <p className="text-sm text-muted">Couldn&apos;t load recordings — try again.</p>
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
              {savingAvailable && (
                <button
                  onClick={() => void toggleSave(rec)}
                  disabled={savingId === rec.id}
                  className={`shrink-0 text-[11px] px-2 py-1 rounded border ${
                    rec.saved ? "border-brand text-brand" : "border-white/15 text-muted"
                  } hover:opacity-80 disabled:opacity-50`}
                >
                  {rec.saved ? "Saved" : "Save"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
