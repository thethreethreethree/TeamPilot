---
tbc_version: 1
trigger: fix
started_at: 2026-08-14T10:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 13
hypotheses: 1
---

# THINK — "Active" account must truly enable ALL AI (open the gate + advance the stage)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) in-tree, hashes verified. Cited amendments read in
ThinkerThinker.md this session; CLAUDE.md §§ in-context.

## 2. Why (founder 2026-08-14, confirmed against the code)
Founder is flipping pilot accounts to ACTIVE in the CRM and asked: "make sure that when I hit active account they
are actually active and all AI system features are available and functional." Reading the code: the CRM
subscription PATCH (`updateSubscription`) changes only the billing `status`; NO CRM path touches
`companies.ai_guidance_enabled` (the §3.4 control-window gate) or the account `lifecycle_stage`. So an account
flipped to "active" still had the AI gate CLOSED for any NON-`controlExempt` (diagnostic) AI, and its stage still
read "control month" — the account looked active while the AI baseline gate stayed on. (Sales Coach engines are
all `controlExempt`, so Sales Coach AI worked regardless — but "all AI features" did not.)

## 3. The fix
`activateAccountGuidance(accountId)` (service-role, in `src/lib/crm/data.ts`): on a status→active PATCH it
(1) opens the AI gate — `companies.ai_guidance_enabled=true` (+ `_at` timestamp), and (2) advances the account
`lifecycle_stage` out of `control_month`/`trial` to `activated`. The subscription PATCH route calls it when
`status === "active"`.

## 4. Interconnections traced (§1.5)
- The 0111 guard freezes `ai_guidance_*` against non-leadership writers but PASSES service-role / definer
  contexts untouched (0111 lines 37-41) — so the CRM's service-role client can legitimately open the gate. This
  is a DELIBERATE vendor override of the §3.4 control window (the vendor admin activating the account), analogous
  to the leadership `/api/brain/unlock`; it is ON THE RECORD via the lifecycle-change event (0049 trigger) + the
  `ai_guidance_enabled_at` timestamp.
- Never DOWNGRADES a further-along stage — only advances a baseline (`control_month`/`trial`) stage, so a
  `paying` account isn't reset.
- Billing honesty (§3.4) is untouched: `crm_accounts.billing_status` stays `not_collecting`; the subscription
  `active` status is documented as "would be paying if collection were on" (0049:137) — no false claim of billing.
- Best-effort after the subscription save: a guidance-open failure logs but doesn't fail the (already-saved)
  status change.

## 5. Hypothesis (§1.5.2)
- **H1 — does setting an account active now open the AI gate AND advance the stage (without downgrading a
  further-along one)?** Yes — activateAccount test: control_month → ai_guidance_enabled=true + stage 'activated';
  a 'paying' account still opens the gate but its stage is NOT changed.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-14T10:00:30Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand from the record — read the CRM subscription route + the control-gate + the 0111 guard before wiring the AI gate to the activate action.", "how_this_build_will_embody_it": "Confirmed no CRM path touched ai_guidance + that the 0111 guard passes service-role before adding the enable." },
  { "id": "§0.1", "read_at": "2026-08-14T10:00:45Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified; amendments read in-session." },
  { "id": "§1.2", "read_at": "2026-08-14T10:01:00Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective identification — the seeded/imported companies are already 'activated'/'active'; a redeemed pilot should reach the same state when activated.", "how_this_build_will_embody_it": "Advance the pilot to the SAME stage the imported companies were seeded at (0049:345-353), and open the gate the leadership unlock opens." },
  { "id": "§1.5", "read_at": "2026-08-14T10:01:30Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — the change touches the control-window gate + the CRM stage + must not break billing honesty, the 0111 guard, or downgrade an advanced account.", "how_this_build_will_embody_it": "Section 4: service-role passes the guard, billing_status untouched, no stage downgrade, on-record override." },
  { "id": "§1.5.1", "read_at": "2026-08-14T10:02:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer-2 effectivity — 'active' that leaves AI gated is a feature that looks done but isn't; the seam between the billing status and the AI gate is exactly where it silently broke.", "how_this_build_will_embody_it": "Active now wires the gate + the stage so the account is functionally active, not just labelled." },
  { "id": "§1.5.2", "read_at": "2026-08-14T10:02:30Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-verify: the missing wiring was hypothesised, CONFIRMED by grepping that no CRM path sets ai_guidance before fixing.", "how_this_build_will_embody_it": "H1 gated by the activateAccount test." },
  { "id": "§3.4", "read_at": "2026-08-14T10:03:00Z", "source_file": "CLAUDE.md", "line_range": "244-260", "why_it_governs": "The control window IS §3.4; opening it early is a constitutional override that must be DELIBERATE + on the record, and billing must stay honest (not_collecting).", "how_this_build_will_embody_it": "A vendor-admin-gated deliberate override, recorded via the lifecycle event + timestamp; billing_status stays not_collecting; the subscription 'active' makes no false paying claim." },
  { "id": "§6", "read_at": "2026-08-14T10:03:30Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — trace ripple (the guard, billing honesty, stage downgrade, best-effort ordering).", "how_this_build_will_embody_it": "All enumerated in Section 4." },
  { "id": "A19", "read_at": "2026-08-14T10:04:00Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Consult the in-tree code before changing it.", "how_this_build_will_embody_it": "Read the route, the CRM data layer, unlockControlGate, the 0111 guard, and the CRM enums before editing." },
  { "id": "A22", "read_at": "2026-08-14T10:04:30Z", "source_file": "ThinkerThinker.md", "line_range": "592-605", "why_it_governs": "Citations require in-session reading.", "how_this_build_will_embody_it": "Amendments read in ThinkerThinker.md this session." },
  { "id": "A26", "read_at": "2026-08-14T10:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "689-694", "why_it_governs": "The 'route-gated but the seam-left-open' class — the subscription status changed but the gate it implies didn't. Sweep the seam.", "how_this_build_will_embody_it": "Wired BOTH consequences of activation (gate + stage), not just the billing status the button obviously changed." },
  { "id": "A30", "read_at": "2026-08-14T10:05:30Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Encode the lesson in a gate.", "how_this_build_will_embody_it": "activateAccount test locks: active → ai_guidance_enabled + stage advanced; a further-along stage isn't downgraded." },
  { "id": "A38", "read_at": "2026-08-14T10:06:00Z", "source_file": "ThinkerThinker.md", "line_range": "999-1006", "why_it_governs": "'Verified' = the canonical command + output.", "how_this_build_will_embody_it": "closure.md pastes `npm run check` + exit 0." }
]
```
