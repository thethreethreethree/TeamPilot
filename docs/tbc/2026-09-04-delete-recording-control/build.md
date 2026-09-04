# BUILD — a manager can delete a recording

Three files: one new helper, one new route, one refactor of the retention cron onto the helper.

## Features

### Deleting one recording, on request

`POST /api/coach/sales-session/[id]/delete-recording`.

**write-path:** the bytes first, the pointer second, and never the other way round. `removeRecordingAudio` removes
the object at the bucket-relative path in `assets-v1`, then best-effort removes the orphaned chunk objects under
`${company}/${session}/chunks/`. Only if that reports success does the route write
`{ audio_asset_url: null, recording_saved: false, recording_saved_by: null, recording_saved_at: null }` to
`coaching_sessions`, scoped `.eq("id")` and `.eq("company_id")`, and it asserts a non-empty rowcount rather than
trusting the update. Every failure path leaves the row entirely untouched — asserted by three tests — because a
cleared pointer over live bytes is a recording of a real customer that nothing can find and nothing will ever
remove. The transcript, the scores and the coaching notes are not touched at all.

**read-path:** none yet, and that is the honest answer rather than an omission. **No screen calls this endpoint.**
A destructive control needs a confirmation design of its own, and shipping a Delete button without one is worse
than shipping no button. Until that exists the capability is reachable only by an authorised API call, which is
enough to make the founder's stated policy true at the API layer and not enough to call the feature finished. The
route's own effect IS readable, and by the surface that matters: a deleted recording stops appearing to the
session view's player, because that reads `audio_asset_url` and it is now null.

### Removal logic, in one place instead of two

`src/lib/coach/v5/removeRecordingAudio.ts`.

**write-path:** it performs the storage writes — `remove()` on the audio object, `list()` + `remove()` on the chunk
prefix — and returns a discriminated result rather than a boolean, so a caller cannot collapse "already gone"
(success: the end state holds) into "storage refused" (failure: leave the pointer alone) into "I do not recognise
this pointer" (refuse: we cannot know whether the object exists). The storage client is INJECTED, which is what
makes it testable at all; it is exercised against a fake in seven unit tests.

**read-path:** its two callers — the new route, and `recording-purge-cron`, which previously carried this logic
inline. The read-path assertion that matters is that the cron's own pre-existing tests, written before this
refactor existed, pass unchanged against it:

```
npx vitest run src/app/api/coach/sales-session/recording-purge-cron                src/app/api/coach/sales-session/__tests__/recording-purge-cron.route.test.ts
 Test Files  2 passed (2)
      Tests  9 passed (9)
exit: 0
```

9 of 9. The extraction is not a claim about a diff I read.

## Why the rep is refused, and why that is not inconsistent

`save-recording` authorises the owning representative **and** a manager. This route authorises **only** a manager
or an administrator. Read side by side that looks like a mistake, so the reason is written into the route:

> A recording is evidence of how a call was handled. A rep who could delete their own worst call could curate what
> their manager sees. Keeping a call harms nobody; removing one can.

## What was deliberately NOT built

- **No web control.** See the read-path above.
- **`save-recording` untouched.** Narrowing it would remove a capability reps have today, in the week the mobile
  app is being submitted. On the founder's board, not taken here.
- **No twelve-month retention cap.** Recommended this morning, not chosen.
