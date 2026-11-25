# CHECK - Name the speakers on a call

## Commands

```
diff 0317 vs 0343 rss_erase_sessions → only the 3 added lines (delete call_speaker_names + its count)
node replay0343.mjs (signed in) → after update+delete: Dana Lee · rep sees: 1 · admin sees: 1 · other company's admin sees: 0 · erasure counts speaker_names: 1 · rows left: 0
npx vitest run speakerNames + route + form + transcript + src/lib/__tests__ → 95 passed (erasureCoverage, hideCoverage included)
npm run invariant:audit → first ✗ 2: manager route writes with the service role without treeAllowsRep; the route's comment named the erasure function → tree check added (tested), comment reworded → Violations: 0
npm run rls:audit → ✗ insert/update/delete → allowlisted (writer named; erasure-aware append-only) → ✓
npm run db:apply → applying 0343_call_speaker_names.sql … ok · ALL 33 invariants hold
```

## Findings

### F1 - a manager outside the tree could name speakers on a call
class: a service-role write gated only on "is a manager".
sweep: treeAllowsRep before a manager's write; caught by the invariant audit.
severity: medium

### F2 - a customer's name would survive legal erasure
class: a new store of personal data outside the erasure function.
sweep: rss_erase_sessions redefined with the delete; erasureCoverage judges the table; replay erased it.
severity: high (designed in)

### F3 - in-person transcripts would ask for names they can't store
class: a shared component gaining a module-specific call.
sweep: opt-in prop, on only for phone/video (tested).
severity: low

## Final

```
npm run check → exit 0 · Test Files 961 passed | 1 skipped · Tests 6920 passed | 15 skipped
```
