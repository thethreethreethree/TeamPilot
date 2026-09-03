"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { POINTS_SCALE_MAX } from "@/lib/coach/gamification/bands";
import { deriveArena } from "@/lib/coach/gamification/arenaSummary";

/**
 * RepArena — the signed-in rep's OWN gamification dashboard ("My Arena"). A record-keeping progress screen modeled
 * on the arena-v2 reference layout (radial gauge, odometer, stat pair, records board, milestone badges, recent bars)
 * reskinned to ELOSTATE branding (ember-on-ink, the bulb) and rewired to the Sales Coach gamification concepts:
 *   gauge   → average points (0–100) + current band          odometer → total points earned
 *   stats   → strong sessions (>=80) + deals closed           records  → best pitches (link to each after-pitch)
 *   badges  → milestones (first pitch, strong, first deal…)   bars     → last 7 sessions' points
 * Reads the caller's own /my-points (owner-RLS) + /leaderboard (best/deals/rank for the caller's row). Per-session
 * detail stays private to the rep (A18) — a manager never sees this screen for someone else.
 */

type Row = { session_id: string | null; points: number; band: string | null; created_at: string };
type MyPoints = { rows: Row[]; total: number; avg: number; sessions: number };
type LbRow = { agent_id: string; best_points: number; deals: number };
type Lb = { rows: LbRow[]; meId: string; meRank: number | null };

const prefersReducedMotion = () =>
  typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A count-up that lands on `value` (respects reduced-motion by jumping). Returns the current display number. */
function useCountUp(value: number, ms = 900): number {
  const [n, setN] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (prefersReducedMotion()) {
      setN(value);
      return;
    }
    const start = performance.now();
    const from = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setN(Math.round(from + (value - from) * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, ms]);
  return n;
}

/** The 270°-arc gauge (value out of max). Arc fill animates via stroke-dashoffset; the big number counts up. */
function Gauge({ value, max, label, sub }: { value: number; max: number; label: string; sub: string }) {
  const R = 100;
  const C = 2 * Math.PI * R;
  const ARC = C * 0.75; // 270° sweep
  const p = Math.max(0, Math.min(1, max > 0 ? value / max : 0));
  const shown = useCountUp(value);
  const [offset, setOffset] = useState(ARC); // start empty → animate to filled
  useEffect(() => {
    if (prefersReducedMotion()) {
      setOffset(ARC * (1 - p));
      return;
    }
    const id = requestAnimationFrame(() => setOffset(ARC * (1 - p)));
    return () => cancelAnimationFrame(id);
  }, [p, ARC]);
  return (
    <div className="ra-gauge">
      <svg viewBox="0 0 250 250" aria-hidden="true">
        <defs>
          <linearGradient id="ra-g" x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor="#EAB308" />
            <stop offset="55%" stopColor="#FACC15" />
            <stop offset="100%" stopColor="#FDE047" />
          </linearGradient>
        </defs>
        <g transform="rotate(135 125 125)">
          <circle className="ra-gauge__track" cx="125" cy="125" r={R} strokeDasharray={`${ARC} ${C}`} />
          <circle
            className="ra-gauge__arc"
            cx="125"
            cy="125"
            r={R}
            strokeDasharray={`${ARC} ${C}`}
            strokeDashoffset={offset}
          />
        </g>
      </svg>
      <div className="ra-gauge__center" role="img" aria-label={`${label}: ${value} of ${max}. ${sub}`}>
        <div className="ra-gauge__value">{shown}</div>
        <div className="ra-gauge__label">{label}</div>
        <div className="ra-gauge__sub">{sub}</div>
      </div>
    </div>
  );
}

/** Grouped odometer digits with thousands separators. */
function Odometer({ total, cap }: { total: number; cap: string }) {
  const chars = [...total.toLocaleString("en-US")];
  return (
    <div className="ra-odo">
      <div className="ra-odo__digits">
        {chars.map((ch, i) =>
          ch === "," ? (
            <div key={i} className="ra-odo__d ra-odo__d--sep">
              ,
            </div>
          ) : (
            <div key={i} className="ra-odo__d">
              {ch}
            </div>
          ),
        )}
      </div>
      <div className="ra-odo__cap">{cap}</div>
    </div>
  );
}

const MILESTONE_ICON: Record<string, React.ReactNode> = {
  spark: <path d="M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4z" />,
  flame: (
    <>
      <path d="M12 2s5 5 5 9a5 5 0 0 1-10 0c0-4 5-9 5-9z" />
      <path d="M12 22a7 7 0 0 0 7-7" />
    </>
  ),
  deal: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M9 21h6M12 14v7" />
    </>
  ),
  century: <path d="M4 9v6M20 9v6M7 5v14M17 5v14M7 12h10" />,
  closer: (
    <>
      <path d="M3 8l4 3 5-6 5 6 4-3v9H3z" />
      <path d="M3 20h18" />
    </>
  ),
};

export function RepArena() {
  const [mp, setMp] = useState<MyPoints | null>(null);
  const [lb, setLb] = useState<Lb | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/coach/gamification/my-points").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/coach/gamification/leaderboard?period=all").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([m, l]) => {
        if (!alive) return;
        if (m) setMp(m as MyPoints);
        if (l) setLb(l as Lb);
      })
      .catch(() => {})
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  if (!loaded) {
    return <div className="ra-wrap ra-empty">Loading your arena…</div>;
  }
  if (!mp || mp.sessions === 0) {
    return (
      <div className="ra-wrap ra-empty">
        <p className="ra-empty__h">No pitches scored yet</p>
        <p className="ra-empty__p">Run a coaching session and your points, records, and milestones show up here.</p>
        <ArenaStyles />
      </div>
    );
  }

  const meRow = lb?.rows.find((r) => r.agent_id === lb.meId);
  const { bandLabel, best, deals, rank, strong, records, bars, milestones } = deriveArena({
    rows: mp.rows,
    total: mp.total,
    avg: mp.avg,
    sessions: mp.sessions,
    best: meRow?.best_points ?? null,
    deals: meRow?.deals ?? null,
    rank: lb?.meRank ?? null,
  });
  const barMax = Math.max(...bars.map((b) => b.points), 1);

  return (
    <div className="ra-wrap">
      <Gauge
        value={mp.avg}
        max={POINTS_SCALE_MAX}
        label={bandLabel}
        sub={`Best ${best}${rank ? ` · rank #${rank}` : ""}`}
      />

      <Odometer total={mp.total} cap="Total points earned" />

      <div className="ra-stats">
        <div className="ra-stat">
          <span className="ra-stat__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l2.4 5.6L20 10l-5.6 2.4L12 18l-2.4-5.6L4 10l5.6-2.4z" />
            </svg>
          </span>
          <div className="ra-stat__value">
            {strong}
            <small>/{mp.sessions}</small>
          </div>
          <div className="ra-stat__label">Strong sessions</div>
        </div>
        <div className="ra-stat">
          <span className="ra-stat__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
              <path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" />
              <path d="M9 21h6M12 14v7" />
            </svg>
          </span>
          <div className="ra-stat__value">{deals}</div>
          <div className="ra-stat__label">Deals closed</div>
        </div>
      </div>

      <p className="ra-sect">Best pitches</p>
      <div className="ra-prs">
        {records.map((rec, i) => {
          const inner = (
            <div className="ra-pr">
              <div>
                <div className="ra-pr__name">{rec.bandLabel}</div>
                <div className="ra-pr__date">{new Date(rec.row.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
              </div>
              <div style={{ flex: 1 }} />
              <div className="ra-pr__w">{rec.row.points}</div>
              <div className={`ra-pr__d${rec.isNew ? " ra-pr__d--new" : ""}`}>{rec.isNew ? "NEW" : `${rec.floor}+`}</div>
            </div>
          );
          return rec.row.session_id ? (
            <Link key={i} href={`/dashboard/sales-coach/${rec.row.session_id}/after-pitch`} className="ra-pr-link">
              {inner}
            </Link>
          ) : (
            <div key={i}>{inner}</div>
          );
        })}
      </div>

      <p className="ra-sect">Milestones</p>
      <div className="ra-badges">
        {milestones.map((m) => (
          <div key={m.key} className={`ra-badge ${m.on ? "ra-badge--on" : "ra-badge--off"}`} title={m.title}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {MILESTONE_ICON[m.key]}
            </svg>
          </div>
        ))}
      </div>

      <p className="ra-sect">Last 7 sessions · points</p>
      <div className="ra-bars-panel">
        <div className="ra-bars">
          {bars.map((b, i) => (
            <div
              key={i}
              className={`ra-bar${b.points === 0 ? " ra-bar--0" : ""}`}
              style={{ height: `${b.points === 0 ? 8 : Math.max(14, (b.points / barMax) * 100)}%`, animationDelay: `${i * 50}ms` }}
              title={`${b.points} pts`}
            />
          ))}
        </div>
        <div className="ra-bars-cap">
          <span>Oldest</span>
          <span>Latest</span>
        </div>
      </div>

      <p className="ra-foot">Your session detail stays private to you.</p>
      <ArenaStyles />
    </div>
  );
}

/** Scoped styles — ELOSTATE ember-on-ink, theme-aware via the app's CSS tokens; ember-specific glow/gradients set
 *  from brand hex. Mirrors arena-v2's structure (gauge / odometer / stats / records / badges / bars). */
function ArenaStyles() {
  return (
    <style>{`
    .ra-wrap{width:100%;max-width:420px;margin:0 auto;padding:8px 4px 32px;font-variant-numeric:tabular-nums}
    .ra-empty{text-align:center;color:rgb(var(--text-muted));padding:48px 16px}
    .ra-empty__h{font-size:16px;font-weight:600;color:rgb(var(--text-primary));margin:0 0 6px}
    .ra-empty__p{font-size:13px;margin:0}
    .ra-sect{font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:rgb(var(--text-muted));margin:18px 0 9px 4px}

    /* Accent = the ELOSTATE bulb, via --brand-text (ember.400 on ink / ember.700 on cream) so numbers + icons hold
       contrast in BOTH themes (the founder flagged bright ember as unreadable on cream — fixed at the token). The
       decorative graphics (arc/bar/badge gradients + glow) stay ember hex and soften under the light override. */
    .ra-gauge{position:relative;display:grid;place-items:center;margin:0 0 -18px}
    .ra-gauge svg{width:250px;height:250px;display:block;overflow:visible}
    .ra-gauge__track{fill:none;stroke:rgb(var(--bg-surface-raised));stroke-width:14;stroke-linecap:round}
    .ra-gauge__arc{fill:none;stroke:url(#ra-g);stroke-width:14;stroke-linecap:round;
      filter:drop-shadow(0 0 5px rgba(250,204,21,.5));
      transition:stroke-dashoffset .9s cubic-bezier(.16,1,.3,1)}
    .ra-gauge__center{position:absolute;inset:0;display:grid;place-content:center;text-align:center}
    .ra-gauge__value{font-size:64px;font-weight:700;color:rgb(var(--brand-text));line-height:1}
    .ra-gauge__label{font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:rgb(var(--brand-text));opacity:.9;margin-top:5px;font-weight:600}
    .ra-gauge__sub{font-size:11px;color:rgb(var(--text-muted));margin-top:3px;letter-spacing:.05em}

    .ra-odo{background:rgb(var(--bg-surface));border:1px solid rgb(var(--border-default));border-radius:22px;padding:15px 16px 13px;margin-bottom:12px}
    .ra-odo__digits{display:flex;gap:4px;justify-content:center;margin-bottom:8px}
    .ra-odo__d{background:rgb(var(--bg-surface-raised));border-radius:5px;padding:8px 0;width:34px;text-align:center;
      font-size:24px;font-weight:700;color:rgb(var(--brand-text));font-family:ui-monospace,"SF Mono",Menlo,monospace;
      box-shadow:inset 0 -2px 6px rgba(0,0,0,.45)}
    .ra-odo__d--sep{background:none;box-shadow:none;width:10px;color:rgb(var(--text-muted));padding-top:10px;font-size:20px}
    .ra-odo__cap{text-align:center;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:rgb(var(--text-muted))}

    .ra-stats{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:6px}
    .ra-stat{background:rgb(var(--bg-surface));border:1px solid rgb(var(--border-default));border-radius:22px;padding:15px 10px 13px;text-align:center}
    .ra-stat__icon{color:rgb(var(--brand-text));display:block;margin-bottom:6px}
    .ra-stat__icon svg{width:22px;height:22px}
    .ra-stat__value{font-size:27px;font-weight:700;color:rgb(var(--brand-text));line-height:1}
    .ra-stat__value small{font-size:15px;color:rgb(var(--text-muted));font-weight:600}
    .ra-stat__label{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:rgb(var(--text-muted));margin-top:6px}

    .ra-prs{background:rgb(var(--bg-surface));border:1px solid rgb(var(--border-default));border-radius:22px;padding:6px 16px}
    .ra-pr-link{display:block;text-decoration:none;color:inherit}
    .ra-pr-link:hover .ra-pr__name{color:rgb(var(--brand-text))}
    .ra-pr{display:flex;align-items:center;gap:10px;padding:12px 0;border-bottom:1px solid rgb(var(--border-default))}
    .ra-pr-link:last-child .ra-pr,.ra-prs>div:last-child .ra-pr{border-bottom:none}
    .ra-pr__name{font-size:14px;font-weight:600;color:rgb(var(--text-primary))}
    .ra-pr__date{font-size:10px;color:rgb(var(--text-muted));letter-spacing:.08em;text-transform:uppercase}
    .ra-pr__w{font-size:19px;font-weight:700;color:rgb(var(--brand-text));font-family:ui-monospace,Menlo,monospace}
    .ra-pr__d{font-size:11px;font-weight:700;color:rgb(var(--text-secondary));min-width:40px;text-align:right}
    .ra-pr__d--new{color:rgb(var(--brand-text))}

    .ra-badges{display:flex;justify-content:space-between;gap:8px}
    .ra-badge{width:52px;height:58px;display:grid;place-items:center;background:rgb(var(--bg-surface-raised));
      clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%)}
    .ra-badge svg{width:21px;height:21px}
    .ra-badge--on{background:linear-gradient(160deg,#4A3600,#6E5100)}
    .ra-badge--on svg{color:#FACC15;filter:drop-shadow(0 0 5px rgba(250,204,21,.7))}
    .ra-badge--off svg{color:rgb(var(--text-muted));opacity:.4}

    .ra-bars-panel{background:rgb(var(--bg-surface));border:1px solid rgb(var(--border-default));border-radius:22px;padding:16px}
    .ra-bars{display:flex;align-items:flex-end;gap:7px;height:80px}
    .ra-bar{flex:1;border-radius:4px;background:linear-gradient(180deg,#FDE047,#EAB308);
      box-shadow:0 0 18px rgba(250,204,21,.35);animation:ra-rise .5s cubic-bezier(.16,1,.3,1) backwards}
    .ra-bar--0{background:rgb(var(--bg-surface-raised));box-shadow:none}
    @keyframes ra-rise{from{transform:scaleY(0);opacity:0}}
    .ra-bars-cap{display:flex;justify-content:space-between;margin-top:10px;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgb(var(--text-muted))}
    .ra-foot{font-size:11px;color:rgb(var(--text-muted));text-align:center;margin-top:16px}

    /* Light theme: kill the neon glows (they smear on cream) and lighten the lit-badge fill so the ember icon reads. */
    :root[data-theme="light"] .ra-gauge__arc{filter:none}
    :root[data-theme="light"] .ra-odo__d{box-shadow:inset 0 -2px 5px rgba(0,0,0,.08)}
    :root[data-theme="light"] .ra-badge--on{background:linear-gradient(160deg,#FEF08A,#FDE047)}
    :root[data-theme="light"] .ra-badge--on svg{color:#A16207;filter:none}
    :root[data-theme="light"] .ra-bar{box-shadow:none}
    @media (prefers-color-scheme:light){
      :root:not([data-theme="dark"]) .ra-gauge__arc{filter:none}
      :root:not([data-theme="dark"]) .ra-odo__d{box-shadow:inset 0 -2px 5px rgba(0,0,0,.08)}
      :root:not([data-theme="dark"]) .ra-badge--on{background:linear-gradient(160deg,#FEF08A,#FDE047)}
      :root:not([data-theme="dark"]) .ra-badge--on svg{color:#A16207;filter:none}
      :root:not([data-theme="dark"]) .ra-bar{box-shadow:none}
    }
    @media (prefers-reduced-motion:reduce){.ra-bar{animation:none}.ra-gauge__arc{transition:none}}
    `}</style>
  );
}
