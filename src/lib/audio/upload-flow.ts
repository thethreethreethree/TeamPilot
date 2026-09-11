/**
 * The upload, as a sequence — with nothing native in it.
 *
 * WHY IT LIVES APART FROM `upload.ts`, and it is the same reason
 * `outbox-classify.ts` lives apart from the HTTP client, stated in that file:
 * a rule that can only be exercised through a native filesystem is a rule that
 * will not be exercised. `upload.ts` imports expo-file-system, supabase and
 * react-native, and this project's test runner strips types rather than
 * compiling them, so it cannot load that module at all. The consequence was not
 * theoretical: the ordering below — the single guarantee standing between a rep
 * and a lost customer conversation — had NO test, and moving one line would have
 * destroyed every recording while 1,073 tests still passed.
 *
 * THE GUARANTEE, and everything here exists to keep it:
 *
 *     await deps.post(.../upload-recording)   the server confirms it has the file
 *     deps.deleteFile(rec.fileUri)            and ONLY then does the phone let go
 *
 * Every side effect arrives through `deps`, so the whole sequence runs in a test
 * with no device, no network and no filesystem. `upload.ts` supplies the real
 * ones and is now a thin wrapper; nothing about the shipped behaviour changed.
 *
 * Imports here must stay PURE. Adding a native import to this file silently
 * removes the only coverage the upload path has.
 */
import { MAX_UPLOAD_BYTES, sizeForUpload } from './recording-budget';
import { checkRecordingIntegrity, integrityMessage } from './recording-integrity';
import { uploadBlockedMessage } from '@/lib/blocked-state';
import { authFailureOf } from '@/lib/auth-failure';
import type { PendingRecording } from './recording-store';
import type { PendingSpeaker, PendingSegment } from './attribution-store';
// TYPE-ONLY, and that is load-bearing: `import type` is erased before this file
// runs, so naming the heavy module here creates no runtime dependency on it.
import type { UploadDeps, UploadOutcome, CallContext } from './upload';

type CreatedSession = { session?: { id?: string }; id?: string };
type SignResult = { bucket: string; storagePath: string; token: string };
// The REAL stored shapes, not a simplified copy. Writing my own looser version
// here would have quietly widened what reaches the attribution store.
type FinalizeResult = {
  speakers?: PendingSpeaker[];
  segments?: PendingSegment[];
};

/**
 * The segments to echo back when the rep says which voice is theirs.
 *
 * WHY THIS IS A FUNCTION AND NOT `finalized.segments`. The payload is stored and
 * re-sent as JSON, so every field the server sent survives whether anyone meant
 * it to or not — including `startSeconds`, which is what the pace skill is built
 * on. That is an accident, and accidents get tidied away: one `.map()` that
 * rebuilds these objects from the three fields anybody remembers and the skill
 * goes quiet with no test failing and no error anywhere. So the keeping is
 * explicit, and pinned by a test.
 *
 * ALL OR NOTHING. A malformed entry refuses the WHOLE payload rather than being
 * dropped: the labelling route relabels the transcript from exactly this list,
 * so a list with a hole in it relabels part of a call and silently loses the
 * rest — which attribution-store already names as worse than leaving it
 * unattributed and saying so.
 */
export function attributionSegments(raw: unknown): PendingSegment[] {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out: PendingSegment[] = [];
  for (const item of raw) {
    const s = item as Partial<PendingSegment> | null;
    if (
      !s ||
      typeof s.speakerId !== 'string' ||
      !s.speakerId ||
      typeof s.text !== 'string' ||
      !s.text ||
      typeof s.seq !== 'number' ||
      !Number.isInteger(s.seq) ||
      s.seq < 0
    ) {
      return [];
    }
    const timed =
      typeof s.startSeconds === 'number' &&
      Number.isFinite(s.startSeconds) &&
      s.startSeconds >= 0;
    // OMITTED when unknown, never zeroed: a 0 claims the turn opened the call,
    // and the server treats an absent offset as "we do not know".
    out.push(
      timed
        ? { speakerId: s.speakerId, text: s.text, seq: s.seq, startSeconds: s.startSeconds }
        : { speakerId: s.speakerId, text: s.text, seq: s.seq },
    );
  }
  return out;
}

/** The HTTP status an error carries, when it carries one. */
function statusOf(e: unknown): number | undefined {
  return (e as { status?: number })?.status;
}

export async function runUpload(
  userId: string,
  rec: PendingRecording,
  meta: { clientLabel: string; context?: CallContext },
  deps: UploadDeps,
): Promise<UploadOutcome> {
  const clientLabel = meta.clientLabel.trim();
  if (!clientLabel) {
    return { ok: false, reason: 'failed', message: 'Give this call a name before sending it.' };
  }

  // Checked before anything is attempted: an entry whose file has gone would
  // otherwise create an empty session on the server and then fail.
  if (!deps.fileExists(rec.fileUri)) {
    return {
      ok: false,
      reason: 'file-gone',
      message: 'The audio for this recording is no longer on the phone.',
    };
  }

  if (rec.sizeBytes > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      reason: 'too-large',
      message: `This recording is larger than the ${Math.round(
        MAX_UPLOAD_BYTES / 1024 / 1024,
      )} MB the server accepts, so it cannot be sent.`,
    };
  }

  /*
   * THE MIRROR OF THE GUARD ABOVE, and the one that was missing. A file too LARGE has
   * always been refused here with a reason; a file too small to contain any audio was sent
   * cheerfully.
   *
   * Measured on production 10 September 2026 on the door-pitch pipeline, which shares this
   * recorder: one upload was FIVE BYTES of Matroska container carrying a recorded duration
   * of 129,800 ms. The rep recorded at a door for over two minutes and the phone handed
   * back a file with no media in it. Nothing on the way to the server disagreed, and the
   * failure surfaced five retries later in a row nobody reads.
   *
   * `not-ready` because retrying reaches the identical answer - the same permanent-refusal
   * class as a missing outcome, never a network error worth another attempt.
   */
  const integrity = checkRecordingIntegrity(rec.sizeBytes, rec.durationMs);
  if (!integrity.ok) {
    return { ok: false, reason: 'not-ready', message: integrityMessage(integrity.reason) };
  }

  await deps.update(userId, rec.clientId, {
    attempts: rec.attempts + 1,
    lastError: null,
  });

  // Declared outside the try so the catch can tell "we never got a session" from
  // "we had one and the server then could not see it" — two failures that look
  // identical from the status code alone and mean opposite things.
  let sessionId = rec.sessionId;

  try {
    // ── 1. the session ────────────────────────────────────────────────────
    // Reused if a previous attempt already made one. Creating a second would
    // leave the rep with a duplicate of the same conversation.
    if (!sessionId) {
      // Optional fields are omitted rather than sent empty: the route treats
      // them as optional strings, and an empty one would file a session as
      // having a blank territory rather than none.
      const created = await deps.post<CreatedSession>('/api/coach/sales-session', {
        context: meta.context ?? 'in_person',
        clientLabel,
        /*
          WHEN THE CONVERSATION HAPPENED, not when the phone finally had a bar.

          This route is reached at UPLOAD, and a recording can sit on the device for days - the
          longest observed in production is 47. Without this the session is dated by the insert, so
          a call recorded on the 4th and sent on the 11th appeared in the rep's history on the 11th.
          Nothing surfaced it while recordings rarely sent; they send themselves now.

          The server does not simply trust it: a phone's clock can be anything, and a value outside
          a believable window is refused and the column's own default used instead.
        */
        startedAt: rec.recordedAt,
        ...(rec.territory?.trim() ? { territory: rec.territory.trim() } : {}),
        ...(rec.approach?.trim() ? { approach: rec.approach.trim() } : {}),
        ...(rec.offer?.trim() ? { offer: rec.offer.trim() } : {}),
      });
      sessionId = created.session?.id ?? created.id ?? null;
      if (!sessionId) throw new Error('The server did not return a session for this call.');
      await deps.update(userId, rec.clientId, { sessionId, label: clientLabel });
    }

    // ── 1b. how it ended ──────────────────────────────────────────────────
    //
    // Sent as soon as the session exists, and BEFORE the audio, because it is
    // the cheap part: a few bytes that decide whether this call counts toward
    // conversion rate, close rate and revenue at all. A session with no outcome
    // contributes to none of them.
    //
    // Its failure does NOT fail the upload. The audio is the irreplaceable half;
    // an outcome can be set again later from the website or from a retry, and
    // refusing to save a recording because a one-line write failed would trade
    // something recoverable for something that is not.
    if (rec.outcome) {
      try {
        await deps.post(`/api/coach/sales-session/${sessionId}/outcome`, {
          outcome: rec.outcome,
          ...(rec.dealValue !== null && rec.dealValue !== undefined
            ? { dealValue: rec.dealValue }
            : {}),
        });
      } catch {
        // QUEUED, not merely reported. This used to write an error string onto
        // the recording and move on — which meant the rep's outcome existed
        // nowhere except in a sentence asking them to type it again, and only if
        // they went looking at the right screen for it.
        //
        // The write queue exists for exactly this, so the instruction goes there
        // and is sent when it can be. The error line stays as well: the queue is
        // silent by design, and a rep who set an outcome deserves to know it did
        // not land on the first try even though it is safe.
        await deps.enqueue(userId, {
          sessionId,
          kind: 'outcome',
          outcome: rec.outcome,
          // Absent and null are different instructions to the server, and the
          // same distinction the request above makes is preserved here.
          ...(rec.dealValue !== null && rec.dealValue !== undefined
            ? { dealValue: rec.dealValue }
            : {}),
        }).catch(() => {
          /* the error line below still tells the rep; a failed queue write must
             not fail an upload whose audio has already gone */
        });
        await deps.update(userId, rec.clientId, {
          lastError:
            'The recording was sent. The outcome did not save on the first try and is waiting on this phone — it will send on its own.',
        });
      }
    }

    // ── 2. the signed target ──────────────────────────────────────────────
    const signed = await deps.post<SignResult>(
      `/api/coach/sales-session/${sessionId}/upload-recording/sign`,
      {
        filename: `${rec.clientId}.m4a`,
        // Whole bytes: the route's schema is `int()`, and the value comes from
        // a native filesystem call whose exact type I cannot observe from here.
        sizeBytes: sizeForUpload(rec.sizeBytes),
        mimeType: rec.mimeType,
      },
    );

    // ── 3. the bytes, direct to Storage ───────────────────────────────────
    //
    // Read whole rather than streamed. The ceiling is 25 MB and this runs once
    // per call, so the memory is bounded and brief; a streaming upload would be
    // better and is worth doing once there is a device to measure it on, but a
    // clever untested upload path is the wrong place to spend a rep's only copy
    // of a conversation.
    const bytes = await deps.readBytes(rec.fileUri);
    const { error: storageError } = await deps.uploadToStorage(
      signed.bucket,
      signed.storagePath,
      signed.token,
      bytes,
      rec.mimeType,
    );
    if (storageError) throw new Error(storageError.message || 'The upload did not complete.');

    // ── 4. tell the server it is there ────────────────────────────────────
    //
    // This is the step that transcribes, so its answer carries the diarized
    // speakers. Those ids exist ONLY in this response — the stored transcript is
    // flattened to agent/customer and cannot be asked again — so if the payload
    // is not kept here the call can never be attributed.
    const finalized = await deps.post<FinalizeResult>(
      `/api/coach/sales-session/${sessionId}/upload-recording`,
      { storagePath: signed.storagePath },
    );

    const speakers = finalized?.speakers ?? [];
    const segments = attributionSegments(finalized?.segments);
    /*
     * ANY voice at all is worth asking about. This was `>= 2`, and the sentence
     * that justified it - "one voice means there is nothing to choose between" -
     * was wrong in the way that mattered: the transcript is only written when the
     * rep answers, so refusing to ask did not skip a prompt, it threw the whole
     * transcript away. Silently, with the audio and the duration still saved, so
     * everything looked fine and the coach said the thread came through empty.
     *
     * With one voice the question is "is this you, or the customer?", which the
     * app cannot answer for itself: a one-sided capture that got only the
     * prospect is a real thing, and doc 08 exists for it.
     */
    if (speakers.length >= 1 && segments.length > 0) {
      await deps.writeAttribution(
        { sessionId, label: clientLabel, speakers, segments },
        userId,
      );
    }

    // Only now is the phone no longer the only place this call exists.
    await deps.update(userId, rec.clientId, { status: 'uploaded', lastError: null });
    deps.deleteFile(rec.fileUri);
    await deps.remove(userId, rec.clientId);

    return { ok: true, sessionId };
  } catch (e) {
    const status = statusOf(e);

    // A 404 AFTER the session was created is the signature of a server that
    // authenticated the caller and then could not see their own session — the
    // access check reading through a client that has no session. Retrying cannot
    // fix it, so it is treated like the 401 case rather than as a transient
    // failure the rep should keep tapping at. Saying "not found" here would be
    // worse than useless: the session exists, and they would go looking for it.
    const serverCannotRead = status === 404 && Boolean(sessionId);

    const message =
      status === 401 || status === 403 || serverCannotRead
        ? uploadBlockedMessage(authFailureOf(e))
        : status === 413
          ? 'The server refused this recording for being too large.'
          : e instanceof Error && e.message
            ? e.message
            : 'Could not send this recording. It is still on your phone.';

    await deps.update(userId, rec.clientId, { status: 'failed', lastError: message });

    return {
      ok: false,
      reason:
        status === 401 || status === 403 || serverCannotRead
          ? 'needs-shim'
          : status === 413
            ? 'too-large'
            : 'failed',
      message,
    };
  }
}
