# CLOSURE — C.A.R.E "AI & Personality" tab (comprehensive settings, pillar 1)

## 1. Session-read manifest

13 entries in think.md (this-session read_at). Clauses: CLAUDE.md §0, §0.1, §1.5.1, §1.5.2, §6;
ThinkerThinker.md A19, A22, A24, A28, A30, A31, A34, A38.

## 2. Build inventory (reachability per A31)

| Element | write path | read path | status |
|---|---|---|---|
| AI persona (name/product/tone/length) | AI page → tenant PATCH (4 keys only) | tenant columns → Jeff's system prompt | BUILT |
| Guidance panel | JeffGuidancePanel → tenant PATCH | mapper → Jeff's prompt block | BUILT (moved) |
| Knowledge panel | ACMS documents endpoint | active knowledge version | BUILT (moved) |
| Discoverability | SettingsTabs[0] + landing CARDS[0] | user lands → sees "AI & Personality" | BUILT |
| Widget de-dup | Widget Save drops the 4 AI keys | — | BUILT (disjoint) |

## 3. Verification record (A38)

```
> npx tsc --noEmit -p tsconfig.json
  (new AI page compiles; trimmed Widget page compiles — no dangling refs)
TSC_EXIT=0
```

`npm run check` (full chain incl. tbc gates + tests) runs in the commit's pre-commit hook.

## 4. Un-named reliance (the half people skip)

This build RELIES on `/api/care/agent/tenant` applying a PARTIAL patch (only keys present in the body).
If that endpoint were ever changed to a full-row overwrite, the two disjoint Saves would start clobbering
each other (Widget save would null the persona). That reliance is now load-bearing and un-obvious — noted
here so a future change to the tenant PATCH knows it must stay partial.

## 5. Residuals (A36)

```json
[
  {
    "id": "RES-2026-07-30-CARE-AI-01",
    "item": "Live browser render of the new AI & Personality tab is not exercised (needs an authed session I can't drive).",
    "why_skipped": "Requires a running deployment + real login.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-07-30T12:20:00Z",
    "outcome": "OPENED — the founder's whole report was invisibility, so the live click-through IS the confirmation. Static proof: tsc 0, the tab + card are wired, the page loads config + saves the 4 fields. Founder step: open C.A.R.E → Settings → 'AI & Personality' (now the first tab/card) and confirm the panels render + save."
  },
  {
    "id": "RES-2026-07-30-CARE-AI-02",
    "item": "Only pillar 1 of the comprehensive settings system is built; the remaining C.A.R.E sections (General, Notifications, Data & Privacy, Learning/Experience integration) and the entire Sales-Coach comprehensive settings are NOT built.",
    "why_skipped": "Scope; founder approved the full spec and the build proceeds pillar-by-pillar.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-07-30T12:20:00Z",
    "outcome": "OPENED — tracked in docs/BUILD-STATE.md + the session todo list. This is the bulk of the founder's request; pillar 1 is the first, most discoverability-critical slice."
  }
]
```

## 6. Hypothesis outcomes

- **H1** (disjoint Saves → no clobber) — CONFIRMED (typecheck; keys removed from Widget, only 4 in AI page).
- **H2** (dedicated tab + card fixes discoverability) — CONFIRMED structurally (first tab + first card).
- **H3** (self-contained panels move without change) — CONFIRMED (own endpoints, unchanged).

## 7. Doc hashes

- CLAUDE.md — `e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f`
- ThinkerThinker.md — `0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc`
