#!/usr/bin/env node
// READ-ONLY. Summarize WHY coach recorders produced no audio — the ground-truth captured by the capture-blindness
// instrumentation (founder 2026-08-23). Reads the append-only `doorlog.capture_failed` (DoorLog pitch) and
// `coach.capture_failed` (live / meeting / C.A.R.E) events and reports, per surface + device: how often, and the
// DOMINANT cause (mic-track ended/muted, recorder error, backgrounding, no-data), so the specific source fix is
// chosen from data, not assumed. NO writes.
//
// Usage:  node scripts/diag-capture-failures.mjs [repoRoot] [days]
//   repoRoot defaults to "."  · days defaults to 14
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const root = process.argv[2] || ".";
const days = Number(process.argv[3] || 14);
const env = Object.fromEntries(
  readFileSync(`${root}/.env.local`, "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const since = new Date(Date.now() - days * 86400e3).toISOString();
const { data, error } = await sb
  .from("events")
  .select("kind, subject, payload, created_at, company_id")
  .in("kind", ["doorlog.capture_failed", "coach.capture_failed"])
  .gte("created_at", since)
  .order("created_at", { ascending: false });

if (error) { console.log(`query error: ${error.message}`); process.exit(1); }
const rows = data ?? [];
console.log(`\n═══ Capture failures — last ${days}d ═══  (${rows.length} event(s))`);
if (rows.length === 0) {
  console.log("  None recorded. Either capture is healthy on the deployed build, or reps aren't on it yet.");
  process.exit(0);
}

const surfaceOf = (r) => r.payload?.surface || (r.kind === "doorlog.capture_failed" ? "doorlog" : "unknown");
const deviceOf = (ua = "") =>
  /iPhone|iPad|iPod/i.test(ua) ? "iOS" : /Android/i.test(ua) ? "Android" : /Mac/i.test(ua) ? "macOS" : /Windows/i.test(ua) ? "Windows" : "other";
const browserOf = (ua = "") =>
  /CriOS|Chrome/i.test(ua) && !/Edg/i.test(ua) ? "Chrome" : /Edg/i.test(ua) ? "Edge" : /Firefox|FxiOS/i.test(ua) ? "Firefox" : /Safari/i.test(ua) ? "Safari" : "other";
// The primary cause, most-specific first — this is the signal that names the fix.
const causeOf = (p = {}) => {
  if (p.trackEnded) return "mic-track ENDED (screen-lock / phone call / another app took the mic)";
  if (p.trackMuted) return "mic-track MUTED (suspended — pocket/lock/background)";
  if (p.recorderError) return `recorder error: ${p.recorderError}`;
  if (p.hiddenDuringRecording > 0) return "tab BACKGROUNDED during recording (iOS suspends audio)";
  if (p.sawData === false && (p.durationMs ?? 0) > 0) return "no data (mic delivered nothing, no track/recorder signal)";
  return "unknown (none of the tracked signals fired)";
};
const tally = (arr, keyFn) => {
  const m = new Map();
  for (const x of arr) { const k = keyFn(x); m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
};
const pct = (n) => `${Math.round((n / rows.length) * 100)}%`;

console.log("\n── by surface ──");
for (const [s, n] of tally(rows, surfaceOf)) console.log(`  ${String(s).padEnd(9)} ${String(n).padStart(4)}  (${pct(n)})`);

console.log("\n── dominant cause (all surfaces) ──");
for (const [c, n] of tally(rows, (r) => causeOf(r.payload))) console.log(`  ${String(n).padStart(4)}  ${c}`);

console.log("\n── by surface × cause ──");
for (const [s] of tally(rows, surfaceOf)) {
  const sub = rows.filter((r) => surfaceOf(r) === s);
  console.log(`  ${s} (${sub.length}):`);
  for (const [c, n] of tally(sub, (r) => causeOf(r.payload))) console.log(`      ${String(n).padStart(3)}  ${c}`);
}

console.log("\n── device / browser ──");
for (const [d, n] of tally(rows, (r) => `${deviceOf(r.payload?.ua)} · ${browserOf(r.payload?.ua)}`)) console.log(`  ${String(n).padStart(4)}  ${d}`);

// Contributing factor worth calling out: the wake lock silently not taking (a known iOS Safari gap).
const wakeDenied = rows.filter((r) => r.payload?.wakeLockGranted === false).length;
console.log(`\n── contributing factors ──`);
console.log(`  ${wakeDenied}/${rows.length} (${pct(wakeDenied)}) had the screen wake-lock DENIED (screen can dim/lock → track dies)`);

console.log("\n── 10 most recent ──");
for (const r of rows.slice(0, 10)) {
  const p = r.payload ?? {};
  console.log(
    `  ${r.created_at.slice(5, 16)}  ${surfaceOf(r).padEnd(8)} ${deviceOf(p.ua)}/${browserOf(p.ua)}  ` +
    `dur=${Math.round((p.durationMs ?? 0) / 1000)}s  mime=${p.mimeType || "?"}  → ${causeOf(p)}`,
  );
}
console.log("");
