"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";

/**
 * Remote Sales → Coaching: show one manager's team (2026-11-26; Gong ledger F10.9 / F16.6 "switch to another manager's
 * team"). Lists the teams this manager may narrow to (GET /api/coach/remote/teams); "Everyone you can see" is no
 * narrowing. Renders nothing when there is no team to pick (no reporting tree yet) or for a rep (403).
 */
type Team = { id: string; name: string; size: number; mine: boolean };

export function TeamPicker({ value, onChange }: { value: string; onChange: (team: string) => void }) {
  const [teams, setTeams] = useState<Team[] | null>(null);
  useEffect(() => {
    let live = true;
    fetch("/api/coach/remote/teams", { cache: "no-store" })
      .then(async (r) => (r.ok ? ((await r.json()) as { teams: Team[] }).teams : []))
      .then((t) => live && setTeams(t))
      .catch(() => live && setTeams([]));
    return () => {
      live = false;
    };
  }, []);
  if (!teams || teams.length === 0) return null;
  return (
    <label className="flex flex-wrap items-center gap-2 text-xs text-secondary">
      <Users className="h-3.5 w-3.5 text-brand" aria-hidden />
      Showing
      <select value={value} onChange={(e) => onChange(e.currentTarget.value)} aria-label="Team" className="rounded-lg border border-default bg-surface px-2 py-1 text-xs text-primary">
        <option value="">Everyone you can see</option>
        {teams.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({t.size})
          </option>
        ))}
      </select>
    </label>
  );
}
