"use client";

import type { DiagnosisRun } from "./types";

/**
 * Local persistence for in-progress diagnosis runs (audit Tier 2 #13).
 *
 * Uses localStorage. Scoped by a stable key per browser. Survives refresh and
 * navigation. Not synced across browsers/devices (that requires Supabase, which
 * is intentionally deferred).
 *
 * When the Supabase-backed diagnosis_runs table lands, this layer becomes
 * the offline fallback — same shape, same API.
 */

const KEY = "execos.diagnosis.run.v1";

type PersistedRun = {
  run: DiagnosisRun;
  savedAt: string;
};

export function loadRun(): PersistedRun | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedRun;
  } catch {
    return null;
  }
}

export function saveRun(run: DiagnosisRun): void {
  if (typeof window === "undefined") return;
  try {
    const persisted: PersistedRun = { run, savedAt: new Date().toISOString() };
    window.localStorage.setItem(KEY, JSON.stringify(persisted));
  } catch {
    // localStorage may be full or disabled — silent fail is correct here, the
    // user just loses persistence for this session.
  }
}

export function clearRun(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
