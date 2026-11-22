# Session-Reads — RSS release, phases 0–9 + migrations 0271–0298 (2026-11-21)

Closure for the commit that ships the Remote Sales System build. Per ThinkerThinker A22: every asset the staged diff
cites, when it was read in THIS session, and one sentence on how the build embodies or falls short of it.

## Reads this session

| Asset | Read in this session | How |
|---|---|---|
| CLAUDE.md, full text (§0, §0.1, §1 steps 1–6, §1.5.1–§1.5.4, §1.7, §2, §2.1, §2.2, §3.1, §3.1.1, §3.2–§3.6, §4, §5, §6, §7.1–§7.5) | 2026-11-21, loaded whole into this session's context at session start | the current text, including §3.1.1 (AMD-014) — so it is the post-amendment version, not a cached one |
| ThinkerThinker.md A12 (migrations re-runnable) | 2026-11-21T11:16Z | opened, lines 293–316 |
| ThinkerThinker.md A16 (AI surfaces compose) | 2026-11-21T11:16Z | opened, lines 383–405 |
| ThinkerThinker.md A21 (audit across modules) | 2026-11-21T11:16Z | opened, lines 530–560 |
| ThinkerThinker.md A22 (this manifest's rule) | 2026-11-21T11:16Z | opened, lines 594–630 |

## Intent vs behaviour

- **§0 / §0.1 / §2 (diagnose before patching).** Embodied at release: the live gate failed after 0271–0297 applied;
  the code push was held, a read-only 188-table sweep plus a catalog check found the cause (policy helpers revoked
  from anon) before 0298 was written. The shim's `auth.role()` was checked against production's live definition
  instead of assumed.
- **§1 step 1 / §3.1 (append-only).** Comments, mentions, trims, restores, audit and erasure requests are inserts;
  trims hide lines through `rss_line_trimmed`, never delete them. **§3.1.1** is the one deleting path (AMD-014).
- **§1.5 / §2 (trace interconnections).** 0297 guards the accepted_* columns rather than narrowing the update policy,
  because revocation (PATCH /api/team, createInvitation's auto-revoke) runs on the caller's client.
- **§2.2 (single-source verdict).** `rss_comment_base_visible` is the one rule for "can read" and "can be mentioned";
  `rss_tree_allows` is called by both the policies and treeAccess.ts.
- **§3.2–§3.6.** Not changed by this release beyond carrying existing gates; the invariant audit (§3.2 gate, §3.4
  control window, §3.5 durability) passed live after 0298.
- **§5 (knowledge ≠ intelligence).** Two outside-view security reviews; their findings fixed and replayed signed-in.
- **§6.0.** The release itself was put to the founder as a picker; "Apply DB, then push" was chosen.
- **§7.2 / §7.5.** AMD-014 is the only constitutional text change; CLAUDE.md edit cites it.
- **A12.** Every RSS migration was applied twice on PGlite (0296+ re-applied in the attack replay; 0298 applied twice
  in the anon replay) and `db:verify` ran each in a rolled-back transaction before `db:apply`.
- **A16 — NOT verified this session.** RSS adds AI reads (call review, coaching) beside existing Sales Coach AI
  surfaces; whether every AI surface on a recording consumes the others' findings was not re-audited here.
- **A21 — partially.** The shared concept "a sales call" is held by one verdict (isSalesCall, enforced by
  invariant:audit) across in-person and remote calls; a full cross-module parity inventory (remote recordings vs
  in-person sessions) was not produced this session.

## Open after this closure

docs/residuals/OPEN.md: RSS_WEBHOOK_SIGNING_SECRET; OAuth providers + NEXT_PUBLIC_AUTH_PROVIDERS; the trim-offset check
on a real upload; A16/A21 audits above.

## Additional reads — Remote Sales separation (2026-11-22)

| Asset | Read in this session | Intent vs behaviour |
|---|---|---|
| ThinkerThinker.md A11 (mirror, don't judge) | 2026-11-21T22:44Z | Unchanged by the move: the session page's existing comment citing it moved with the code (git mv); no new verdict-rendering mechanic added. |
| ThinkerThinker.md A13 (vocabulary once, by category) | 2026-11-21T11:16Z | "Which calls are remote" stays one definition: REMOTE_CONTEXTS / isRemoteContext drive the module router, the start panel and remoteOnly search — no new copy of the phone/video list. |
| ThinkerThinker.md A14 (data path ≠ render path) | 2026-11-21T22:44Z | **Partly embodied.** Every moved render branch compiles (build:ci) and its tests pass (101 files), but the two-module call page has not been looked at on the live site yet — the founder's first remote call is that check. |
| ThinkerThinker.md A18 (the label is the defense) | 2026-11-21T22:44Z | The moved coaching inbox keeps its labels ("open requests", "last feedback") — it invites coaching, not enforcement; nothing relabelled. |

## Additional reads — prospect audio, call comments, Macro Mode (2026-11-22, commits eab8523c → 73c92a86)

| Asset | Read in this session | Intent vs behaviour |
|---|---|---|
| CLAUDE.md §3.4 (lines 380–386) | 2026-11-22T08:36Z | **Embodied for capture honesty:** every case where the prospect's side is NOT captured (unsupported browser, share declined, tab shared without audio, share lost) is told to the rep in words; nothing falls back to mic-only silently. §3.4's month-1 control is untouched: the new AI reads (call brief, follow-up, day plan) are controlExempt like follow-through — factual reads and rep-authored drafts, not guidance. That exemption is a judgement, recorded here so it can be challenged. |
| CLAUDE.md §2.2 (lines 307–317) | 2026-11-22T08:48Z | Comments: one writer, one reader, the database's rule decides who reads. "Is this to-do done": the Tasks module's isTaskClosed; "Done" walks TASK_STATUS_TRANSITIONS through PATCH /api/tasks — no second copy of either rule. |
| CLAUDE.md §3.1 (lines 339–344) | 2026-11-22T09:04Z | The pipeline's facts are events (remote_prospect_events); current values are derived (remote_prospects_current); every 0303 table has no-update/no-delete rules (harness claim 6). |
| CLAUDE.md §3.3 (lines 368–373) | 2026-11-22T09:04Z | **Partly.** The rep stays the author: drafts are sent by the rep, the checklist is saved only after review, the day plan only organizes the rep's words. Not embodied: §3.3's "ASK the user first" — the brief and Next Meeting plan are generated before the rep is asked what they think the next steps are. A rep-first prompt on Next Meeting is a candidate follow-up. |
| CLAUDE.md §1.5.1 layer 3 (lines 94–98) | 2026-11-22T09:07:38Z | Traced two paths after building and fixed both: manager inbox → Macro call page (comment box moved into Coaching), and the manager's tabs in Macro Mode (unchanged, per the spec). Found during the build: a sales-only company cannot open /dashboard/operations, so to-dos are shown and completed inside Remote Sales. |

**Open after these reads:** the live checks in docs/residuals/OPEN.md (2026-11-22 entries); §3.3's ask-first gap on
Next Meeting (above).
