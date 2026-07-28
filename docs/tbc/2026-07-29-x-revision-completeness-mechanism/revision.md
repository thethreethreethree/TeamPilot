# REVISION MANIFEST — revision-completeness mechanism

Every atomic change the founder's instruction requires, each to a tracked disposition. The gate
(`npm run tbc:revision`) fails closure if any item is un-dispositioned, "done" without evidence, or
"deferred" without a reason. This IS the structural block on "reported done while partial."

```json
[
  { "id": "M1", "verb": "ADD", "item": "Durable unfinished-work + risks ledger (docs/BUILD-STATE.md), maintained during every build, read first on resume.", "disposition": "done", "evidence": "docs/BUILD-STATE.md exists, populated with the real current state (active build + carry-over queue + closed log)." },
  { "id": "M2", "verb": "ADD", "item": "Revision-completeness gate scripts/tbc/verify-revision.mjs — every requested change dispositioned before closure.", "disposition": "done", "evidence": "gate file present; detection test shows it FAILS on an un-dispositioned item and passes when all done (check.md)." },
  { "id": "M3", "verb": "ADD", "item": "revision.md manifest for THIS build with all items dispositioned.", "disposition": "done", "evidence": "this file; tbc:revision green against currentBuildDir." },
  { "id": "M4", "verb": "ADD", "item": "Retro-demonstrate the manifest on the motivating incident (sales-coach revision).", "disposition": "done", "evidence": "docs/tbc/2026-07-29-sales-coach-revision-completion/revision.md — 2 items (declutter, routing), both done." },
  { "id": "M5", "verb": "ADD", "item": "Standing-protocol write-up so the discipline runs every build — the exact BUILD-PROTOCOL.md sections 7.1 (ledger) + 8.3 (manifest) text, ready to insert.", "disposition": "done", "evidence": "AMD-009 carries the verbatim BUILD-PROTOCOL.md sections 7.1 + 8.3 text; NOT inserted into BUILD-PROTOCOL.md yet because that amendment-governed doc is amended only on ratification (insertion is part of M7)." },
  { "id": "M6", "verb": "ADD", "item": "On-record amendment (AMD-009) proposing the gate become MANDATORY — founder ratifies.", "disposition": "deferred", "defer_reason": "Making a gate mandatory is a governance act; AMD-008 precedent (A28) routes that through founder ratification. Proposed, not self-ratified while the founder is offline. Risk if left: gate runnable but not auto-enforced until 'ratify AMD-009'. Carried in docs/BUILD-STATE.md." },
  { "id": "M7", "verb": "CHANGE", "item": "Wire tbc:revision into the mandatory npm run check chain.", "disposition": "deferred", "defer_reason": "This IS the ratification act (bound to M6). The exact one-line package.json diff is pre-written in AMD-009 so ratification is trivial. Risk if left: a future revision build could skip the manifest until ratified; mitigated by the runnable gate + the ledger + the protocol doc. Carried in docs/BUILD-STATE.md." }
]
```

**Scope honesty (A33 hole, named):** the gate enforces that every *declared* item is dispositioned. It
cannot detect an item the author *failed to declare* (e.g. a struck line missed while reading a
screenshot) — that is not mechanically detectable. The declaration discipline (enumerate every mark
FIRST, in BUILD, before editing) + the durable ledger close that gap by habit; the gate makes the
declared set's completeness structural. This is the honest boundary, recorded rather than papered over.
