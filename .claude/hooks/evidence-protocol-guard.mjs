#!/usr/bin/env node
// ============================================================================
// evidence-protocol-guard.mjs — docs/EVIDENCEPROTOCOL.md, made operational.
//
// UserPromptSubmit hook. Runs before the agent reads the owner's message.
//
// ─── WHY THIS EXISTS, AND WHOSE FAILURE IT IS ──────────────────────────────
//
// On 2026-09-04 the owner said: examine every file, every image, every pixel.
// The agent reported the folder as examined. It had read `design-values.md`
// (28KB, a summary) and never opened `design-values.json` (1.47MB, the 59 raw
// records it summarises). It had read the 48 image FILENAMES and presented
// `Four_models_arranged_in_row → SHAPE-05` as a mapping it had observed.
//
// Neither was a lie. The summary genuinely felt sufficient, and the filename
// genuinely suggested the mapping. That is exactly why the protocol exists and
// why it does not ask for diligence:
//
//     Never ask "did you read X." Require an output that is impossible to
//     produce without having read X.
//
// ─── WHY IT SCANS RATHER THAN LECTURES ─────────────────────────────────────
//
// A hook that only re-prints seven rules is a poster on a wall. The two named
// failures — SUMMARY SUBSTITUTION and FILENAME INFERENCE — are both detectable
// from the working tree, so this names the specific pairs and the specific
// counts every turn:
//
//   · a `X.json` beside a `X.md` is a source/summary pair, and the .md does
//     not discharge the .json
//   · a directory of N images requires N described lines, and the hook says N
//
// The agent then cannot claim a folder is read without the numbers disagreeing
// with it in the same context window.
//
// ─── WHY IT ADVISES AND DOES NOT BLOCK ─────────────────────────────────────
//
// `03-ANTI-FAULT.md` is explicit that arming a second blocking gate beside the
// autonomous Stop-gate produces "two independent reasons you cannot stop —
// the exact can't-stop-and-can't-satisfy trap that produces churn and
// fabricated fixes". HARD MODE is already one. So this one has no state, no
// score, nothing to make green. It states what is in scope and gets out of the
// way, which is also why it can never become the bureaucracy that document
// was written against.
//
// It fails OPEN. A hook that breaks the session because a directory moved is a
// hook someone deletes.
// ============================================================================
import fs from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const PROTOCOL = 'docs/EVIDENCEPROTOCOL.md'

/* Directories worth scanning for evidence. Deliberately a short explicit list
   rather than a walk of the whole repo: this runs on EVERY prompt, and a hook
   that costs a second is a hook that gets turned off. */
// TeamPilot/Elostate layout: graphics live FLAT in public/ (logos, icons, OG images), not public/img.
// Kept to public/ only — this runs on every prompt and docs/ here is thousands of .md files (TBC dirs) with
// no image/data sets to count, so scanning it would just cost time. If source material to examine is dropped
// somewhere else (a design export, an asset folder), add that directory here so the guard can see the set.
const SCAN = ['public']

const IMAGE = /\.(png|jpe?g|webp|avif|gif|svg)$/i
const RAW = /\.(json|csv|ndjson|xml|sql)$/i

const exists = (p) => {
  try {
    return fs.existsSync(path.join(ROOT, p))
  } catch {
    return false
  }
}

/* Shallow walk, capped. Depth 3 reaches `docs/wix.com-2026-09-04/desktop`,
   which is where the pair that caused this lives. The cap is what keeps the
   cost bounded on a repo that grows. */
const walk = (dir, depth = 0, out = []) => {
  if (depth > 3 || out.length > 4000) return out
  let entries
  try {
    entries = fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })
  } catch {
    return out
  }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const rel = `${dir}/${e.name}`
    if (e.isDirectory()) walk(rel, depth + 1, out)
    else out.push(rel)
  }
  return out
}

const size = (p) => {
  try {
    return fs.statSync(path.join(ROOT, p)).size
  } catch {
    return 0
  }
}

const kb = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)}MB` : `${Math.round(n / 1024)}KB`)

const lines = []
const say = (s = '') => lines.push(s)

if (!exists(PROTOCOL)) {
  /* The precondition gate from CLAUDE.md §0.1: a methodology cited from memory
     rather than from the tree is the failure it was written to stop. */
  say('EVIDENCE PROTOCOL — governing document NOT IN THE TREE')
  say(`  Expected: ${PROTOCOL}`)
  say('  Do not cite its rules from memory. Say it is missing and ask.')
  process.stdout.write(lines.join('\n') + '\n')
  process.exit(0)
}

const files = SCAN.filter(exists).flatMap((d) => walk(d))

/* ── SUMMARY SUBSTITUTION ────────────────────────────────────────────────────
 * A raw file and a same-stemmed markdown beside it. Rule 2: reading the .md
 * counts as reading the .md. Both are in scope, and the pair is named here so
 * the agent cannot discover only the convenient half. */
const pairs = []
for (const f of files) {
  if (!RAW.test(f)) continue
  const stem = f.replace(/\.[^.]+$/, '')
  const md = `${stem}.md`
  if (files.includes(md)) pairs.push({ raw: f, summary: md })
}

/* ── FILENAME INFERENCE ──────────────────────────────────────────────────────
 * Any directory holding several images. Rule 3: N files require N described
 * lines, and a filename is not a description. The COUNT is the proof. */
const byDir = new Map()
for (const f of files) {
  if (!IMAGE.test(f)) continue
  const d = path.posix.dirname(f)
  byDir.set(d, (byDir.get(d) ?? 0) + 1)
}
const imageDirs = [...byDir.entries()].filter(([, n]) => n >= 5).sort((a, b) => b[1] - a[1])

say('═══ EVIDENCE PROTOCOL — in force (docs/EVIDENCEPROTOCOL.md) ═══')
say()
say('  Never ask "did you read X." Produce an output impossible to make')
say('  without having read X. Reading is Phase 0 and its artefact is EVIDENCE.md.')
say()
say('  R1  EVIDENCE.md first: path · bytes · opened · A FACT FROM INSIDE.')
say('      "contains design tokens" is the filename talking. A hex from')
say('      record 34 is not.')
say('  R2  A summary NEVER discharges its source. Both are in scope.')
say('      Structured data: cite 3 records by index/key, different fields.')
say('  R3  Images: one line PER IMAGE — subject, any text visible and what')
say('      it says, near-duplicates. Describing from a filename is forbidden')
say('      and is a named failure mode, not an oversight.')
say('  R4  "Live site" means visiting it. Cite one thing present live and')
say('      ABSENT from every capture — a hover state, a DOM value, a banner.')
say('  R5  Every report ends "Not opened:" — a list, or the word none.')
say('      Never absent. Silence is how skipped files disappear.')
say('  R6  Label claims [OBSERVED] / [INFERRED] / [ASSUMED] at the point of')
say('      use. Unmarked reads as OBSERVED and must survive a spot-check.')
say('  R7  Reading is gated. No design, planning or code until approved.')

if (pairs.length) {
  say()
  say('  ── SOURCE/SUMMARY PAIRS FOUND IN THE TREE (R2) ──')
  say('     The .md does NOT discharge the raw file beside it.')
  for (const p of pairs.slice(0, 8)) {
    say(`     MUST OPEN  ${p.raw}  (${kb(size(p.raw))})`)
    say(`       summary  ${p.summary}  (${kb(size(p.summary))}) — does not substitute`)
  }
}

if (imageDirs.length) {
  say()
  say('  ── IMAGE SETS IN THE TREE (R3) ──')
  say('     N files means N described lines. The count is the proof.')
  for (const [d, n] of imageDirs.slice(0, 6)) {
    say(`     ${String(n).padStart(4)} images   ${d}`)
  }
}

say()
if (exists('EVIDENCE.md')) {
  say(`  EVIDENCE.md present (${kb(size('EVIDENCE.md'))}). Keep it current; a stale`)
  say('  manifest is worse than none, because it is read instead of the files.')
} else {
  say('  EVIDENCE.md is NOT present. If this turn involves examining source')
  say('  material, that manifest is the first deliverable and it comes before')
  say('  analysis, planning or code.')
}
say()
say('  The spot-check is three items the owner picks, not the three you quoted.')
say('═══════════════════════════════════════════════════════════════')

process.stdout.write(lines.join('\n') + '\n')
process.exit(0)
