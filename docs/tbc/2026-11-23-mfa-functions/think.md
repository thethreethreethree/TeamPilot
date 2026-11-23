---
started_at: 2026-11-23T08:42:00Z
trigger: MFA build residual R2 (docs/tbc/2026-11-23-mfa/closure.md; OPEN.md "128 SECURITY DEFINER functions callable by authenticated are outside the database rule"), under the founder's standing "keep building everything in the list".
doc_integrity:
  CLAUDE.md: 2be659e5431e
  ThinkerThinker.md: e5226c44665f
---

# THINK - Multi-factor sign-in for owner-rights functions

## The record

- Production, read 2026-11-23: 128 SECURITY DEFINER functions in public executable by authenticated — 46 triggers, 14
  used in policies, 68 callable over REST (60 fin_*, plus accept_invitation, gamification_leaderboard, pilot codes,
  record_brain_learning, rss_tree_filter, run_task_overrun_sweep, …).
- authenticator had no pgrst.db_pre_request; postgres may alter authenticator.
- MFA-exempt paths (sign-in, code step, health) make no .rpc() calls (grep).

## Outside view

Editing 68 bodies risks breaking finance; a central hook risks breaking everything. The hook is safer only if it
cannot fail for anyone it isn't meant for, and if it is proven loaded rather than assumed.

## Design

0315: public.rss_pre_request() — set x-rss-guard: 1; if request.path is /rpc/* AND current_user is authenticated AND
not rss_mfa_ok() → raise 42501 "Enter the code…". alter role authenticator set pgrst.db_pre_request; notify pgrst.
Live invariant 33; HTTP probe before/after.

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-14",
    "read_at": "2026-11-23T09:01:12Z",
    "why_it_governs": "Understand before building: the 128 owner-rights functions were listed from production with return type, policy use and app callers before choosing an approach.",
    "how_this_build_will_embody_it": "46 triggers and 14 policy helpers set aside; the 68 callable ones (60 finance) are what the hook covers."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-26",
    "read_at": "2026-11-23T09:01:12Z",
    "why_it_governs": "The methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md sections printed by line this session at 2026-11-23T00:15:03Z."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-80",
    "read_at": "2026-11-23T09:01:12Z",
    "why_it_governs": "Layer 2: multi-factor sign-in that a direct function call can skip does not work.",
    "how_this_build_will_embody_it": "Refused with a clear message for a held session; the code screen still renders (tables keep 0309's 0-rows rule)."
  },
  {
    "id": "§1.5",
    "source_file": "CLAUDE.md",
    "line_range": "69-74",
    "read_at": "2026-11-23T09:01:12Z",
    "why_it_governs": "Holistic: a pre-request hook runs before EVERY API request, so a fault there would break the whole site.",
    "how_this_build_will_embody_it": "Narrowed to signed-in /rpc calls; replayed for six caller kinds; production grants checked; live API probed before and after."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-143",
    "read_at": "2026-11-23T09:01:12Z",
    "why_it_governs": "Look past the task: the local test showed the service role failing — a production outage if real.",
    "how_this_build_will_embody_it": "Production privileges were read (all three roles can use auth.jwt); the hook was narrowed anyway so it never depends on them."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-176",
    "read_at": "2026-11-23T09:01:12Z",
    "why_it_governs": "PostgREST must actually load the hook — config the repo can't see.",
    "how_this_build_will_embody_it": "Proven from outside: the live API now returns x-rss-guard: 1; a live invariant checks the role setting."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-311",
    "read_at": "2026-11-23T09:01:12Z",
    "why_it_governs": "One rule for 'must pass a code first'.",
    "how_this_build_will_embody_it": "The hook calls rss_mfa_ok(), the same function 0309's policies use."
  },
  {
    "id": "§3.1",
    "source_file": "CLAUDE.md",
    "line_range": "339-343",
    "read_at": "2026-11-23T09:01:12Z",
    "why_it_governs": "A security hook must not become a write path.",
    "how_this_build_will_embody_it": "It writes nothing; it only sets a response header and may refuse."
  },
  {
    "id": "§3.1.1",
    "source_file": "CLAUDE.md",
    "line_range": "347-351",
    "read_at": "2026-11-23T09:01:12Z",
    "why_it_governs": "Legal erasure is the one deletion exception.",
    "how_this_build_will_embody_it": "Not touched."
  },
  {
    "id": "§3.3",
    "source_file": "CLAUDE.md",
    "line_range": "368-372",
    "read_at": "2026-11-23T09:01:12Z",
    "why_it_governs": "A refusal should say what to do, not just block.",
    "how_this_build_will_embody_it": "The message says to enter the code from the authenticator app."
  },
  {
    "id": "§3.4",
    "source_file": "CLAUDE.md",
    "line_range": "380-384",
    "read_at": "2026-11-23T09:01:12Z",
    "why_it_governs": "Honesty: the MFA closure said functions were outside the rule; that must not be left true and unsaid.",
    "how_this_build_will_embody_it": "R2 is closed on the record with the live proof."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "450-454",
    "read_at": "2026-11-23T09:01:12Z",
    "why_it_governs": "Checklist item 0: decisions go to the founder as pickers.",
    "how_this_build_will_embody_it": "No decision: this completes the MFA build the founder chose."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-460",
    "read_at": "2026-11-23T09:01:12Z",
    "why_it_governs": "Methodology in the working tree, consulted, not remembered.",
    "how_this_build_will_embody_it": "Assets printed by line this session."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-599",
    "read_at": "2026-11-23T09:01:12Z",
    "why_it_governs": "No citation without a session read.",
    "how_this_build_will_embody_it": "Every id in this manifest was printed this session at the line range given."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-775",
    "read_at": "2026-11-23T09:01:12Z",
    "why_it_governs": "A lesson in prose returns; the class needs a gate.",
    "how_this_build_will_embody_it": "Live invariant 33 fails if the hook is removed or stops checking the rule."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1006",
    "read_at": "2026-11-23T09:01:12Z",
    "why_it_governs": "A verification claim is a claim about a command that was run.",
    "how_this_build_will_embody_it": "check.md pastes each command's output and exit code."
  }
]
```
