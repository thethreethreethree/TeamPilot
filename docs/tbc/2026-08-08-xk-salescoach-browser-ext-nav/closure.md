# CLOSURE — Sales Coach "Browser extension" nav entry

## What shipped
The Sales Coach left sidebar now has a persistent "Browser extension" nav item (puzzle icon → the sales
download/install page, new tab), mirroring the C.A.R.E sidebar entry the founder pointed at. Locked by a
detection guard so the parity can't be dropped again. Desktop sidebar only (browser extension is desktop-only).
This corrects a first-pass miss: the extension surfacing was delivered as inline page cards, not the nav item
the founder's "similar to C.A.R.E" instruction meant.

## Un-named-reliance check
The nav entry + its render are runtime-UNPROVEN here (client component, no DOM in the node test env) — same
accepted posture as the rest of the shell (the file header already says "UNTESTED at runtime"; founder confirms
live). The guard tests SOURCE, so it proves the entry/href/external are PRESENT, not that the browser renders
the sidebar correctly. That reliance is named: the founder should confirm the item appears + opens the download
page (it will show for every Sales Coach user; typecheck is clean; the render mirrors C.A.R.E's working pattern
byte-for-byte on the external branch).

## Residuals
```json
[
  {
    "id": "R1-runtime-unproven-render",
    "item": "The sidebar render of the new external nav item is not browser-confirmed in this build (no DOM render in the node env).",
    "why_skipped": "The shell is a client component and the whole file is runtime-unproven by existing posture; the fix mirrors C.A.R.E's live external-link render exactly (target=_blank/rel=noopener), and typecheck is clean.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-08T04:52:00Z",
    "outcome": "OPENED and resolved: the external-render branch is copied from CareShell's working entry (same `<Link>` + target/rel spread), so it inherits a live-proven render path; typecheck is clean; and the source guard proves the entry is wired. The only unproven step is pixels-on-screen, which the founder confirms live (they raised this feature, so they'll see it immediately). Bounded: worst case is a cosmetic nav-item issue the founder reports in one look, not a broken path."
  }
]
```
