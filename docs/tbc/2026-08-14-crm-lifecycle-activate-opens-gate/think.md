---
tbc_version: 1
trigger: fix
started_at: 2026-08-14T14:00:00Z
doc_hashes:
  CLAUDE.md: 4c73f753fa63b5f81fec5731b6dadbabe3d1b95665a121427e38b27372edd5d9
  ThinkerThinker.md: 52857f881adc1ea6e77cf7f76d2ffd475eb34cb0afc6b58f78048c12d5ee0239
manifest_entries: 11
hypotheses: 1
---

# THINK — the SECOND activation seam (lifecycle stage) must open the AI gate too

## 1. Document integrity — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) in-tree, hashes verified. Amendments read this session.

## 2. Why (A26 class sweep of the fix I just shipped)
The subscription-status PATCH now opens the AI gate on status→active. But the founder's ask —
"when I hit active account they are actually active and all AI features available and functional" —
has a SECOND path: `accounts/[id]/route.ts` PATCH lets a vendor admin set `lifecycleStage:"activated"`
DIRECTLY (line 131), and it did NOT open the gate. Worse, that is the MORE LIKELY path: the founder's
own screenshot read "6 accounts in **Control month**" — the LIFECYCLE-STAGE label — so flipping the
stage out of control-month is the control they actually use, and it was the un-wired one. Setting the
subscription status is the other, less-obvious control.

## 3. The fix
In `accounts/[id]/route.ts` PATCH, after `updateAccount`, call `activateAccountGuidance(id)` when
`lifecycleStage` is advanced to a LIVE stage (`activated` or `paying`). Reuses the exact service-role
function the subscription seam uses — the gate-open + no-downgrade behavior is already behaviorally
tested (crm/__tests__/activateAccount.test.ts).

## 4. Interconnections traced (§1.5)
- Same 0111-guard reasoning as the subscription seam: service-role/definer bypasses the freeze, so the
  gate open is legitimate; it is the DELIBERATE vendor override of the control window, on the record via
  the lifecycle-change event (0049 trigger) + `ai_guidance_enabled_at`.
- Ordering: the stage is set by `updateAccount` FIRST, so `activateAccountGuidance`'s internal
  "advance control_month/trial→activated" is a no-op (stage already advanced) — it only opens the gate.
  No double-write, no conflict.
- Only `activated`/`paying` trigger it — NOT `at_risk`/`churned`/`archived` (those are not "make this
  account live" actions). `billing_status` untouched (§3.4 billing honesty preserved).
- Best-effort after the stage save: a gate-open failure logs but doesn't fail the already-saved change.

## 5. Hypothesis (§1.5.2)
- **H1 — before the fix, does setting `lifecycleStage:"activated"` leave the AI gate closed?** YES —
  `[id]/route.ts` only called `updateAccount`; no CRM path from that route touched `ai_guidance_enabled`.
  Confirmed by reading the route + grepping. After the fix, both activation seams reference
  `activateAccountGuidance` (locked by activationOpensGate.coverage.test.ts).

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-14T14:00:30Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand from the record — sweep the sibling activation seam before calling the founder's ask done.", "how_this_build_will_embody_it": "Read both CRM PATCH routes; found the lifecycle path bypassed the gate." },
  { "id": "§0.1", "read_at": "2026-08-14T14:00:45Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified; amendments read in-session." },
  { "id": "§1.5", "read_at": "2026-08-14T14:01:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — reuse the same service-role fn, don't downgrade, keep billing honesty, respect the 0111 guard, correct ordering vs updateAccount.", "how_this_build_will_embody_it": "Section 4 traces all five." },
  { "id": "§1.5.1", "read_at": "2026-08-14T14:01:30Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer-2 effectivity — the feature (active=all AI) looked done after seam #1 but the user's ACTUAL control (stage) still broke it.", "how_this_build_will_embody_it": "Wire the seam the founder actually clicks, not just the tidy one." },
  { "id": "§1.5.2", "read_at": "2026-08-14T14:02:00Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-search: hypothesised the sibling seam, CONFIRMED by reading [id]/route.ts before fixing.", "how_this_build_will_embody_it": "H1 gated by the coverage test." },
  { "id": "§3.4", "read_at": "2026-08-14T14:02:30Z", "source_file": "CLAUDE.md", "line_range": "244-260", "why_it_governs": "Opening the control window is a deliberate vendor override that must stay on the record + keep billing honest.", "how_this_build_will_embody_it": "Vendor-admin gated, recorded via the lifecycle event + timestamp; billing_status stays not_collecting." },
  { "id": "§6", "read_at": "2026-08-14T14:03:00Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — trace ripple (ordering, downgrade, guard, billing).", "how_this_build_will_embody_it": "All enumerated in Section 4." },
  { "id": "A19", "read_at": "2026-08-14T14:03:30Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Consult the in-tree code before changing it.", "how_this_build_will_embody_it": "Read [id]/route.ts, activateAccountGuidance, and the enum before editing." },
  { "id": "A22", "read_at": "2026-08-14T14:04:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-605", "why_it_governs": "Citations require in-session reading.", "how_this_build_will_embody_it": "Amendments read this session." },
  { "id": "A26", "read_at": "2026-08-14T14:04:30Z", "source_file": "ThinkerThinker.md", "line_range": "689-694", "why_it_governs": "The class sweep — the first fix wired ONE activation seam; A26 says sweep for the sibling. This IS that sweep.", "how_this_build_will_embody_it": "Found + wired the second seam; a coverage test now pins BOTH." },
  { "id": "A30", "read_at": "2026-08-14T14:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Encode the lesson in a gate.", "how_this_build_will_embody_it": "activationOpensGate.coverage.test.ts fails CI if any activation seam drops the gate wiring." },
  { "id": "A38", "read_at": "2026-08-14T14:05:30Z", "source_file": "ThinkerThinker.md", "line_range": "999-1006", "why_it_governs": "'Verified' = the canonical command + output.", "how_this_build_will_embody_it": "closure.md pastes `npm run check` + exit code." }
]
```
