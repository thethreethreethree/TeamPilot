---
started_at: 2026-09-04T08:20:34+08:00
---

# THINK — stating the recording retention rule in the privacy policy

## Why this is a build and not a typo

The published privacy policy carries a note, written by me yesterday, saying that how long a recording is kept and
who can delete one **"could not be read out of the code"** and therefore "needs a human decision".

The founder answered the question directly today. Before writing their answer into a legal document I went looking
for the mechanism that would implement it — and found that **the mechanism already exists and has been running
nightly since 26 August.** `vercel.json` schedules `/api/coach/sales-session/recording-purge-cron` at 03:30, and
that route states the rule exactly.

So yesterday's note was wrong. Not "undecided" — **unread**. This is the `A19`/`A22` failure in its plainest form:
I recorded a conclusion about the codebase from what I remembered of it rather than from opening the file, and
then published that conclusion on a page the public reads.

That is why this is a build. The change is prose, but the thing being corrected is a false statement about the
system on the one page where a false statement is a legal exposure rather than a bug.

## Understanding — what the code actually does (§0)

Read line by line today, not recalled:

- `recording-purge-cron/route.ts:24` — `const KEEP_PER_REP = 20`. The rule is a **count, not a duration**. The
  header records why: an earlier two-day age rule left a rep who had not pitched for two days with nothing for
  their manager to pull from.
- `:57-71` — candidates are sessions with `audio_asset_url` set and `recording_saved = false`, newest first.
- `:76-84` — each rep's first twenty stay; the remainder are purged oldest-first.
- The comment at `:17` — *"Transcript + scores are KEPT — we drop the recording bytes, not the analytics"*.
- `save-recording/route.ts:14-20` — a recording anyone presses Save on is exempt from the purge, indefinitely.

## What the founder said, and where it differs (§3.2.1)

The founder said: *"Audio is kept until the transcript is made and the system has analyzed the audio"*, and
*"an agent cannot delete their own, only managers and admins."*

Both are reasonable descriptions of an intent. **Neither is what runs**, and a privacy policy must describe
behaviour rather than intent:

1. **Audio outlives analysis by design.** `recording-url.ts` exists specifically so a rep can listen back a day
   later, and the retention cron keeps twenty. "Kept until analysed" would understate retention on a public page,
   which is the worse direction to be wrong in.
2. **Nobody can delete a recording on demand** — there is no delete endpoint for one anywhere in
   `src/app/api/coach/sales-session/`. Managers and administrators have no more power here than a rep does.
3. **The gap runs the OPPOSITE way from the stated policy.** `save-recording` authorises *the owning rep* as well
   as a manager, so a rep can already exempt their own recording from deletion forever. The founder described reps
   as having less control than managers; today they have more than the description implies.

Flagged, not resolved. The policy states the behaviour; the difference goes to the founder with a recommendation.

## What could go wrong, before searching (§1.5.2)

- **The cron may not actually be scheduled**, making the rule aspirational. Checked `vercel.json`: it is, at
  `30 3 * * *`.
- **There may be a second retention path I would miss by reading one file.** Searched `audio_asset_url` across
  `src/app/api/coach`: eleven files, of which only the purge cron and the RCD retention cron delete anything, and
  the latter is a different subsystem.
- **There may be a delete endpoint I had not found.** Searched for `DELETE` handlers under `sales-session`: the
  only hit is a test file name. There is none.

## Four layers (§1.5.1)

1. **Structure.** No code changes. The correction is to the document that describes the code, and it now cites the
   mechanism rather than paraphrasing an intention.
2. **Operational.** A reader can answer "how long do you keep my voice, and can I get it removed" from the page.
3. **The person.** The person at the door is being recorded and has read nothing. This section is the only place
   the product ever speaks to them. Claiming a delete control that does not exist would be worse than silence.
4. **Finish.** The section sits with the other recording facts, in the voice the page already uses.

## The conflict I am not resolving silently (§6 checklist item 0 / AMD-013)

`CLAUDE.md` §6 checklist item 0 requires that a decision offered to the founder be an `AskUserQuestion` picker. The founder has
three times, explicitly, instructed the opposite for this work: decisions go to the published artifact board, never
an in-chat picker. Both are the founder's own instruction, and the later one is specific to this work.

I am following the direct instruction and recording the conflict here rather than picking quietly. The intent of
AMD-013 — options with a recommendation marked, never prose ending in "your call" — is satisfied by the board.

## Session-read manifest (§3.1.2 / A22 / A35)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-04T08:20:34+08:00",
    "why_it_governs": "The whole defect here is a conclusion asserted without understanding earned — I wrote that the rule could not be read out of the code I had not opened.",
    "how_this_build_will_embody_it": "The rule is quoted from the route with line numbers, and the founder's own answer is checked against it rather than trusted." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-09-04T08:20:34+08:00",
    "why_it_governs": "The methodology must be in the tree at the moment of action, and read this session rather than recalled.",
    "how_this_build_will_embody_it": "Every range in this manifest was opened today; the timestamps come from date -Iseconds runs in this session." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-09-04T08:20:34+08:00",
    "why_it_governs": "Four layers, foundation up, before any user-facing change.",
    "how_this_build_will_embody_it": "Walked above; L3 is the load-bearing one, because the reader this section is for is the person at the door." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-152", "read_at": "2026-09-04T08:20:34+08:00",
    "why_it_governs": "Think first, then search to confirm.",
    "how_this_build_will_embody_it": "Three hypotheses written before searching; the third — that a delete endpoint existed somewhere — was wrong, and finding that out is what stopped the policy claiming one." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-452", "read_at": "2026-09-04T08:20:54+08:00",
    "why_it_governs": "Item 1 asks whether I understand why the problem exists; item 0 is AMD-013, which this work is in tension with.",
    "how_this_build_will_embody_it": "The tension is named in this document rather than resolved silently, and the founder is told." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-468", "read_at": "2026-09-04T08:20:54+08:00",
    "why_it_governs": "Labels without content. I published a claim about the codebase from cached impression.",
    "how_this_build_will_embody_it": "Every claim in the new section cites the file that implements it." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-606", "read_at": "2026-09-04T08:20:54+08:00",
    "why_it_governs": "Citations without session-reading operate undetected — this is that failure caught one day later by looking rather than by a gate.",
    "how_this_build_will_embody_it": "Recorded as a finding in check.md rather than quietly corrected." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-04T08:20:54+08:00",
    "why_it_governs": "A lesson in prose returns unless a gate catches it.",
    "how_this_build_will_embody_it": "Answered honestly in check.md: this one is a PROMISE, not a gate, and the reason is written there rather than left implied." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1010", "read_at": "2026-09-04T08:20:54+08:00",
    "why_it_governs": "Verified names the command you ran.",
    "how_this_build_will_embody_it": "check.md pastes npm run check and its exit code, not a subset I chose." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "78-92", "read_at": "2026-09-04T09:02:26+08:00",
    "why_it_governs": "The parent of the four-layer gate, cited in the commit trailer and therefore owed an entry of its own rather than only its leaves.",
    "how_this_build_will_embody_it": "The four layers are walked above; the section was re-opened at its header to write this entry rather than inferred from its children." },
  { "id": "§3.1", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "93-97", "read_at": "2026-09-04T09:02:23+08:00",
    "why_it_governs": "THINK cannot be skipped or abbreviated and must produce think.md BEFORE any file is edited.",
    "how_this_build_will_embody_it": "It did not, and that is recorded rather than hidden: the policy edit was written first and the gate refused the commit until this build existed. The refusal is in check.md." },
  { "id": "§3.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "219-222", "read_at": "2026-09-04T09:02:23+08:00",
    "why_it_governs": "Build the specification as written, governed by the framework.",
    "how_this_build_will_embody_it": "build.md names what was added, and names what was deliberately NOT added — a twelve-month cap the cron does not enforce." },
  { "id": "§3.3", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "294-297", "read_at": "2026-09-04T09:02:23+08:00",
    "why_it_governs": "CHECK audits the built artifact, never the intent.",
    "how_this_build_will_embody_it": "Every claim in the new section is tabulated in check.md against the file that implements it." },
  { "id": "§3.2.1", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "223-228", "read_at": "2026-09-04T08:24:55+08:00",
    "why_it_governs": "Deviating from the request is a violation unless flagged BEFORE acting. The founder gave me two facts and I found both differ from the code.",
    "how_this_build_will_embody_it": "The difference is flagged in think.md and closure.md before anything was written, and the page states the behaviour rather than either version of the intent." },
  { "id": "§3.2.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "229-262", "read_at": "2026-09-04T08:24:55+08:00",
    "why_it_governs": "Reachability, not a file inventory — who actually reaches this and can act on it.",
    "how_this_build_will_embody_it": "build.md names the two readers of the same four bullets: the representative, and the person at the door who has no account." },
  { "id": "§3.2.3", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "263-292", "read_at": "2026-09-04T08:24:55+08:00",
    "why_it_governs": "Verification names the canonical command and pastes what it printed.",
    "how_this_build_will_embody_it": "check.md leads with npm run check and its exit code, and records the freshness gate refusing the first commit." },
  { "id": "§4", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "418-457", "read_at": "2026-09-04T08:24:55+08:00",
    "why_it_governs": "The residual is a queue read from the top of the confidence ranking, not a disclaimer list.",
    "how_this_build_will_embody_it": "Two entries; the high-confidence one was opened before closure and its outcome written." },
  { "id": "§3.1.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "119-160", "read_at": "2026-09-04T08:20:39+08:00",
    "why_it_governs": "Defines this manifest and requires read_at to be this session.",
    "how_this_build_will_embody_it": "Opened after this build's started_at, and the minimum set is present." },
  { "id": "§3.3.1", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "298-301", "read_at": "2026-09-04T08:20:39+08:00",
    "why_it_governs": "Audit the built files, not the intent.",
    "how_this_build_will_embody_it": "The rendered section is quoted back in check.md from the file as committed." },
  { "id": "§3.3.2", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "302-313", "read_at": "2026-09-04T08:20:39+08:00",
    "why_it_governs": "A CHECK with no cross-module pass is incomplete.",
    "how_this_build_will_embody_it": "How long we keep a recording is inventoried across the policy page, the purge cron, the RCD retention cron and the mobile submission notes." },
  { "id": "§3.3.3", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "314-330", "read_at": "2026-09-04T08:20:39+08:00",
    "why_it_governs": "Name the class by its root shape and record the sweep command.",
    "how_this_build_will_embody_it": "The class is a public statement about the system asserted without opening the file that implements it. Swept, with the command." },
  { "id": "§3.3.4", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "331-345", "read_at": "2026-09-04T08:20:39+08:00",
    "why_it_governs": "Gate or promise, per fix.",
    "how_this_build_will_embody_it": "Answered per finding; one is honestly a promise, and A33 is invoked for why." },
  { "id": "§3.3.5", "source_file": "docs/THINK_BUILD_CHECK.md", "line_range": "347-352", "read_at": "2026-09-04T08:20:39+08:00",
    "why_it_governs": "Never report clean for what was not inspected.",
    "how_this_build_will_embody_it": "The rendered page in a browser is named as un-inspected and carried into the residual." }
]
```
