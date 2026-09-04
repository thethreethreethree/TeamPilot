---
started_at: 2026-09-04T09:05:00+08:00
---

# THINK — a manager can delete a recording

## Why this exists

Writing the privacy policy this morning surfaced a fact nobody in this project had: **the product has no way to
delete a specific recording.** Not for a representative, not for a manager, not for an administrator. The only
removal is `recording-purge-cron`, which deletes on its own schedule and takes no requests.

The founder had described the policy as *"an agent can't delete their own, only managers and admins."* That
described a control that does not exist. This build makes the half of it that grants a capability true.

The other half — that a representative cannot exempt their own recording — is **not** built here, and the reason is
in §What is deliberately out of scope.

## Understanding (§0)

Read today, not recalled:

- `src/app/api/coach/sales-session/` — swept for a `DELETE` handler or a delete route. There is none; the only
  match for "DELETE" is a test file's name.
- `save-recording/route.ts:16` — authorises the OWNING REP **or** a manager. So a rep can already exempt their own
  recording from the nightly purge indefinitely. That is more control than the founder's description implies, in
  the opposite direction from the one they were worried about.
- `recording-purge-cron/route.ts:90-138` — the only code in the repository that deletes recording bytes, and it
  carries a comment explaining the one branch that makes deletion dangerous.

**That branch is the reason this build is shaped the way it is.** `storage.remove()` on a path that does not exist
returns **no error**. So a deleter that guesses wrongly at the shape of `audio_asset_url` removes nothing, nulls
the column, and reports success — while a recording of a real customer conversation survives forever,
unreferenced, unfindable, and beyond the reach of the job whose pointer just vanished.

## What could go wrong, before searching (§1.5.2)

Three hypotheses, written before looking:

1. **There is already a delete somewhere and I would duplicate it.** Searched: there is not.
2. **Deleting the audio would take the transcript and the scores with it.** It must not — they are what a rep's
   skill profile is built from, and removing them would silently rewrite months of somebody's measured progress.
   Confirmed the purge cron takes the same view, and this build copies it.
3. **The removal logic would end up in two places.** This was the real risk and it was correct. Extracting it was
   the first thing built, and the cron now calls the extraction — proven safe by the cron's own nine tests, which
   were written before this refactor existed and pass unchanged.

## The four layers (§1.5.1)

1. **Structure.** One helper owns removal; two callers use it. The dangerous branch exists once and is unit-tested
   against a fake storage client, which it could never have been while it lived inside a cron handler.
2. **Operational.** A manager can remove one recording, and the audit is that the bytes go before the pointer —
   every failure path leaves the row untouched, so a failed delete is a delete that did not happen rather than a
   recording nothing can find.
3. **The person.** Two people. The manager who needs a customer's recording gone, and the representative who is
   deliberately NOT given this power, because a rep who could delete their own worst call could curate what their
   manager sees. That asymmetry is the founder's rule and it is the one part of this that is a policy rather than
   an engineering choice.
4. **Finish.** The refusal names who *can* do it, rather than a bare "not allowed" that leaves a rep nowhere.

## What is deliberately out of scope (§3.2.1)

- **No web control.** This is the endpoint. Putting a Delete button on the session view is a separate change with
  its own confirmation design, and a destructive control shipped without one is worse than none.
- **`save-recording` is untouched.** Restricting it to managers would REMOVE a capability representatives have
  today, in the week the mobile app is being submitted. That is a founder decision, is on their board, and is not
  mine to take by editing an authz line.
- **No twelve-month retention cap.** Recommended to the founder this morning, not chosen by them, not built.

## Session-read manifest (§3.1.2 / A22 / A35)

Read in this session. The timestamps are from `date -Iseconds` runs in this same working session, before this
build's file edits.

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-04T09:18:00+08:00",
    "why_it_governs": "Understanding precedes solving, and the capability being built exists precisely because a claim about this codebase was asserted without earning it.",
    "how_this_build_will_embody_it": "The purge cron was read line by line before anything was written, and its dangerous branch is what shaped the design." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-09-04T09:18:00+08:00",
    "why_it_governs": "It requires the governing documents to be in the tree and read in THIS session rather than recalled from a previous one.",
    "how_this_build_will_embody_it": "Every range here was opened today in this session." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-09-04T09:18:00+08:00",
    "why_it_governs": "It is the parent of the four-layer gate, and this build is a user-facing capability, so the gate applies before anything is written.",
    "how_this_build_will_embody_it": "Walked above; layer 3 is where the authz asymmetry is justified." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-09-04T09:18:00+08:00",
    "why_it_governs": "Four layers, foundation up, before any user-facing capability — and layer one here is a structural extraction, not the endpoint.",
    "how_this_build_will_embody_it": "Walked, foundation up, with the structural extraction as layer 1." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-152", "read_at": "2026-09-04T09:18:00+08:00",
    "why_it_governs": "It requires hypotheses formed BEFORE searching, so the search confirms or denies rather than wandering.",
    "how_this_build_will_embody_it": "Three hypotheses written before searching; the third was right and changed the shape of the build." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-452", "read_at": "2026-09-04T09:18:00+08:00",
    "why_it_governs": "Its item 4 asks whether a constraint is real or incidental, which is exactly the question the rep exclusion turns on.",
    "how_this_build_will_embody_it": "Named as the founder's rule and pinned by a test that states the reason." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-468", "read_at": "2026-09-04T09:18:00+08:00",
    "why_it_governs": "The failure this asset names is citing a methodology's labels without its content, and this build's whole reason for existing is a claim about the codebase that was made without opening the file.",
    "how_this_build_will_embody_it": "Every behaviour claimed here is cited to the file and line implementing it." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-606", "read_at": "2026-09-04T09:18:00+08:00",
    "why_it_governs": "Citations without session-reading operate undetected, and this build cites heavily; the trailer would otherwise buy credit for reading I had not done.",
    "how_this_build_will_embody_it": "This manifest's timestamps are this session's own reads." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-04T09:18:00+08:00",
    "why_it_governs": "A lesson kept only in prose returns, and the false-ok deletion is a lesson this codebase already paid for once inside the cron's loop body.",
    "how_this_build_will_embody_it": "The lesson is now a tested module rather than a comment in a loop body, and two mutations prove the tests catch its removal." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1010", "read_at": "2026-09-04T09:18:00+08:00",
    "why_it_governs": "It forbids reporting 'verified' from a recipe I invented; the temptation here was to run only the new tests and not the project's gate.",
    "how_this_build_will_embody_it": "check.md pastes npm run check with its exit code, plus the cron's own pre-existing tests run against the refactor." },
  { "id": "§3.1", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "93-97", "read_at": "2026-09-04T09:18:00+08:00",
    "why_it_governs": "It says THINK cannot be skipped and produces think.md before any file is edited — the clause this build actually broke.",
    "how_this_build_will_embody_it": "Honestly: the helper was extracted first and this document written after. Recorded as a finding rather than backdated." },
  { "id": "§3.1.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "119-160", "read_at": "2026-09-04T09:18:00+08:00",
    "why_it_governs": "It defines the manifest below and requires read_at to fall inside THIS session, which is the clause an agent citing from memory silently fails.",
    "how_this_build_will_embody_it": "Every timestamp here comes from a date -Iseconds run in this same working session, and the minimum set is present whether or not the prose quotes it." },
  { "id": "§3.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "219-222", "read_at": "2026-09-04T09:18:00+08:00",
    "why_it_governs": "It requires building the specification as written rather than the improved version I might prefer.",
    "how_this_build_will_embody_it": "build.md names both what was built and the three things deliberately left out." },
  { "id": "§3.2.1", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "223-228", "read_at": "2026-09-04T09:18:00+08:00",
    "why_it_governs": "Deviating from the request is a violation unless flagged BEFORE acting, and only half the founder's stated rule is implemented here.",
    "how_this_build_will_embody_it": "Only half of the founder's stated policy is implemented, and the other half is flagged here with its reason rather than done silently." },
  { "id": "§3.2.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "229-262", "read_at": "2026-09-04T09:18:00+08:00",
    "why_it_governs": "It replaces a file inventory with a reachability claim, which is the question this build most needed asking of itself.",
    "how_this_build_will_embody_it": "build.md states plainly that no UI reaches this endpoint yet — the honest answer to a reachability question, and the reason it is not finished." },
  { "id": "§3.2.3", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "263-292", "read_at": "2026-09-04T09:18:00+08:00",
    "why_it_governs": "It defines 'verified' as the canonical command by name, with its output pasted.",
    "how_this_build_will_embody_it": "check.md leads with the canonical gate." },
  { "id": "§3.3", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "294-297", "read_at": "2026-09-04T09:18:00+08:00",
    "why_it_governs": "It requires the audit to run against the built artifact rather than against what I meant to build.",
    "how_this_build_will_embody_it": "The audit ran against the committed route and helper, and against the cron's own tests." },
  { "id": "§3.3.1", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "298-301", "read_at": "2026-09-04T09:18:00+08:00",
    "why_it_governs": "It forbids auditing from memory; every behavioural claim must cite the path and line it was read from.",
    "how_this_build_will_embody_it": "Line-cited throughout." },
  { "id": "§3.3.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "304-313", "read_at": "2026-09-04T09:18:00+08:00",
    "why_it_governs": "A CHECK with no cross-module pass is incomplete, and 'removing a recording' means three different things across two repositories.",
    "how_this_build_will_embody_it": "'Removing a recording' inventoried across the cron, this route, the mobile app's local delete and the privacy page." },
  { "id": "§3.3.3", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "314-330", "read_at": "2026-09-04T09:18:00+08:00",
    "why_it_governs": "It requires the class named by its ROOT shape and the sweep boundary recorded as a command someone else can re-run.",
    "how_this_build_will_embody_it": "The class is 'a mutation that reports success without asserting the effect landed'. Swept with a recorded command." },
  { "id": "§3.3.4", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "331-345", "read_at": "2026-09-04T09:18:00+08:00",
    "why_it_governs": "It asks, per fix, whether the fix is a gate or a promise, and refuses prose as the only defence.",
    "how_this_build_will_embody_it": "A gate, and it is proven: two mutations, both CAUGHT, recorded in check.md." },
  { "id": "§3.3.5", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "347-352", "read_at": "2026-09-04T09:18:00+08:00",
    "why_it_governs": "It forbids a clean bill of health for anything not inspected, and the live storage path here was never exercised.",
    "how_this_build_will_embody_it": "The endpoint has never been called against a live Supabase project. Named, and carried into the residual." },
  { "id": "§4", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "418-457", "read_at": "2026-09-04T09:18:00+08:00",
    "why_it_governs": "The residual is a queue read from the top of the confidence ranking, not a list of disclaimers appended at the end.",
    "how_this_build_will_embody_it": "The high-confidence entry is opened before closure." }
]
```
