// Website-vs-app PARITY RUN (mobile plan, Phase 3 step 1: "Parity test first").
//
// Loads the website's original and the app's hand copy of each shared module, runs both on the same inputs,
// and prints how many agree. A difference is a FINDING: the two products already disagree. Which side is
// right is decided before anything moves (by the founder where it is product behaviour).
//
// Lives in docs/ beside its results, not in scripts/, because nothing can run it in CI yet: it needs the
// app's files on the same machine. After Phase 1 (the app in this repo under mobile/) it becomes a CI test.
//
// Run from the website repo root (so `pg` and `jiti` resolve):
//   APP_SRC=C:/path/to/Elostate-Sales-coach/src node docs/mobile-parity/web-vs-app.parity.mjs
// It reads production transcripts READ-ONLY (a `begin read only` transaction) and prints counts only.
import jitiPkg from "jiti";
const createJiti = jitiPkg;
import { readFileSync } from "node:fs";
import pg from "pg";

const WEB = new URL("../../src", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const APP = process.env.APP_SRC ?? "C:/Users/johns/IOS-APP/Elostate-Sales-coach/src";
const webJ = createJiti(import.meta.url, { alias: { "@": WEB, "server-only": WEB + "/../__mocks__/server-only.ts" }, interopDefault: true });
const appJ = createJiti(import.meta.url, { alias: { "@": APP }, interopDefault: true });

const results = [];
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function report(name, total, diffs, sample) {
  results.push({ name, total, diffs, sample });
  console.log(`${diffs === 0 ? "SAME" : "DIFF"}  ${name}: ${total - diffs}/${total} agree${diffs ? "  e.g. " + JSON.stringify(sample).slice(0, 300) : ""}`);
}

// 1. Constants
const webScore = webJ(WEB + "/lib/coach/doorlog/scoreLabels.ts");
const appMetrics = appJ(APP + "/lib/doors/metrics-view.ts");
report("SCORE_ORDER", 1, eq(webScore.SCORE_ORDER, appMetrics.SCORE_ORDER) ? 0 : 1, [webScore.SCORE_ORDER, appMetrics.SCORE_ORDER]);
{
  const keys = [...new Set([...Object.keys(webScore.SCORE_LABEL), ...Object.keys(appMetrics.SCORE_LABEL)])];
  const bad = keys.filter((k) => webScore.SCORE_LABEL[k] !== appMetrics.SCORE_LABEL[k]);
  report("SCORE_LABEL", keys.length, bad.length, bad.map((k) => [k, webScore.SCORE_LABEL[k], appMetrics.SCORE_LABEL[k]]));
}
const webCal = webJ(WEB + "/lib/coach/gamification/calibration.ts");
const appCal = appJ(APP + "/lib/gamification/calibration.ts");
report("JUDGED_DIMENSIONS", 1, eq(webCal.JUDGED_DIMENSIONS, appCal.JUDGED_DIMENSIONS) ? 0 : 1, null);
report("calibration threshold", 1, webCal.CALIBRATION_THRESHOLD === appCal.TRUST_THRESHOLD ? 0 : 1, [webCal.CALIBRATION_THRESHOLD, appCal.TRUST_THRESHOLD]);
{
  // The trust verdict on the same mean, across the boundary.
  const means = [0, 0.5, 1.4, 1.5, 1.51, 1.6, 2, 9.9, null];
  const bad = means.filter((m) => {
    const w = m === null ? null : m <= webCal.CALIBRATION_THRESHOLD;
    const a = m === null ? false : appCal.dimensionTrustworthy(m);
    return m !== null && w !== a;
  });
  report("trust verdict at the boundary", means.length - 1, bad.length, bad);
}
const webRoles = webJ(WEB + "/lib/roles.ts");
const appScope = appJ(APP + "/lib/kpi-scope.ts");
report("company-scope roles", 1, eq([...webRoles.ADMIN_ROLES], [...appScope.COMPANY_SCOPE_ROLES]) ? 0 : 1, [webRoles.ADMIN_ROLES, appScope.COMPANY_SCOPE_ROLES]);

// 2. detectF0 over synthetic voices: sines and harmonic-rich tones, 60-450 Hz, two sample rates, with noise.
const webPitch = webJ(WEB + "/lib/coach/v5/pitchSeparation.ts");
const appPitch = appJ(APP + "/lib/voice/pitch.ts");
report("MIN_F0/MAX_F0", 1, webPitch.MIN_F0 === appPitch.MIN_F0 && webPitch.MAX_F0 === appPitch.MAX_F0 ? 0 : 1, null);
{
  let total = 0; const bad = [];
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) - 0.5;
  for (const sr of [16000, 44100]) {
    for (let f = 60; f <= 450; f += 7) {
      for (const amp of [0, 0.002, 0.05, 0.4]) {
        for (const noise of [0, 0.05]) {
          const n = 2048, frame = new Float32Array(n);
          for (let i = 0; i < n; i++) {
            const t = i / sr;
            frame[i] = amp * (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(4 * Math.PI * f * t) + 0.25 * Math.sin(6 * Math.PI * f * t)) + noise * rnd();
          }
          total++;
          const w = webPitch.detectF0(frame, sr), a = appPitch.detectF0(frame, sr);
          const same = (w === null && a === null) || (w !== null && a !== null && Math.abs(w - a) < 1e-9);
          if (!same) bad.push({ sr, f, amp, noise, web: w, app: a });
        }
      }
    }
  }
  report("detectF0 on synthetic voices", total, bad.length, bad.slice(0, 3));
}

// 3. Speech presence: every real transcript in production (read-only), plus edge cases.
const webSp = webJ(WEB + "/lib/coach/doorlog/speechPresence.ts");
const appSp = appJ(APP + "/lib/audio/speech-presence.ts");
{
  for (const l of readFileSync(".env.local", "utf8").split(/\r?\n/)) { const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, ""); }
  const cs = process.env.SUPABASE_DB_URL || `postgresql://postgres:${encodeURIComponent(process.env.SUPABASE_DB_PASSWORD)}@db.${process.env.SUPABASE_PROJECT_REF}.supabase.co:5432/postgres`;
  const c = new pg.Client({ connectionString: cs, ssl: { rejectUnauthorized: false } });
  await c.connect(); await c.query("begin read only");
  const a = await c.query("select text from pitch_transcripts");
  const b = await c.query("select text from coaching_transcript_segments where speaker = 'agent' limit 5000");
  await c.query("rollback"); await c.end();
  const edge = ["", null, undefined, "   ", "[clicking]", "(laughs)", "*sighs*", "[pause] hello", "¿Qué?", "123", "—", "[a] (b) *c*", "hi [x", "Привет", "你好", "[music] [applause]"];
  const inputs = [...a.rows.map((r) => r.text), ...b.rows.map((r) => r.text), ...edge];
  const bad = inputs.filter((t) => webSp.transcriptHasSpeech(t) !== appSp.hasSpeech(t));
  report(`speech presence (${a.rowCount} pitch transcripts, ${b.rowCount} rep lines, ${edge.length} edge cases)`, inputs.length, bad.length, bad.slice(0, 3).map((t) => String(t).slice(0, 40)));
  const noSpeech = a.rows.filter((r) => !webSp.transcriptHasSpeech(r.text)).length;
  console.log(`      (of the pitch transcripts, ${noSpeech} have no speech by both rules)`);
}

const diffs = results.filter((r) => r.diffs > 0);
console.log(`\n${results.length} comparisons, ${diffs.length} with differences.`);
