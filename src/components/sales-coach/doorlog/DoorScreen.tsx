"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { deviceTimeZone } from "@/lib/coach/doorlog/salesDay";
import { DoorDial } from "./DoorDial";

/**
 * DoorScreen — page 0 of the door home screen (docs/2ND MAIN PANEL DASKBOARD, Phase 07). Order down the screen:
 * greeting → door-target card → three done/target dials → sales-to-goal. Reads the frozen day target + today's
 * counts from GET /api/coach/doorlog/day-target. DISPLAY only for now — tap/long-press logging (Phase 08) is
 * wired after the door-tap-vs-outcome modelling decision. States: loading, unavailable (migration), error,
 * no-goal, start-of-day (all zero), goal-met.
 */

type DayTarget = {
  doorsTarget: number; presentationsTarget: number; soldTarget: number;
  usedStarter: boolean; salesGoal: number | null;
};
type Data = { localDate: string; repName: string | null; target: DayTarget; today: { doors: number; presentations: number; sold: number } };

function greeting(name: string | null): string {
  const h = new Date().getHours();
  const part = h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
  return name ? `${part}, ${name.split(" ")[0]}` : part;
}

export function DoorScreen() {
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [phase, setPhase] = useState<"loading" | "ok" | "unavailable" | "error">("loading");

  // Logging model (John 2026-09-10): a dial tap OPENS the existing DoorLog (pick the knock outcome / record the
  // pitch) — not a bare +1, because a knock needs an outcome and a "presentation" is a recorded pitch. On return
  // the screen re-mounts and the counts refresh. (This supersedes Q5's long-press decrement, which assumed a
  // bare +1: undo now lives in the DoorLog flow, so the dials pass no onDecrement.)
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

  return (
    <div className="flex flex-col gap-5 px-4 py-5 max-w-md mx-auto w-full">
      {/* Greeting */}
      <div>
        <h1 className="text-lg font-bold text-primary">{greeting(repName)}</h1>
        <p className="text-[11px] text-muted mt-0.5">
          {new Date(`${data.localDate}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })}
        </p>
      </div>

      {/* Door-target card — a sentence built from the numbers, above the dials on purpose (read WHY 80 before you see 47). */}
      {hasGoal ? (
        <div className="rounded-2xl border border-default bg-surface/60 px-4 py-3">
          <p className="text-sm text-secondary leading-relaxed">
            Knock <span className="font-bold text-brand tabular-nums">{target.doorsTarget}</span> doors today to hit
            your goal of <span className="font-bold text-primary tabular-nums">{target.soldTarget}</span>{" "}
            {target.soldTarget === 1 ? "sale" : "sales"}.
            {target.usedStarter && <span className="text-muted"> (starter target — builds to your own pace as you log more.)</span>}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-default bg-surface/60 px-4 py-3">
          <p className="text-sm text-muted">No daily goal set yet — ask your manager to set one, and your door target will appear here.</p>
        </div>
      )}

      {/* Three dials — tapping any opens the DoorLog to log a knock/pitch properly (with its outcome). */}
      <div className="grid grid-cols-3 gap-2">
        <DoorDial count={today.doors} target={hasGoal ? target.doorsTarget : null} label="Doors" onTap={openLog} />
        <DoorDial count={today.presentations} target={hasGoal ? target.presentationsTarget : null} label="Presentations" onTap={openLog} />
        <DoorDial count={today.sold} target={hasGoal ? target.soldTarget : null} label="Sold" accent onTap={openLog} />
      </div>
      <p className="text-center text-[11px] text-muted -mt-2">Tap a dial to log a knock.</p>

      {/* Sales to goal (replaces the old $ box — number of sales, not cash) */}
      {hasGoal && (
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
      )}
    </div>
  );
}
