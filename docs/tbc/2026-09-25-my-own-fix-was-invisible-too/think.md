# THINK — the highest-yield route left

started_at: 2026-09-25T03:20:00Z

## Why `/[id]`

The render-tree sweep put **22 of the 74 remaining sites** in this one route's tree —
`[id]/page.tsx` (9), `PivotAndScores` (7), `SessionRecordingUpload` (3), `LiveCoachingPanel` (2),
`SessionCoachTools` (1). Nothing else came close.

It is captured as a ROUTE rather than component-by-component because that is what the sweep
established an hour ago: **the tree is the unit**. Rendering `LiveCoachingPanel` alone would have
been the per-file mistake in a new costume.

## A capture I wrote and then deleted

The plan was two states: an ENDED session and a LIVE one, because `LiveCoachingPanel` is the
surface that runs while a rep is at the door and has never been rendered.

`LiveCoachingPanel` is mounted **unconditionally** at `:1027` — not behind `status === "active"`.
So both captures would have been the same picture, and the second would have added a file and no
information. Checked rather than assumed.

Replaced with the THIN state: no review signal, no moments, no pivot. That is what most recordings
look like before anything has analysed them, and it is the branch carrying this page's
honest-empty copy.

## What the render was for

Not to confirm the fix. To find out whether the fix was right — which is the only reason this build
exists in the shape it does.
