# CLOSURE — Incremental audio upload (never lose the recording)

**Shipped:** the audio recording now uploads in ~15s chunks DURING the call and is stitched into the final
`recording.webm` on session end, so it survives ANY ending (drop / tab-close / phone-lock / crash / never-Stop)
— not only a clean Stop. This closes the "failed session recording" half of the founder's capture crisis, for
the dominant never-Stopped case.

**Why this was the right fix (§0):** the record showed reps overwhelmingly do NOT cleanly Stop (recent
sessions all auto-closed at 6h+), and the on-Stop `persistRecording` was the only save path — so audio was
never saved for them. An effective fix could not depend on Stop; incremental upload makes the audio durable
independent of how the session ends. (The historical ~93% no-audio was also CONFOUNDED by the 2-day purge, so
it couldn't prove a clean-Stop bug — the confirmed fact was save-only-on-Stop + reps-don't-Stop.)

**Additive / low-risk to the un-validated P0 path:** the only recorder change is a timeslice on `rec.start()`;
reconnect/teardown untouched, onstop still builds the full blob (clean-Stop persist byte-identical), and the
chunk upload is fire-and-forget (a failure never affects capture or the transcript).

**Un-named reliance:** the whole thing rests on sequential MediaRecorder chunks byte-concatenating into a
valid webm — true for one continuous recorder (the common case P0 guarantees). The rare dead-recorder-on-
reconnect seam and the clean-Stop orphan chunks are documented in check.md as bounded follow-ups.

**Verification the agent CANNOT do:** whether a real never-Stopped mobile call leaves a playable
`recording.webm` — founder-gated, like the rest of the capture work.

Commits: (this build). Gate green, 3486 passing.
