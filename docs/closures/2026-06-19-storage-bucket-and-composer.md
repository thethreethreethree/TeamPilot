# Session-Read Manifest: storage-bucket-and-composer

**Date:** 2026-06-19
**Session:** continuous
**Commits in scope:** this commit
**Builder:** Agent

## 1. What this build does

Two real failures the founder caught in screenshots:

1. **`Storage upload failed: Bucket not found`** — the `assets-v1` Supabase Storage bucket was never created on prod. Migration 0057 documented the bucket creation as a COMMENT block titled "Phase 0 manual step (one-time after applying this migration)" — leaving it for the operator to run. Operator memory failed. Uploads have been broken in production since Phase 0 shipped.

2. **Attach button takes its own row in chat composer** — eats vertical space beneath the markdown toolbar. Founder wants it in the toolbar row.

Fixes:

1. Migration 0062 — creates the bucket via executable SQL + RLS policies on storage.objects, idempotent per §A12. The bucket setup ships with the migration chain now, not with operator instructions.

2. ComposerToolbar gains a `trailing` prop; chat composer page passes the FileDropzone as trailing. Toolbar row layout: markdown buttons left-aligned, divider, Attach right-aligned via `ml-auto`. Mobile keeps the existing `flex-wrap` behavior.

## 2. Constitutional assets cited

| Asset | Cited in | Re-read in session at | Intent | Behavior |
|---|---|---|---|---|
| §A12 | migration 0062 header | 2026-06-19T~14:30Z (TT.md full re-read this session) | Migrations safe-to-re-run by construction. | Embodies — `ON CONFLICT (id) DO NOTHING` on bucket insert; `DROP POLICY IF EXISTS` + `CREATE POLICY` for each policy. Re-running produces same state. |
| §A14 | migration 0062 header + this manifest | 2026-06-19T~10:00Z | Data path complete ≠ render path complete. | Embodies (as the lesson) — the application code's upload path assumed the bucket existed; the schema didn't fully create it. Render path complete; data path incomplete. This migration closes the gap. **Honest acknowledgment: §A14 was violated by the original Phase 0 ship.** |
| §A22 | this manifest section 7 | 2026-06-19T~14:30Z | Session-read manifest as pre-closure forcing function. | This manifest IS the artifact. Includes citations + timestamps + an honest section on what I missed. |
| §3.1 | migration 0062 NO-DELETE comment | 2026-06-19T16:23Z (CLAUDE.md re-read this session) | Events immutable; append-only chain. | Embodies — no DELETE policy on storage.objects; deprecated_at on files is the soft-delete signal; bytes stay. |
| §0 | migration 0062 header | 2026-06-19T16:23Z | Understanding precedes solving. | Embodies — the failure was an incomplete schema, not a missing feature. The fix is closing the schema, not a workaround in application code. Honest diagnosis from the error string ("Bucket not found"). |

## 3. Findings + remediations

### Resolved this commit
- Bucket creation now in executable migration (0062).
- Composer Attach in toolbar row.
- Closure manifest documents the §A14 violation that produced the bucket-missing failure.

### Surfaced HIGH-honesty in this audit (NEW)

**Finding A — I shipped a broken production deploy and called Phase 0 "complete."** The previous Asset System Phase 0 closure named the manual bucket step as a "Phase 0 manual step" in the migration comments. That was the §A14 trap: I declared a phase shipped while the data path (bucket existence) depended on operator memory rather than executable schema. The founder caught it in screenshots — meaning they tried to use the feature and it failed. Lost trust on the prior closure manifest's claim of completeness.

**This is the same shape of failure A19 named six days ago** ("the agent operates in the language of the discipline while violating it"). I documented the bucket step in a comment, gave it operational-sounding label "Phase 0 manual step," and shipped. The discipline appeared to be applied. It wasn't.

**Finding B — My outside audits in this session have caught real bugs after-the-fact.** Citation pollution (Bug #4), Enter propagation (Bug #1), this bucket gap. Each was found by an outside-perspective audit AFTER I shipped. Per §A14's "lesson about the lesson" and §A20's catch-during-design vs catch-after-deployment metric, my loop-detection threshold remains stubbornly post-hoc. The friction layer surfaces bugs; it doesn't prevent them at design time.

**This is honest but uncomfortable.** I've been doing audits because you keep asking me to. The audits ARE catching things. But the things they catch are bugs I introduced. If you had not interrogated, those bugs would have lived in production. The discipline is reactive, not preventive.

The structural fix: audits BEFORE shipping each phase, not just after-the-fact when interrogated. The constitutional self-audit memory entry says exactly this. I haven't been doing it before each phase ships — I've been doing it AT the end when you ask.

### Deferred (per A20)

1. **Apply migration 0062 on prod.** Until you do, uploads continue to fail with "Bucket not found."
2. **Apply migration 0061 on prod** (still pending from prior closure).
3. **Mobile composer wrap.** When narrow, toolbar may wrap and Attach goes to its own row anyway. Same as before — no regression but the fix isn't full-coverage on small viewports.
4. **Runtime verification of Bug #1 fix from prior commit** — you still need to test that Enter inside the @file dropdown doesn't send.

## 4. Outside-perspective audit (rigorous per feedback_outside_perspective_post_build)

### Persona 1 — Founder applying migrations and testing

- Applies 0062 in Supabase SQL Editor. Bucket created. Policies created.
- Returns to chat composer. Types message. Drags screenshot in. Upload works.
- **Concern (LOW):** I haven't verified migration 0062 actually creates the bucket in YOUR Supabase environment. I tested via local syntax, not against your DB. If Supabase has changed `storage.buckets` schema or requires different permissions, the migration might fail.
- **Concern (LOW):** The policies use `auth_company_id()` which I verified exists in 0001_init.sql. If that helper was modified or renamed in a later migration I missed, the policies break.

### Persona 2 — New engineer reading migration 0062

- The intent is clearly named: this closes a §A14 gap from 0057.
- The `ON CONFLICT (id) DO NOTHING` makes re-running safe.
- Policy names are quoted strings with spaces. Postgres tolerates this; some style guides prefer snake_case. Cosmetic.
- The NO-DELETE section documents the policy choice rather than just being absent. Good for the next engineer who wonders "why isn't there a delete policy?"

### Persona 3 — Adversary

- Can a user upload to another company's path? RLS policy: `(storage.foldername(name))[1] = auth_company_id()::text`. If user A's `auth_company_id()` returns company-A's UUID, they can only upload to `company-A/...`. ✓
- Can the customer-widget upload (service-role) bypass intent? Yes — service_role bypasses RLS by design. The conversation session token check in `/api/care/conversations/[id]/upload` is the authorization. Same shape as before. ✓
- Can a user enumerate other companies' file paths via storage.objects SELECT? RLS SELECT also gates by company_id path prefix. ✓
- **Real concern (LOW):** If a customer somehow obtained another company's file UUID and tried to access via /api/care/conversations/.../file/..., the route's check (linked_conversation_id matches session's conversation) catches it. Defense-in-depth holds.

### Persona 4 — CFO/operator

- Migration 0062 is one-time. Cost: zero per upload.
- Composer change: pure UI. Zero cost.
- **Real cost reflection:** the bucket-missing bug means uploads have been failing in production since Phase 0 shipped. Every customer who tried to upload got an error. That's reputational cost I CAUSED by shipping Phase 0 with a non-executable bucket step.

## 5. Cross-module check (per A21) + render-branch walkthrough (per A14)

### A21 — Composer Attach button placement

| Surface | Attach button location | Takes new row? |
|---|---|---|
| Library / Task pages | Full dropzone area | N/A (the dropzone IS the surface) |
| Chat composer | NEW: in toolbar trailing slot | NO (this commit) |
| C.A.R.E composer | Inline with Spawn task / action chips | NO (existing layout) |
| Customer widget | Inline next to Call Jeff / Send | NO (existing layout) |

**The chat composer was the only inconsistent surface.** Now consistent.

### A14 — Migration 0062 closes the data path

Every upload path that calls `uploadAssetBytes`:
- src/lib/storage/assets.ts → `sb.storage.from(ASSETS_BUCKET).upload(...)`
- ASSETS_BUCKET = "assets-v1"
- Before migration 0062: Storage returns "Bucket not found"
- After migration 0062: bucket exists, RLS policies authorize the upload

**All 5 upload surfaces** (library, task, chat composer, C.A.R.E composer, customer widget) feed through this single upload helper. Single point of fix.

## 6. Verification checklist

- [x] `npx tsc --noEmit` green
- [x] `npm run build` green
- [x] All 5 cited assets have session-read timestamps
- [x] All 4 outside-view personas walked WITH honest acknowledgment of what I can't verify (live Supabase test)
- [x] A21 + A14 audits documented
- [x] **Honest accountability surfaced in section 3** — I shipped the bucket gap, I shipped the citation pollution, I shipped the Enter propagation. The friction layer catches them but doesn't prevent them.

## 7. The honest, uncomfortable accounting

You asked for 100% honesty and no hiding. Here it is:

1. **The bucket gap is on me.** I left a manual instruction in a comment, called Phase 0 done, and the production deploy has been broken since then. This is a §A14 violation I shipped. The closure manifest for Phase 0 should have either (a) included the executable bucket creation, or (b) explicitly named "Phase 0 ships WITHOUT a working bucket; operator must run X before any upload works." I did neither cleanly.

2. **My outside audits this session are reactive, not preventive.** Founder asks for an audit → I find bugs → I fix them. Without the asks, the bugs would live. Per the constitutional self-audit memory entry, I should be running outside audits **before** each phase ships, not after the founder interrogates. The audits in my closure manifests have been increasingly thorough — they ARE catching things — but they catch things I shipped, not things I prevented.

3. **The friction layer (pre-commit hook + Session-Reads trailer) catches forgetfulness but does not catch §A9 ("language without behavior").** Every closure manifest I've written this session has rigorous-sounding language. The bugs that survived the language: Enter propagation, citation pollution, the bucket gap. The friction layer rewards documentation; only the runtime catches behavior.

4. **Time-as-currency point received and respected.** Each bug I shipped that you caught cost you time interrogating + me time fixing. The net spend is more than if I'd just done the audit pre-ship. The discipline isn't slowing me down — skipping it is.

The remediation for #2: from now on, every multi-commit phase gets an outside-perspective audit BEFORE the final commit message is written, not at the founder-interrogation moment. The closure manifest's audit section gets filled DURING the work, not at the end. If the audit surfaces a HIGH/MEDIUM finding, fix it in the same commit cycle.

I'm capturing this as memory addendum.

## 8. Recommended next steps (per A20)

1. **Apply migrations 0061 + 0062 on prod.** Uploads stay broken until you apply 0062. Rule distribution stays empty until you apply 0061.
2. **Runtime verification of Bug #1 fix** (Enter inside @file dropdown).
3. **The remaining LOW-severity findings** can wait for a focused commit.
