# CLOSURE — a quiet undo for a mis-tapped door

## What is true now

A rep who mis-taps a door can take it back for five seconds, on the website today and in the app once it is
released. The knock is never edited: an undo is appended, and every count reads knocks minus undos. Migration
0267 is live on production, and it changed nobody's numbers — raw 1227 = live 1227 = rep_kpi_daily 1227.

On the way, a worse defect: the app's knock queue could erase taps made while it was sending. That fix shipped
on its own, ahead of everything else.

## The finding

**The undo was not the risky part; the counting was.** One undo is one row. Making every place that counts
doors agree about it — nine website files, one SQL view with five readers, and every screen on the phone — is
where it could silently go wrong. The day-target tests passed unchanged when their table was renamed under them,
which is why the rule is now a static gate rather than one more test.

## Residual

```json
[
  {
    "id": "R1-app-release",
    "item": "The app's undo (feat/quiet-undo-door-app) and its queue fix (a7ed7a30) are not on any phone.",
    "why_skipped": "Reaching phones needs an EAS build or update, and the device check.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-29T14:10:00Z",
    "outcome": "OPEN. The queue fix is on the app's main line; the undo branch merges after the website."
  },
  {
    "id": "R2-other-app-stores-unswept",
    "item": "The app's other AsyncStorage stores may share knock-store's unserialised read-then-write shape.",
    "why_skipped": "Found in knock-store while building the undo; the sweep beyond it is its own build.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-29T14:10:00Z",
    "outcome": "OPEN. Recording store and outbox are the next to check."
  },
  {
    "id": "R3-rls-probe-not-in-ci",
    "item": "scripts/sql/probes/0267-door-knock-undos.rls.sql is committed and re-runnable but not wired into CI.",
    "why_skipped": "CI's migration job would need to run probes after the audit.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-29T14:10:00Z",
    "outcome": "OPEN."
  },
  {
    "id": "R4-too-late-after-queued",
    "item": "An undone knock that stays queued past 60 minutes (offline) is refused by the server and removed; the rep was told 'Undone' when they pressed it.",
    "why_skipped": "Rare (offline for an hour right after a tap), and the honest fix needs a persistent notice.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-29T14:10:00Z",
    "outcome": "OPEN."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was touched. Two captures generated and opened.

## Appended 2026-10-01 — R2 (other app stores) swept

All 16 AsyncStorage/SecureStore modules in the app were checked for a read-then-write with nothing
serialising it. Two held data that cannot be recovered, and both reproduced a loss under concurrent writes
(app commit 4858e813, tests/recording-store-concurrency.test.ts and tests/outbox-concurrency.test.ts):

- recording-store: an upload finishing while the next pitch was saved erased one of the two entries.
- outbox: a correction queued between the sweep's re-read and its write was erased.

Both now serialise their storage steps. The other read-then-write stores hold a chat draft, read marks, a
crash note, preferences and an in-flight marker, where a lost update costs a re-type or a repeat notice, not
a call; they are left as they are. R2: CLOSED for the stores that hold irreplaceable data.

## Appended 2026-10-01 — R3 closed

R3-rls-probe-not-in-ci: CLOSED by docs/tbc/2026-10-01-rls-probes-run-in-ci. The probe ends in assertions, and
scripts/migration-apply-audit.mjs PASS 3 runs every probe in CI; a 600-minute window fails it.

## Appended 2026-10-01 — R1 (app release), half done

The app's undo branch was still unmerged on 2026-10-01, so the next phone build would have shipped without it.
Merged into the app's main line as 62b738f5 (gate on the merged line: tsc exit 0, 1585 tests pass, lint exit 0,
tools/gate.mjs exit 0), together with the queue fix a7ed7a30 it was built on. DEVICE-CHECK.md check 42 now
covers it on a phone. Still OPEN: an EAS build and the device check; nothing from this build is on a phone yet.

## Appended 2026-10-01 — build 28

R1-app-release: the undo is in iOS build 28 (commit 04246628), submitted to App Store Connect at 14:16Z
(EAS submission 33c6f5da, status finished). Still OPEN until it is seen working on a phone (DEVICE-CHECK.md
check 42); Apple's processing into TestFlight was not observed from here.

## Residual update (appended 2026-10-08T18:00Z)

- **R1-app-release: still OPEN, narrowed.** The undo and its queue fix are in every TestFlight build since 28 (now
  32, uploaded 2026-10-08 17:56Z). What remains is the phone check (DEVICE-CHECK check 42).
- **R3-rls-probe-not-in-ci: CLOSED.** `.github/workflows/ci.yml` runs `npm run migration:audit` against a
  postgres:16-alpine service (lines 23-27, 115-119), and that audit's PASS 3 runs every file in scripts/sql/probes
  (3 today, this one included) and fails on its assertion block.
