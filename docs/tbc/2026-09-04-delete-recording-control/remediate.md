# REMEDIATE — a manager can delete a recording

## F1 — THINK was written after the first file was edited

**Not remediable after the fact, and deliberately not disguised.** The manifest entry for §3.1 records it in its
own words rather than carrying a timestamp that would imply otherwise.

**Gate or promise?** Neither, honestly. A gate that compared `think.md`'s `started_at` against file mtimes would be
trivially satisfied by touching the document first, which is the form of the failure rather than a cure for it.
Recorded as a habit to watch: the pull to start with the extraction was strong precisely because the extraction was
obvious, and "obvious" is where §0 gets skipped.

## F2 — the privacy page would have been made false by this branch

**Fixed here, structurally rather than by a note.**

The finding was that `elostate.com/privacy` said *"no button that deletes a recording... not for a manager, not for
an administrator"* — true of the privacy branch alone, and **false the moment this branch merges**. A note saying
"remember to update the page" is exactly the prose-only remediation A30 says will return.

Two things were done instead:

1. **This branch was restacked on top of `recording-retention-disclosure`** rather than sitting beside it off
   `main`. The two changes are now one ordered sequence, so there is no merge order that produces a policy page
   contradicting the code. Off `main` they were independent, and independent was the hazard.

2. **The paragraph is rewritten on this branch**, in the same commit as the endpoint that makes it true. It now
   states who may delete (managers and administrators), who may not and why (the owning representative — the person
   a recording is about is not the person who decides whether it is kept), and what survives (transcript and
   scores). The file header records that the earlier "nobody can" was accurate when written, and names the
   condition under which this new paragraph would become false — the route being removed.

**The residual risk, stated rather than closed:** nothing mechanical ties the paragraph to the route. If someone
deletes `delete-recording/route.ts`, the policy claims a control that does not exist and no gate notices. A test
asserting "the privacy page mentions deletion iff the route exists" is possible but would be a check on prose
matching, which is the imprecise-gate trap (A33). The honest defence here is the file header, which names the
condition explicitly for the next author.

## Nothing was remediated by weakening a check

No test, gate or rule was modified. The cron's nine pre-existing tests were run *against* the refactor rather than
adjusted to fit it, which is the only reason the extraction can be claimed to preserve behaviour.

## F3 — the refactor that was written but not committed

**Fixed by committing it.** The cron now calls `removeRecordingAudio`, and the claim in build.md is true of the
branch rather than only of my editor.

**Gate or promise?** Neither, and I want to be exact about why rather than reaching for a gate that would not work.

A check that compared the working tree to `HEAD` would fire on every legitimate work-in-progress, which is most of
the time — the definition of a gate people learn to skip. A check that read this build's own prose and verified
each claim against the commit is what an honest CHECK phase already is; the failure was that I ran it against the
files on disk instead of against `git show`.

**So the correction is to the method, and it is one line: a CHECK that cites a file must read it out of the commit,
not out of the working tree.** §3.3.1 says "read the files, not the memory". This is the same rule one level up —
the working tree is a kind of memory, and it remembers things the branch does not.

**The near miss worth naming:** had `main` moved and this branch been merged as it stood, the duplicated deletion
logic would have shipped with documentation asserting it had been unified. The next person to change the removal
rule would have changed it in one place and been told by check.md that one place was enough.
