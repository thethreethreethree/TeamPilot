# CHECK — C.A.R.E "AI & Personality" tab audit

Audited from the outside-view stance.

## Within-module pass (four layers)

- **1 structure:** reuses the existing tenant-config endpoint, the Section component, DocUploadButton, and
  the two self-contained panels (A28). One new page; no new pattern, no schema, no migration.
- **2 effectivity:** the page loads config, edits the 4 persona fields, and saves them via the existing
  PATCH; typecheck 0. The persona still reaches Jeff's prompt (read path untouched).
- **3 composition:** the AI page groups the persona + guidance + knowledge that were scattered/buried; the
  Widget tab keeps embed/appearance/branding/channels/voice. The two Saves are disjoint (see below).
- **4 surface:** first tab + first landing card = the discoverability fix. The card copy names what's
  inside ("name, tone, product knowledge, guidance, facts it answers from").

## Cross-module pass

- **Save-clobber seam (the risk):** confirmed the Widget Save body no longer sends the 4 AI keys and the
  AI page sends ONLY those 4. `/api/care/agent/tenant` applies a partial patch (`if (body.x !== undefined)`),
  so the disjoint sets can't overwrite each other. A Widget save no longer touches persona; an AI save no
  longer touches appearance.
- **Dead-surface check (A31):** the tab is linked from both SettingsTabs and the landing grid; the page
  renders + saves; the panels retain their own working endpoints. Not schema-only.

## Class sweep (A26)

- class: a moved field left half-wired on the OLD page (stale editable control that no longer saves).
  sweep: `grep -n "ai_name\|ai_product_context\|ai_tone\|ai_response_length\|productContextManagedInCode\|
  DocUploadButton\|JeffGuidancePanel\|AdaptiveKnowledgePanel" widget/page.tsx` → only the TenantConfig TYPE
  fields remain (data shape, fine); no editable control, no Save key, no import references them. Clean.

## Findings

No findings. Additive new page + a clean removal on Widget; typecheck-clean; the one real risk
(save-clobber) is closed by construction (disjoint patch sets). (remediate.md omitted.)

## Inspected / not-inspected

- **Inspected:** the new page's load/draft/save, the SettingsTabs + landing card wiring, the full Widget
  trim (section, panels, save keys, state, imports), tsc.
- **NOT inspected (→ residual):** live browser render of the new tab (needs an authed session I can't drive);
  whether the founder wants the OTHER comprehensive sections (General, Notifications, Data, etc.) in this
  exact shape — those are the remaining pillars, tracked separately.
