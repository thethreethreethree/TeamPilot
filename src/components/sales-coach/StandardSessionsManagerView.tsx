"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

/**
 * ELOSALES Standard revision — the MANAGER view of the Standard Sessions tab: a roster of team members with each
 * rep's recent USAGE (session count + last active), click a name → that rep's recent sessions. Each session links to
 * the session detail (transcript/review) and, when a recording exists, has a Save toggle.
 *
 * Founder fix 2026-08-27 ("view session not working — active reps not showing up"): the old view only listed sessions
 * that STILL HAD AUDIO within the last 2 days, so a rep who used the product but whose captures had no stored audio
 * (or whose sessions were older than 2 days) was invisible and their usage unmonitorable. This now shows ACTIVITY —
 * every session in the last 30 days, with a recording indicator — so the manager can actually see who's using it.
 *
 * A rep (non-manager) never sees this — they keep their own Sessions self-view (A10), passed as `fallback`. §A18:
 * activity, never a ranking (unsorted, alphabetical by name).
 */

type Member = { id: string; fullName: string | null; companyRole: string | null; salesCoachRole: "admin" | "staff" | null };
type Activity = { count: number; lastActiveAt: string; withAudio: number };
type Session = { id: string; clientLabel: string | null; status: string; startedAt: string; hasAudio: boolean; saved: boolean };

function relDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function StandardSessionsManagerView({ fallback }: { fallback: React.ReactNode }) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [activity, setActivity] = useState<Record<string, Activity>>({});
  // false until team-activity loads successfully — so a pending/failed aggregate does NOT render as "No sessions" for
  // every rep (a failure dressed as no-data in the exact usage surface — review F1, §3.4).
  const [activityLoaded, setActivityLoaded] = useState(false);
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
    // Per-rep usage summary (best-effort — the roster still renders without it). Only mark loaded on a real success,
    // so a failure leaves the annotation blank (unknown) rather than claiming "No sessions" for everyone (F1).
    void fetch("/api/coach/sales-session/team-activity")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("team-activity failed"))))
      .then((d) => { if (!cancelled) { setActivity(d.byAgent ?? {}); setActivityLoaded(true); } })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (error) return <div className="text-sm text-muted">Couldn&apos;t load your team — refresh to try again.</div>;
  if (isManager === null) return <div className="text-sm text-muted">Loading team…</div>;
  if (isManager === false) return <>{fallback}</>;
  if (selected) return <RepActivity member={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="glass-card p-5">
      <h2 className="text-sm font-semibold text-primary mb-1">Your team</h2>
      <p className="text-[11px] text-muted mb-4">
        Each rep&apos;s activity over the last 30 days. Open a rep to see their sessions and recordings.
      </p>
      <div className="flex flex-col divide-y divide-white/5">
        {(members ?? []).map((m) => {
          const a = activity[m.id];
          return (
            <button
              key={m.id}
              onClick={() => setSelected(m)}
              className="flex items-center justify-between py-3 text-left hover:opacity-80 gap-3"
            >
              <span className="min-w-0">
                <span className="block text-sm text-primary truncate">{m.fullName ?? "Unnamed rep"}</span>
                <span className="block text-[11px] text-muted">
                  {!activityLoaded
                    ? " " /* unknown (loading or failed) — never claim "No sessions" on a failed aggregate (F1) */
                    : a && a.count > 0
                      ? // §3.4 honesty: a rep can be "active" while capturing NO usable audio (the iOS webm-stub
                        // failure) — surface how many sessions actually recorded, so "44 sessions" never reads as
                        // healthy when 0 had audio. ⚠ marks the all-failed case (the founder's exact monitoring need).
                        `${a.count} session${a.count === 1 ? "" : "s"} · ${a.withAudio === 0 ? "⚠ none with audio" : `${a.withAudio} with audio`} · last active ${relDay(a.lastActiveAt)}`
                      : "No sessions in the last 30 days"}
                </span>
              </span>
              <span className="text-[11px] text-muted shrink-0">{m.salesCoachRole ?? m.companyRole ?? ""} →</span>
            </button>
          );
        })}
        {(members ?? []).length === 0 && <p className="py-3 text-sm text-muted">No team members yet.</p>}
      </div>
    </div>
  );
}

function statusLabel(s: string): string {
  if (s === "reviewed") return "Reviewed";
  if (s === "ended") return "Completed";
  if (s === "active") return "In progress";
  return s;
}

function RepActivity({ member, onBack }: { member: Member; onBack: () => void }) {
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [savingAvailable, setSavingAvailable] = useState(true);
  const [windowDays, setWindowDays] = useState(30);
  const [atCap, setAtCap] = useState(false);
  const [cap, setCap] = useState(100);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const r = await fetch(`/api/coach/sales-session/rep-activity?agentId=${encodeURIComponent(member.id)}`);
      if (!r.ok) throw new Error("activity read failed");
      const d = await r.json();
      setSessions(d.sessions ?? []);
      setSavingAvailable(d.savingAvailable !== false);
      setWindowDays(d.windowDays ?? 30);
      setAtCap(Boolean(d.atCap));
      setCap(d.cap ?? 100);
    } catch {
      setError(true); // §3.4: a failed read must not read as "no sessions".
    } finally {
      setLoading(false);
    }
  }, [member.id]);

  useEffect(() => { void load(); }, [load]);

  const toggleSave = async (s: Session) => {
    setSavingId(s.id);
    setSessions((xs) => (xs ?? []).map((x) => (x.id === s.id ? { ...x, saved: !x.saved } : x)));
    try {
      const res = await fetch(`/api/coach/sales-session/${s.id}/save-recording`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ saved: !s.saved }),
      });
      if (!res.ok) {
        setSessions((xs) => (xs ?? []).map((x) => (x.id === s.id ? { ...x, saved: s.saved } : x)));
      }
    } catch {
      setSessions((xs) => (xs ?? []).map((x) => (x.id === s.id ? { ...x, saved: s.saved } : x)));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="glass-card p-5">
      <button onClick={onBack} className="text-[11px] text-muted hover:opacity-80 mb-3">← Team</button>
      <h2 className="text-sm font-semibold text-primary mb-1">{member.fullName ?? "Rep"}</h2>
      <p className="text-[11px] text-muted mb-4">
        {atCap ? `Most recent ${cap} sessions` : "Sessions"} from the last {windowDays} days. A recording, when captured, can be saved to keep it longer.
      </p>

      {loading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : error ? (
        <p className="text-sm text-muted">Couldn&apos;t load activity — try again.</p>
      ) : (sessions ?? []).length === 0 ? (
        <p className="text-sm text-muted">No sessions in the last {windowDays} days.</p>
      ) : (
        <div className="flex flex-col divide-y divide-white/5">
          {(sessions ?? []).map((s) => (
            <div key={s.id} className="flex items-center justify-between py-3 gap-3">
              <Link href={`/dashboard/sales-coach/${s.id}`} className="min-w-0 hover:opacity-80">
                <span className="block text-sm text-primary truncate">{s.clientLabel ?? "Session"}</span>
                <span className="block text-[11px] text-muted">
                  {new Date(s.startedAt).toLocaleString()} · {statusLabel(s.status)}
                  {s.hasAudio ? " · 🎙 recording" : " · no recording"}
                </span>
              </Link>
              {savingAvailable && s.hasAudio && (
                <button
                  onClick={() => void toggleSave(s)}
                  disabled={savingId === s.id}
                  className={`shrink-0 text-[11px] px-2 py-1 rounded border ${
                    s.saved ? "border-brand text-brand" : "border-white/15 text-muted"
                  } hover:opacity-80 disabled:opacity-50`}
                >
                  {s.saved ? "Saved" : "Save"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
