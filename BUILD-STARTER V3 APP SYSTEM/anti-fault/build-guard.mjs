#!/usr/bin/env node
/**
 * build-guard.mjs — ANTI-FAULT tripwire (a measurement, NOT a gate).
 *
 * Detects the one failure that turned a 6-hour build into an 8-day one: the agent
 * building PROCESS (manifests, gates, self-audit scripts, rule amendments) instead of
 * PRODUCT. It reads git history and flags the exact fingerprints of that failure.
 *
 * Run it by hand — as the owner, or (in autonomous mode) have the agent run it at the
 * start of each session and REPORT the verdict. Reporting is fine; gating on it is not
 * (a mandatory self-gate is the very disease this treats — see 03-ANTI-FAULT.md).
 *
 *   node "anti-fault/build-guard.mjs"        # last 60 commits
 *   node "anti-fault/build-guard.mjs" 30     # last 30
 *
 * Exits 0 always (it is a smoke alarm, not a lock). No dependencies. Needs git + node.
 */
import { execSync } from 'node:child_process'
import fs from 'node:fs'

const N = Math.max(1, parseInt(process.argv[2] || '60', 10) || 60)

const sh = (cmd) => {
  try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) } catch { return '' }
}
if (!sh('git rev-parse --is-inside-work-tree').trim()) {
  console.error('build-guard: not a git repo (run it from the project root).'); process.exit(0)
}

// Anything under these paths counts as PRODUCT. Everything else is process/docs/config.
// App source (Expo/React Native): app/ (expo-router), screens, components, navigation,
// hooks, lib, constants, assets, native modules, and the ios/android native projects.
const PRODUCT = /^(app|src|screens|components|navigation|hooks|lib|constants|modules|assets|ios|android)\//i
// Governing docs — must be READ-ONLY during a build.
// NB: CLAUDE.md is deliberately NOT here. It's a project working file that
// installers legitimately append to (e.g. design-system install), so matching it
// produced a false RED on every such commit. The real constitution files below
// are what must stay untouched.
const GOVERNING = /(THINKX\d|CONSTITUTION|ThinkerThinker|WebThinker|00-START-HERE|01-CONSTITUTION|02-DEPLOYMENT|03-ANTI-FAULT|BUILD-STARTER|BUILD-PROTOCOL|BUILD STRUCTURE PLAN|BUILD-SEQUENCE|ANTI-FAULT)/i
// Rule-amendment sprawl.
const AMENDMENT = /(^|\/)amendments\/|(^|\/)AMD-\d+/i
// Self-policing script sprawl.
const POLICE = /scripts\/.*(audit|verify|gate|assert|assurance|check-)/i
// Tracking-doc bloat.
const TRACKER = /(manifest|residual|tracker|status|_open|\bopen)\.?.*\.md$/i

const commits = sh(`git log -n ${N} --format=%H`).split('\n').map((s) => s.trim()).filter(Boolean)
if (!commits.length) { console.log('build-guard: no commits yet — nothing to measure.'); process.exit(0) }

let productCommits = 0
const govHits = new Set(), amdHits = new Set(), policeHits = new Set()

for (const c of commits) {
  const files = sh(`git show --name-only --format= ${c}`).split('\n').map((s) => s.trim()).filter(Boolean)
  if (files.some((f) => PRODUCT.test(f))) productCommits++
  for (const f of files) {
    if (GOVERNING.test(f)) govHits.add(f)
    if (AMENDMENT.test(f)) amdHits.add(f)
    if (POLICE.test(f)) policeHits.add(f)
  }
}

// Tracking-doc bloat in the working tree.
const bloated = sh('git ls-files').split('\n').map((s) => s.trim()).filter((f) => TRACKER.test(f))
  .map((f) => { let n = 0; try { n = fs.readFileSync(f, 'utf8').split('\n').length } catch {} return { f, n } })
  .filter((x) => x.n > 300)

const productPct = Math.round((productCommits / commits.length) * 100)

const red = [], yellow = []
if (productPct < 50) red.push(`Only ${productPct}% of the last ${commits.length} commits touched product code (src/app/public/…). Over half produced no product — you are building bureaucracy.`)
if (govHits.size) red.push(`Governing docs were MODIFIED (they are read-only law): ${[...govHits].join(', ')}`)
if (amdHits.size) red.push(`Rule-amendment files appeared (agents don't amend the rules mid-build): ${[...amdHits].slice(0, 6).join(', ')}${amdHits.size > 6 ? ' …' : ''}`)
for (const b of bloated) red.push(`Tracking doc is bloated (${b.n} lines > 300): ${b.f}. A manifest is a checklist, not a codebase.`)
if (policeHits.size > 3) yellow.push(`${policeHits.size} self-audit/gate/verify scripts touched — don't build a compliance department: ${[...policeHits].slice(0, 5).join(', ')}${policeHits.size > 5 ? ' …' : ''}`)

const bar = '─'.repeat(64)
console.log(`\n${bar}\nANTI-FAULT build-guard — last ${commits.length} commits\n${bar}`)
console.log(`  product-touching commits : ${productCommits}/${commits.length} (${productPct}%)   [want ≥ 50%]`)
console.log(`  governing docs modified  : ${govHits.size}     [want 0]`)
console.log(`  amendment files appeared : ${amdHits.size}     [want 0]`)
console.log(`  tracking docs > 300 lines: ${bloated.length}     [want 0]`)
console.log(`  self-audit scripts touched: ${policeHits.size}    [want ≤ 3]`)
console.log(bar)

if (red.length) {
  console.log('\n🔴 RED — you are building PROCESS instead of PRODUCT. This is the failure. STOP and pivot to the product:')
  red.forEach((m) => console.log('   • ' + m))
} else if (yellow.length) {
  console.log('\n🟡 YELLOW — watch it:')
  yellow.forEach((m) => console.log('   • ' + m))
} else {
  console.log('\n🟢 GREEN — effort is going into the product. Keep building.')
}
console.log('\n(smoke alarm, not a lock — exits 0. See 03-ANTI-FAULT.md.)\n')
process.exit(0)
