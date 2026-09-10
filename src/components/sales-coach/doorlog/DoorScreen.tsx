"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { deviceTimeZone } from "@/lib/coach/doorlog/salesDay";
import { DoorDial } from "./DoorDial";

/**
 * DoorScreen — page 0 of the Home pager (docs/2ND MAIN PANEL DASKBOARD). Built to match the founder's
 * "Door Tracker Screen" mockup (2026-09-10). Order down the screen: date eyebrow + greeting → "Today's door
 * target" card (a sentence from the rep's ratios) → three done/target dials (doors → presentations → sold) →
 * "Tap a dial to log one" → the cash box ("Earned today $__ / $__ per sale / $__ to goal").
 *
 * Two founder-directed departures from the prototype, both deliberate:
 *   • The dials show the rep's REAL logged counts (not the prototype's fake +1); a tap OPENS the existing
 *     DoorLog so the knock gets its real outcome (a door_knock needs an outcome; a "presentation" is a recorded
 *     pitch). Showing counts not backed by real data would break §3.4 — so this is the one thing not copied.
 *   • The accent is the app's EMBER, not the mockup's yellow-400 (founder kept ember for app-wide consistency).
 *
 * The cash box needs a manager-set $-per-sale value; until one is set it degrades to a plain "sales to goal"
 * line rather than fabricating $0. States: loading, unavailable (migration), error, no-goal, goal-met.
 */

type DayTarget = {
  doorsTarget: number; presentationsTarget: number; soldTarget: number;
  usedStarter: boolean; salesGoal: number | null;
  closeRatio: number | null; contactRatio: number | null; saleValueCents: number | null;
};
type Data = { localDate: string; repName: string | null; target: DayTarget; today: { doors: number; presentations: number; sold: number } };

/** Part-of-day greeting matching the mockup ("Afternoon, Marcus" — no "Good"). First name only. */
function greeting(name: string | null): string {
  const h = new Date().getHours();
  const part = h < 12 ? "Morning" : h < 18 ? "Afternoon" : "Evening";
  return name ? `${part}, ${name.split(" ")[0]}` : part;
}

/** Whole dollars when even, else two decimals — matches the mockup's "$185". */
function money(cents: number): string {
  const dollars = cents / 100;
  return "$" + dollars.toLocaleString("en-US", {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function DoorScreen() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [phase, setPhase] = useState<"loading" | "ok" | "unavailable" | "error">("loading");

  // Logging model (John 2026-09-10): a dial tap OPENS the existing DoorLog (pick the knock outcome / record the
  // pitch) — not a bare +1, because a knock needs an outcome and a "presentation" is a recorded pitch. On return
  // the screen re-mounts and the counts refresh.
  const openLog = useCallback(() => router.push("/dashboard/sales-coach/doors"), [router]);

  const load = useCallback(async () => {
    setPhase("loading");
    try {
      const res = await fetch(`/api/coach/doorlog/day-target?tz=${encodeURIComponent(deviceTimeZone())}`);
      if (res.status === 503) { setPhase("unavailable"); return; }
      if (!res.ok) { setPhase("error"); return; }
      setData((await res.json()) as Data);
      setPhase("ok");
    } catch {
      setPhase("error");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (phase === "loading") {
    return <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted"><Loader2 className="w-4 h-4 animate-spin" /> Loading your day…</div>;
  }
  if (phase === "unavailable") {
    return <p className="py-16 text-center text-sm text-muted">The door screen isn&apos;t available yet — the update is still rolling out.</p>;
  }
  if (phase === "error" || !data) {
    return (
      <p className="py-16 text-center text-sm text-amber-600 dark:text-amber-300">
        Couldn&apos;t load your numbers.{" "}
        <button type="button" onClick={() => void load()} className="font-semibold underline">Retry</button>
      </p>
    );
  }

  const { target, today, repName } = data;
  const hasGoal = target.salesGoal != null && target.soldTarget > 0;
  const salesToGoal = Math.max(0, target.soldTarget - today.sold);
  const goalMet = hasGoal && salesToGoal === 0;

  // Ratios for the target sentence. When the starter was used, show the starter figures (1/9, 1/4.4); otherwise
  // invert the rep's own 30-day ratios into human "1 per N" form.
  const closePerPres = target.usedStarter || !target.closeRatio ? 9 : Math.max(1, Math.round(1 / target.closeRatio));
  const doorsPerPres = target.usedStarter || !target.contactRatio ? "4.4" : (1 / target.contactRatio).toFixed(1);

  // Cash box (founder 2026-09-10: match the mockup). Needs a manager-set $-per-sale; until then, degrade to the
  // plain sales-to-goal line rather than fabricating $0 (§3.4).
  const svc = target.saleValueCents;
  const hasCash = hasGoal && svc != null && svc > 0;

  return (
    <div className="flex flex-col gap-5 px-4 py-5 max-w-md mx-auto w-full">
      {/* Greeting — date eyebrow + part-of-day + first name (mockup). */}
      <div className="pt-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand mb-1.5">
          {new Date(`${data.localDate}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="text-3xl font-bold tracking-tight text-primary leading-none">{greeting(repName)}</h1>
      </div>

      {/* Today's door target — a sentence built from the rep's ratios, above the dials on purpose (read WHY 80
          before you see 47). */}
      {hasGoal ? (
        <div className="rounded-2xl border border-default bg-surface/60 px-4 py-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-brand mb-1.5">Today&apos;s door target</p>
          <p className="text-[13px] text-secondary leading-relaxed">
            Your close ratio is <b className="text-primary font-semibold">1 sale per {closePerPres} presentations</b> and{" "}
            <b className="text-primary font-semibold">1 presentation per {doorsPerPres} doors</b>. To land{" "}
            <b className="text-primary font-semibold tabular-nums">{target.soldTarget}</b>{" "}
            {target.soldTarget === 1 ? "sale" : "sales"} today, knock{" "}
            <b className="text-brand font-semibold tabular-nums">{target.doorsTarget}</b> doors.
            {target.usedStarter && <span className="text-muted"> (Starter target — builds to your own pace as you log more.)</span>}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-default bg-surface/60 px-4 py-3">
          <p className="text-sm text-muted">No daily goal set yet — ask your manager to set one, and your door target will appear here.</p>
        </div>
      )}

      {/* Three dials — tapping any opens the DoorLog to log a knock/pitch properly (with its outcome). */}
      <div className="grid grid-cols-3 gap-1">
        <DoorDial count={today.doors} target={hasGoal ? target.doorsTarget : null} label="Doors knocked" onTap={openLog} />
        <DoorDial count={today.presentations} target={hasGoal ? target.presentationsTarget : null} label="Presentations" onTap={openLog} />
        <DoorDial count={today.sold} target={hasGoal ? target.soldTarget : null} label="Sold" accent onTap={openLog} />
      </div>
      <p className="text-center text-[10px] uppercase tracking-[0.14em] text-muted -mt-3">Tap a dial to log one</p>

      {/* Cash box (mockup). "Earned today" = sold × $/sale; "to goal" = remaining sales × $/sale. Degrades to a
          plain sales-to-goal line when no $-per-sale is set (no fabricated $0). */}
      {hasGoal && (hasCash ? (
        <div className="rounded-2xl border border-strong bg-surface/60 px-4 py-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.15em] text-muted font-bold mb-1">Earned today</p>
            <p className="text-4xl font-extrabold tracking-tight text-brand tabular-nums leading-none">{money(today.sold * svc!)}</p>
          </div>
          <div className="text-right text-[11px] text-muted leading-relaxed tabular-nums">
            {money(svc!)} per sale<br />
            {goalMet ? <span className="text-brand font-semibold">goal met 🎯</span> : <span>{money(salesToGoal * svc!)} to goal</span>}
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-default bg-surface/60 px-4 py-3 flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wide text-muted font-bold">To goal</span>
          {goalMet ? (
            <span className="text-base font-bold text-brand">Goal met 🎯</span>
          ) : (
            <span className="text-base font-bold text-primary tabular-nums">
              {salesToGoal} more {salesToGoal === 1 ? "sale" : "sales"}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
