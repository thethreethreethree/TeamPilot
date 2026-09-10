/**
 * One coaching session: what was said, and what the coach cued during it.
 *
 * Every read goes direct to Supabase under RLS. A session id that is not this
 * rep's returns nothing rather than someone else's row, so the screen cannot leak
 * by construction — the "not found" branch below is the honest response to both a
 * deleted session and a foreign one, and deliberately does not distinguish them.
 *
 * Transcript and cues are APPEND-ONLY on the server. This screen reads; it never
 * assumes it can edit history.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Share,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { getCues, getSession, getTranscript, subscribeSession } from '@/lib/sync/sessions';
import { buildTimeline } from '@/lib/session-timeline';
import { readCachedDetail, writeCachedDetail } from '@/lib/sync/session-detail-cache';
import { useAuth } from '@/lib/auth-context';
import { recordCrash } from '@/lib/crash-log-store';
import {
  analysisState,
  transcriptWaitBody,
  transcriptWaitTitle,
  type WaitReason,
} from '@/lib/session-analysis';
import { readAnswer } from '@/lib/sync/coach-answers';
import { coachPatch, coachPost } from '@/lib/coach-api';
import { classify } from '@/lib/sync/outbox-classify';
import {
  clearOutboxStop,
  enqueue,
  outboxStopped,
  pendingFor,
  removeEntry,
  runOutbox,
  type OutboxEntry,
} from '@/lib/sync/outbox';
import { useOnline, isOffline } from '@/lib/use-online';
import { reachError } from '@/lib/reach-failure';
import { useLargeText } from '@/lib/use-large-text';
import { OutcomePicker } from '@/components/outcome-picker';
import { NOT_THE_REP, SpeakerPicker } from '@/components/speaker-picker';
import { RecordingPlayer } from '@/components/recording-player';
import { AfterPitchCard } from '@/components/after-pitch-card';
import { SessionReadCard } from '@/components/session-read-card';
import { RECORDING_AVAILABLE } from '@/lib/audio/module';
import { signedRecordingUrl } from '@/lib/sync/recording-url';
import {
  clearPendingAttribution,
  readPendingAttribution,
  type PendingAttribution,
} from '@/lib/audio/attribution-store';
import { speakersFromTranscript } from '@/lib/audio/relabel-unknown';
import type {
  CoachingCue,
  CoachingSession,
  SessionOutcome,
  TranscriptSegment,
} from '@/types/backend';
import { C } from '@/lib/theme';
import { clockTime, duration, money, outcomeLabel, parseMoney, shortDate } from '@/lib/format';
import { authFailureMessage } from '@/lib/auth-failure';
import { buildSessionDoc } from '@/lib/pdf/session-doc';
import { shareSessionPdf } from '@/lib/pdf/share-session-pdf';

/** How long a network read stays fresh enough that returning to this screen
 *  should not spend three more queries on it. */
const REFETCH_AFTER_MS = 15_000;

/** How often to look again while a transcript is on its way. */
const TRANSCRIPT_POLL_MS = 15_000;

/**
 * How many times, before the app stops looking on its own.
 *
 * Twenty ticks is five minutes. A call of the length this app records transcribes
 * well inside that; past it the honest conclusion is not "keep waiting" but
 * "something is wrong", and continuing to poll would spend a rep's battery
 * pretending otherwise.
 */
const TRANSCRIPT_POLL_LIMIT = 20;

type Row =
  | { kind: 'meta'; session: CoachingSession }
  | { kind: 'stale'; at: Date }
  /**
   * The call itself, when the server holds the audio.
   *
   * Sits with the facts rather than in the transcript, because it is a fact
   * about the call — and because a rep who opens a session a day later and wants
   * to HEAR the objection should not have to scroll a transcript to find the
   * control that plays it.
   */
  | { kind: 'audio'; assetUrl: string }
  /**
   * The between-doors debrief. Offered, never generated on open.
   *
   * CARRIES WHETHER THERE IS ANYTHING TO DEBRIEF. The card used to get only an
   * id, so a call with no recording came back as a failed request and was
   * reported as the server refusing the app's sign-in. The screen has always
   * known better — it says so two rows above.
   */
  | {
      kind: 'read';
      sessionId: string;
      segments: { speaker: string; text: string }[];
    }
  | {
      kind: 'debrief';
      sessionId: string;
      hasAudio: boolean;
      segmentCount: number;
      /** Segments nobody has attributed - what makes a debrief 'waiting on one answer'. */
      unattributedCount: number;
    }
  | { kind: 'outcome'; session: CoachingSession }
  | { kind: 'rename'; session: CoachingSession }
  | { kind: 'heading'; text: string; count: number }
  /**
   * `startsTurn` is false for a line that continues the same speaker.
   *
   * A real conversation is not one line per person in strict alternation — a rep
   * answering an objection speaks four or five segments in a row. Stamping
   * "YOU · 14:32" above every one of them turned the transcript into a column of
   * repeated labels with the actual words scattered between them. The label now
   * marks where a TURN changes hands, which is the thing a rep scanning a call
   * is looking for.
   */
  | { kind: 'segment'; segment: TranscriptSegment; startsTurn: boolean }
  | { kind: 'cue'; cue: CoachingCue }
  | { kind: 'note'; text: string };

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  /**
   * The pieces the export is built FROM, rather than the finished string.
   *
   * A transcript can run to thousands of segments now that it is read
   * completely, and building the whole export on every open spent that work on
   * every rep who came to read a call and never shared it. The string is made
   * when the share button is pressed, which is the only moment it is wanted.
   */
  const [exportSource, setExportSource] = useState<{
    session: CoachingSession;
    segments: TranscriptSegment[];
    cues: CoachingCue[];
  } | null>(null);
  const [title, setTitle] = useState('Session');
  /** A failure that means the screen has nothing to show. Replaces the screen. */
  const [error, setError] = useState<string | null>(null);
  /**
   * A failure AFTER the session has loaded — a share that would not open, an
   * outcome that would not save.
   *
   * Deliberately separate from `error`, which triggers an early return and
   * replaces the whole screen. Wiping a rep's transcript off the display
   * because a one-line write failed would destroy what they came for in order
   * to report something that did not affect it.
   */
  const [notice, setNotice] = useState<string | null>(null);
  const [missing, setMissing] = useState(false);
  /**
   * True when the server holds the audio but no transcript has arrived yet.
   *
   * The one state on this screen where a rep is genuinely WAITING, and the only
   * one worth spending a repeated network read on.
   */
  const [awaitingTranscript, setAwaitingTranscript] = useState(false);
  /** True once the app has stopped checking on its own. Said on screen. */
  const [pollingGaveUp, setPollingGaveUp] = useState(false);
  /**
   * Why there is no transcript, when there is none.
   *
   * `arrived-stale` means the call was already long past the window when this
   * screen opened, so there is nothing to wait for and no reason to poll.
   */
  const [waitReason, setWaitReason] = useState<WaitReason>('waited');

  const [refreshing, setRefreshing] = useState(false);
  /** A coach answer already saved for this session, if there is one. */
  const [saved, setSaved] = useState<{ reply: string; at: Date } | null>(null);
  /** A transcript from this session still waiting to be told which voice is the
   *  rep. Null once answered, declined, or when there was only one voice. */
  const [attribution, setAttribution] = useState<PendingAttribution | null>(null);
  const [attributing, setAttributing] = useState<string | null>(null);
  /**
   * The call whose voice question the rep has waved away this visit.
   *
   * The local prompt is dismissed by deleting its stored row. The REBUILT one has no row
   * to delete — it is derived from the transcript, so it would reappear on the next
   * render — and it must still be dismissable. Held by session id rather than a bare
   * boolean so opening a different call does not inherit the dismissal.
   */
  const [dismissedQuestion, setDismissedQuestion] = useState<string | null>(null);

  const { user } = useAuth();
  const userId = user?.id ?? null;
  const online = useOnline();

  /**
   * Writes for THIS call that are saved on the phone and not yet on the server.
   *
   * Shown rather than hidden, because the picker above keeps displaying the
   * server's value — which is the truth about the server — and without this the
   * rep would see their tap apparently do nothing. The banner is what makes the
   * difference legible: this is what you asked for, this is why it is not there
   * yet.
   */
  const [queued, setQueued] = useState<OutboxEntry[]>([]);

  const refreshQueued = useCallback(async () => {
    if (!userId || !id) return;
    setQueued(await pendingFor(userId, id));
  }, [userId, id]);

  /**
   * Turns a session and its parts into the rows this screen renders. Shared by
   * the network path and the cache path so the two can never drift into showing
   * the same session differently — which is the bug the parity rule exists for.
   */
  /** True once anything has been rendered, so a late cache read cannot overwrite
   *  a fresher network result. A ref, because the check happens inside an async
   *  callback that would otherwise close over a stale `rows`. */
  const shown = useRef(false);
  /** When the last successful network read landed, so returning to this screen
   *  does not refetch three queries every time the rep glances away. */
  const lastLoad = useRef(0);

  const present = useCallback(
    (
      session: CoachingSession,
      segments: TranscriptSegment[],
      cues: CoachingCue[],
      cachedAt: Date | null,
    ) => {
      shown.current = true;
      setTitle(session.client_label?.trim() || 'Session');
      const waiting = Boolean(session.audio_asset_url) && segments.length === 0;
      /**
       * DO NOT POLL FOR A TRANSCRIPT THAT IS WEEKS OVERDUE.
       *
       * Opening a call recorded long ago with no transcript used to start the
       * same twenty-tick poll as a call recorded a minute ago: twenty requests
       * over five minutes, on a rep's battery, for something that was never
       * coming — and the screen said nothing at all until they were spent.
       *
       * `analysisState` already knows the difference, and it is the same five
       * minutes the poll itself uses, so the two cannot drift apart.
       */
      const stale =
        waiting &&
        analysisState(true, segments.length, session.created_at) === 'stalled';
      setWaitReason(stale ? 'arrived-stale' : 'waited');
      setAwaitingTranscript(waiting && !stale);
      if (stale) setPollingGaveUp(true);
      // Reset when there is nothing left to wait for, so a later session opened
      // on this same screen does not inherit a previous one's giving up.
      if (!waiting) setPollingGaveUp(false);
      setRows(buildRows(session, segments, cues, cachedAt));
      setExportSource({ session, segments, cues });
    },
    [],
  );

  const load = useCallback(async () => {
    if (!id) return;

    // A session id is a uuid. Anything else cannot be one, and asking the server
    // about it produces a database type error rendered as "check your
    // connection" — which sends the rep to fix a network that is fine. This
    // screen was once reached with the id "index" by a bad href; the href is
    // fixed and tested, but an id that cannot exist should read as not found
    // rather than as a fault the rep can do something about.
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      setMissing(true);
      return;
    }

    try {
      const session = await getSession(id);
      if (!session) {
        setMissing(true);
        return;
      }
      setTitle(session.client_label?.trim() || 'Session');

      // Fetched together: the screen is useless with only one of them, and two
      // sequential round trips would show a half-built screen on a slow network.
      const [segments, cues] = await Promise.all([getTranscript(id), getCues(id)]);

      lastLoad.current = Date.now();
      setNotice(null);
      present(session, segments, cues, null);
      // No user id means no scope to cache under, and an unscoped copy is the
      // one thing this store must never write.
      if (userId) writeCachedDetail(userId, id, { session, segments, cues });
      setError(null);
    } catch (e) {
      // Falling back to a copy the rep already has beats an error screen. It is
      // labelled as of a time, never presented as live.
      const cached = userId ? await readCachedDetail(userId, id) : null;
      if (cached) {
        present(cached.session, cached.segments, cached.cues, new Date(cached.at));
        setError(null);
        return;
      }
      setError(
        e instanceof Error && e.message
          ? e.message
          : 'Check your connection and try again.',
      );
    }
  }, [id, userId, present]);

  /**
   * Record how the call ended.
   *
   * The same route the recordings screen uses, and it exists here because a
   * recording whose outcome write failed — which is deliberately non-fatal, the
   * audio being the irreplaceable half — would otherwise only be fixable on the
   * website. A rep should not have to open a laptop to say they sold something.
   *
   * Reloads on success rather than patching local state: the server owns the
   * session, and showing our guess of what it now holds is how the two drift.
   */
  /**
   * Rename the call.
   *
   * The label is what every session is filed under, and it is typed in a van
   * straight after a conversation — so it gets typed wrong. Without this the
   * only way to correct it is the website, which is not where the rep is.
   *
   * The server caps this at 120 characters on update (200 on create); the input
   * enforces the smaller number so a rep is stopped by the field rather than by
   * a rejection after they have finished typing.
   */
  /**
   * What to do when a write does not go through.
   *
   * A failure is not one thing. The server refusing a value the rep can correct,
   * and a stairwell with no signal, look identical at the call site and must not
   * be treated identically: one needs the rep's attention now, the other needs
   * to be remembered and sent later. So the status decides, and the queue only
   * takes the instructions that retrying can actually deliver.
   *
   * Nothing is queued silently. Every branch here ends with the rep being told
   * what happened to what they just asked for.
   */
  const keepOrExplain = useCallback(
    async (e: unknown, entry: Parameters<typeof enqueue>[1], subject: string) => {
      const verdict = classify((e as { status?: number })?.status,
        e instanceof Error && e.message ? e.message : undefined);
      const reason = verdict.ok ? 'transient' : verdict.reason;

      if (reason === 'rejected' || reason === 'conflict') {
        // The server understood and refused. Queuing would send the identical
        // body to the identical rule for a month; the rep is the only one who
        // can change the answer, so it goes to them now.
        setNotice(verdict.ok ? `Could not save ${subject}.` : (verdict.message ?? `Could not save ${subject}.`));
        return;
      }

      if (!userId) {
        // NOT A CONNECTION PROBLEM, and it used to say it was. This branch is
        // `!userId` — the app does not know who is signed in — and it returns
        // WITHOUT queueing, so the edit is gone. "Try again when you have
        // signal" promised a send that nothing had scheduled.
        setNotice(
          `Could not save ${subject} — the app is not signed in, so there is nowhere to save it. Sign in and make the change again.`,
        );
        return;
      }
      await enqueue(userId, entry);
      await refreshQueued();
      setNotice(
        reason === 'needs-shim'
          // Not "the app cannot send this yet", which read as a feature that had not shipped. The server turned
          // this particular write down; the entry is queued and will go on the next sweep that succeeds.
          ? `Saved on this phone. The server turned that write down, so it is queued and will go on the next try — and it can still be set on the website.`
          : `Saved on this phone. It will send ${subject} when you have signal.`,
      );
    },
    [userId, refreshQueued],
  );

  /**
   * A write that went through by hand is proof the server is accepting these
   * again.
   *
   * The sweep sets `stoppedUntilRestart` when a write comes back `needs-shim`,
   * so it does not spend an attempt on every queued entry hitting the same wall.
   * Nothing cleared it. That meant a rep whose writes were held — and who then
   * successfully saved one by hand, because the backend had since gone live —
   * still had a queue that would not move until they killed and reopened the
   * app, with the held items sitting there looking saved.
   *
   * Clearing it and sweeping immediately is the whole fix: the manual success IS
   * the evidence the sweep was waiting for.
   */
  const resumeSendingAfterManualWrite = useCallback(async () => {
    if (!userId || !outboxStopped()) return;
    clearOutboxStop();
    await runOutbox(userId);
    await refreshQueued();
  }, [userId, refreshQueued]);

  const rename = useCallback(
    async (next: string) => {
      const clientLabel = next.trim();
      if (!id || !clientLabel) return;
      // Offline, do not spend a request to be told so. The instruction is kept
      // and the rep is told it is kept — which is the same outcome as a failed
      // attempt, minus the delay and the alarming error.
      if (userId && isOffline(online)) {
        await enqueue(userId, { sessionId: id, kind: 'rename', clientLabel });
        await refreshQueued();
        setNotice(
          outboxStopped()
            ? 'Saved on this phone. The server turned that send down, so it is being held here.'
            : 'Saved on this phone. The name will send when you have signal.',
        );
        return;
      }
      try {
        await coachPatch(`/api/coach/sales-session/${id}`, { clientLabel });
        await resumeSendingAfterManualWrite();
        lastLoad.current = 0;
        await load();
      } catch (e) {
        await keepOrExplain(e, { sessionId: id, kind: 'rename', clientLabel }, 'the new name');
      }
    },
    [id, userId, online, keepOrExplain, refreshQueued, load, resumeSendingAfterManualWrite],
  );

  const setOutcome = useCallback(
    async (outcome: SessionOutcome, dealValue?: number | null) => {
      if (!id) return;
      // `dealValue` is passed through untouched, absent and null included: the
      // route leaves the stored value unchanged on absence and CLEARS it on
      // null, which are different instructions, and the queue carries the same
      // distinction so an offline tap means exactly what an online one meant.
      const entry = { sessionId: id, kind: 'outcome' as const, outcome, ...(dealValue !== undefined ? { dealValue } : {}) };

      if (userId && isOffline(online)) {
        await enqueue(userId, entry);
        await refreshQueued();
        setNotice(
          outboxStopped()
            ? 'Saved on this phone. The server turned that send down, so it is being held here.'
            : 'Saved on this phone. The outcome will send when you have signal.',
        );
        return;
      }
      try {
        await coachPost(`/api/coach/sales-session/${id}/outcome`, {
          outcome,
          ...(dealValue !== undefined ? { dealValue } : {}),
        });
        await resumeSendingAfterManualWrite();
        lastLoad.current = 0;
        await load();
      } catch (e) {
        await keepOrExplain(e, entry, 'the outcome');
      }
    },
    [id, userId, online, keepOrExplain, refreshQueued, load, resumeSendingAfterManualWrite],
  );


  // A16: the coach and this screen act on the SAME conversation, so an answer
  // the rep already has should be visible from here rather than remembered.
  //
  // On FOCUS, not on mount: the router keeps this screen alive underneath the
  // coach, so a rep who asks a question and comes straight back would otherwise
  // see nothing until they relaunched the app.
  useFocusEffect(
    useCallback(() => {
      if (!id || !userId) return;
      let cancelled = false;
      (async () => {
        const stored = await readAnswer(userId, id);
        if (cancelled) return;
        const text = stored?.reply?.trim() || stored?.intel?.trim() || '';
        setSaved(text && stored ? { reply: text, at: new Date(stored.at) } : null);
        // Read on focus, not once at mount: the sweep runs from the layout and
        // may have emptied the queue while the rep was on another screen.
        if (!cancelled) await refreshQueued();
      })();
      return () => {
        cancelled = true;
      };
    }, [id, userId, refreshQueued]),
  );

  /**
   * Transcript and cues are append-only and land AFTER the call — transcription
   * runs on upload. So this screen must be able to fill in without being left
   * and re-entered.
   *
   * Refetch on focus is the reliable half: realtime is documented as very likely
   * off for this backend (see subscribeSession), so a subscription alone would
   * be a promise the database does not keep. The floor stops three queries
   * firing every time the rep glances at the coach and comes back.
   */
  useFocusEffect(
    useCallback(() => {
      if (!shown.current) return; // the first load is already in flight
      if (Date.now() - lastLoad.current < REFETCH_AFTER_MS) return;
      load();
    }, [load]),
  );

  // The enhancement, not the guarantee. If the tables are in the realtime
  // publication a landing transcript appears on its own; if they are not, this
  // connects and never fires, and the focus refetch above still covers it.
  useEffect(() => {
    if (!id) return;
    const stop = subscribeSession(id, () => {
      lastLoad.current = 0; // let the next read through immediately
      load();
    });
    return stop;
  }, [id, load]);

  /**
   * While a transcript is on its way, look again.
   *
   * WHY THIS EXISTS. Realtime is documented as very likely off for this backend,
   * and the focus refetch only fires when the rep leaves the screen and comes
   * back. So a rep who uploads a call and sits looking at "still being turned
   * into a transcript" would watch that sentence forever, with pull-to-refresh
   * as the only way forward — and no reason to think it was needed.
   *
   * WHY IT IS BOUNDED, AND HARD. A poll on a phone is a battery and data cost
   * paid every tick, and this one runs while the screen is OPEN, which is exactly
   * when a rep is watching the battery indicator. So: only while there is
   * genuinely something to wait for, only while this screen is focused, every
   * fifteen seconds, and it STOPS after five minutes rather than running for the
   * rest of the day behind a transcription that failed.
   *
   * GIVING UP IS SAID OUT LOUD, not hidden — see the note the screen shows when
   * this stops. A rep who is told the app is still checking, while it quietly is
   * not, is worse off than one who was never told anything.
   */
  useFocusEffect(
    useCallback(() => {
      if (!awaitingTranscript) return;
      let ticks = 0;
      const timer = setInterval(() => {
        ticks += 1;
        if (ticks > TRANSCRIPT_POLL_LIMIT) {
          clearInterval(timer);
          setPollingGaveUp(true);
          return;
        }
        lastLoad.current = 0; // this read is the point; do not let the floor eat it
        load();
      }, TRANSCRIPT_POLL_MS);
      return () => clearInterval(timer);
    }, [awaitingTranscript, load]),
  );

  // An unattributed transcript is the loudest thing this screen can say, so it
  // is read on focus like the saved coach answer — a rep who uploads in the
  // background and opens the session later must still find the question.
  useFocusEffect(
    useCallback(() => {
      if (!id || !userId) return;
      let cancelled = false;
      (async () => {
        const pending = await readPendingAttribution(userId, id);
        if (!cancelled) setAttribution(pending);
      })();
      return () => {
        cancelled = true;
      };
    }, [id, userId]),
  );

  /**
   * The voice question actually shown, from whichever source can answer it.
   *
   * TWO SOURCES, ONE QUESTION. The local store is written when THIS phone uploaded the
   * recording, and it is the right source for a call the rep just finished — it still
   * holds the diarized clusters, so a two-voice call can ask which is which. It is EMPTY
   * for a call the server recovered: the sweep re-reads audio dropped weeks ago and saves
   * the words as `unknown`, and no device has any record of it. Rebuilding the question
   * from the transcript is what stops that recovered call being a wall of unattributed
   * text the rep can look at but never fix.
   *
   * Derived rather than stored, deliberately: a second piece of state set from an effect
   * is how the two sources would drift, and the labelled transcript that comes back after
   * an answer makes this fall to null on its own with nothing to reset.
   */
  const question = useMemo(() => {
    if (attribution) {
      // From THIS device's store: it still holds the diarized clusters, so a two-voice call
      // can ask which is which, and the answer maps cluster to speaker.
      return { from: 'device' as const, speakers: attribution.speakers, segments: attribution.segments };
    }
    if (dismissedQuestion === id) return null;
    const speakers = speakersFromTranscript(exportSource?.segments ?? []);
    // From the SERVER's transcript: one voice, no clusters, and nothing to send back —
    // the server relabels rows it already has.
    return speakers ? { from: 'transcript' as const, speakers, segments: [] } : null;
  }, [attribution, dismissedQuestion, id, exportSource]);

  /**
   * Tell the server which voice is the rep.
   *
   * The segments are echoed back because the labelling route needs them: the
   * stored transcript has already been flattened and no longer carries the
   * diarized ids, so this payload is the only copy that can answer the question.
   */
  const attribute = useCallback(
    async (agentSpeakerId: string) => {
      if (!id || !userId || !question) return;
      setAttributing(agentSpeakerId);
      try {
        if (question.from === 'transcript') {
          /*
            The words are already on the server, with their timing. Sending them back would
            mean rebuilding every offset from `spoken_at` and re-uploading a payload that a
            long call could overflow — and a payload that forgot the offsets would delete
            the timing while making the call coachable. This route relabels the stored rows
            and never touches `spoken_at`, so neither failure is reachable.
          */
          await coachPost(`/api/coach/sales-session/${id}/attribute-unlabelled`, {
            mine: agentSpeakerId !== NOT_THE_REP,
          });
        } else {
          await coachPost(`/api/coach/sales-session/${id}/label-transcript`, {
            agentSpeakerId,
            segments: question.segments,
          });
        }
        await clearPendingAttribution(userId, id);
        setAttribution(null);
        lastLoad.current = 0;
        await load();
      } catch (e) {
        const status = (e as { status?: number })?.status;
        // A signed-out rep must not be told to use the website instead — they
        // cannot use that either until they sign in. coach-api decides (2.2).
        const why = (e as { authFailure?: 'signed-out' | 'route' })?.authFailure;
        setNotice(
          why === 'signed-out'
            ? authFailureMessage('signed-out')
            : status === 409
            ? 'This call already has a transcript, so it was not changed.'
            : // NOT "not switched on for the app" any more. That sentence was
              // written when the labelling route was web-cookie-only, and it
              // stopped being true: with a real Bearer token the route now
              // answers 400 for a bad body, which means it authenticates the app
              // perfectly well (verified against production, 4 September). Left
              // as it was, a rep whose PITCH had been deleted was told the
              // feature did not exist on their phone and sent to a website where
              // the same thing would have failed.
              status === 403
              ? 'This call belongs to someone else, so it cannot be relabelled here.'
              : status === 404
                ? 'That call or the pitch it points at could not be found. Pull down to refresh and try again.'
                : `${reachError(e, online, 'the server')} Your transcript is unchanged.`,
        );
      } finally {
        setAttributing(null);
      }
    },
    [id, userId, question, load, online],
  );

  // Show the cached copy first if there is one, so a session opens to content
  // instead of a spinner, then let load() reconcile it against the server.
  useEffect(() => {
    if (!id || !userId) return;
    let cancelled = false;
    (async () => {
      const cached = await readCachedDetail(userId, id);
      // The network answered while this read was in flight. Its result is
      // fresher, so the cache is dropped rather than painted over it.
      if (cancelled || !cached || shown.current) return;
      present(cached.session, cached.segments, cached.cues, new Date(cached.at));
    })();
    return () => {
      cancelled = true;
    };
  }, [id, userId, present]);

  // useFocusEffect, not useEffect: this is what every other loading screen in
  // the app uses, and setState inside a bare mount effect triggers the
  // cascading render React warns about. Returning to the screen also gets
  // fresh figures rather than whatever was true when it first mounted.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (missing) {
    return (
      <SafeAreaView className="flex-1 bg-background px-5" edges={['bottom']}>
        <Stack.Screen options={{ title: 'Not found' }} />
        <View className="flex-1 items-start justify-center gap-3">
          <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
            That session is not here
          </Text>
          <Text className="font-body text-base leading-relaxed text-muted-foreground">
            It may have been removed, or the link pointed somewhere you do not have
            access to. Nothing you were doing was lost.
          </Text>
          {/* replace, not back: a cold arrival from a link has no back stack. */}
          <Pressable
            onPress={() => router.replace('/(app)/(tabs)/sessions')}
            accessibilityRole="button"
            accessibilityLabel="Go to your sessions"
            className="mt-2 min-h-7 justify-center rounded-md bg-primary px-5 active:bg-primary-pressed"
          >
            <Text className="font-strong text-base text-primary-foreground">Your sessions</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView className="flex-1 bg-background px-5" edges={['bottom']}>
        <View className="flex-1 items-start justify-center gap-3">
          <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
            Could not load this session
          </Text>
          <Text className="font-body text-base leading-relaxed text-muted-foreground">{error}</Text>
          <Pressable
            onPress={load}
            accessibilityRole="button"
            accessibilityLabel="Try again"
            className="mt-2 min-h-7 justify-center rounded-md bg-primary px-5 active:bg-primary-pressed"
          >
            <Text className="font-strong text-base text-primary-foreground">Try again</Text>
          </Pressable>

          {/* A way out, not only a way to retry. This screen can be arrived at by
              `replace`, which leaves no back stack — so without this a rep whose
              load keeps failing has no route anywhere, which is exactly what a
              real device showed. */}
          <Pressable
            onPress={() => router.replace('/(app)/(tabs)/sessions')}
            accessibilityRole="button"
            accessibilityLabel="Go to your sessions"
            className="min-h-7 justify-center active:opacity-70"
          >
            <Text className="font-emphasis text-base text-primary">Your sessions</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (!rows) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background" edges={['bottom']}>
        <ActivityIndicator color={C.primary} accessibilityLabel="Loading this call" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <Stack.Screen
        options={{
          title,
          headerRight: () =>
            exportSource ? (
              <Pressable
                onPress={async () => {
                  // The OS share sheet, not a file we invent a destination for:
                  // the rep chooses where their own record goes. The text is
                  // built here rather than at load — this is the one moment it
                  // is actually needed, and a long transcript is expensive.
                  try {
                    await Share.share({ message: buildExport(exportSource) });
                  } catch (e) {
                    // Share.share RESOLVES when the sheet is dismissed and
                    // REJECTS when it genuinely fails — so this branch is a real
                    // failure, not a change of mind. Swallowing it meant a rep
                    // tapped Share, watched nothing happen, and had no idea
                    // whether the app was broken or they had mis-tapped.
                    //
                    // THE PLATFORM'S OWN MESSAGE NO LONGER GOES ON SCREEN, and
                    // that is a correction rather than a simplification. This
                    // used to show `e.message` whenever there was one and fall
                    // back to the sentence below otherwise — which inverted the
                    // quality of the two: the more the platform said, the worse
                    // the rep read. "The operation couldn't be completed" tells
                    // them nothing and offers nothing, while the fallback names
                    // the likely cause AND what to do instead.
                    //
                    // The detail is not thrown away. It goes to the crash log,
                    // where it reaches somebody who can act on it through
                    // Report a problem — which is the whole reason that log
                    // exists.
                    void recordCrash(e, 'Sharing a transcript');
                    setNotice(
                      'Could not share this transcript. A very long call may be too large for some apps — try sending it to Notes or Files.',
                    );
                  }
                }}
                accessibilityRole="button"
                accessibilityLabel="Share this transcript"
                hitSlop={12}
                // A base-size text line is about 20dp; with the hitSlop alone
                // that is 44dp — enough for iOS and SHORT of the 48dp Android
                // floor. The explicit minimum makes it 48 before the hitSlop,
                // which is the rule as written rather than the rule as it
                // happens to work out on one platform.
                className="min-h-7 justify-center active:opacity-70"
              >
                <Text className="font-emphasis text-base text-primary">Share</Text>
              </Pressable>
            ) : null,
        }}
      />
      {question ? (
        <View className="mx-5 mt-3 rounded-md border border-primary px-3 py-3">
          <SpeakerPicker
            speakers={question.speakers}
            onPick={attribute}
            busySpeakerId={attributing}
          />
          <Pressable
            onPress={async () => {
              if (!userId || !id) return;
              // Clear both sources: the stored row if this phone made the recording, and
              // the derived one, which has no row and would otherwise return next render.
              await clearPendingAttribution(userId, id);
              setAttribution(null);
              setDismissedQuestion(id);
            }}
            accessibilityRole="button"
            accessibilityLabel="Not now — leave the transcript unattributed"
            className="mt-3 min-h-7 justify-center active:opacity-70"
          >
            <Text className="font-emphasis text-sm text-muted-foreground">Not now</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Said only once the app has actually stopped. While it is still checking
          the screen says so in the transcript note itself; announcing "still
          checking" twice would be noise, and announcing it after it stopped
          would be a lie. */}
      {pollingGaveUp ? (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          className="mx-5 mt-3 rounded-md border border-border-control px-3 py-3"
        >
          <Text className="font-strong text-base text-foreground">
            {transcriptWaitTitle(waitReason)}
          </Text>
          <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
            {transcriptWaitBody(waitReason)}
          </Text>
        </View>
      ) : null}

      {queued.length > 0 ? (
        <View className="mx-5 mt-3 rounded-md border border-border-control px-3 py-3">
          <Text className="font-emphasis text-sm text-foreground">Waiting to send</Text>
          <Text className="mt-1 font-body text-xs leading-relaxed text-muted-foreground">
            Saved on this phone. The call above still shows what the server has.
          </Text>
          {queued.map((entry) => (
            <View key={entry.id} className="mt-3 flex-row items-start gap-3">
              <View className="flex-1">
                <Text className="font-body text-sm text-foreground">
                  {entry.kind === 'rename'
                    ? `Name it “${entry.clientLabel}”`
                    : `Mark it ${outcomeLabel(entry.outcome ?? null)}${
                        entry.dealValue != null ? ` · ${money(entry.dealValue)}` : ''
                      }`}
                </Text>
                {/* The server's own words when there are any. "Could not save
                    that" tells a rep to try the same thing again; "Deal value
                    must be at most 100000000" tells them what to change. */}
                {entry.lastError ? (
                  <Text className="mt-1 font-body text-xs leading-relaxed text-muted-foreground">
                    {entry.lastError}
                  </Text>
                ) : null}
              </View>
              <Pressable
                onPress={async () => {
                  if (!userId) return;
                  await removeEntry(userId, entry.id);
                  await refreshQueued();
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  entry.kind === 'rename'
                    ? 'Discard the new name waiting to send'
                    : 'Discard the outcome waiting to send'
                }
                hitSlop={12}
                className="min-h-7 justify-center active:opacity-70"
              >
                <Text className="font-emphasis text-sm text-muted-foreground">Discard</Text>
              </Pressable>
            </View>
          ))}
          <Pressable
            onPress={async () => {
              if (!userId) return;
              // `force` skips the cooldown only. It cannot override the hard stop
              // the sweep sets when the server is refusing these outright, which
              // is the point: a button that pretends to retry an impossible
              // request teaches a rep to keep pressing it.
              await runOutbox(userId, { force: true });
              await refreshQueued();
              lastLoad.current = 0;
              await load();
            }}
            accessibilityRole="button"
            accessibilityLabel="Try sending these now"
            className="mt-3 min-h-7 justify-center active:opacity-70"
          >
            <Text className="font-emphasis text-sm text-primary">Try now</Text>
          </Pressable>
        </View>
      ) : null}

      {notice ? (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          className="mx-5 mt-3 flex-row items-start gap-2 rounded-md border border-destructive px-3 py-3"
        >
          <Text className="flex-1 font-body text-sm leading-relaxed text-destructive">
            {notice}
          </Text>
          <Pressable
            onPress={() => setNotice(null)}
            accessibilityRole="button"
            accessibilityLabel="Dismiss this message"
            hitSlop={12}
            className="min-h-7 justify-center active:opacity-70"
          >
            <Text className="font-emphasis text-sm text-destructive">Dismiss</Text>
          </Pressable>
        </View>
      ) : null}

      {/* Virtualized: a long pitch produces an unbounded number of segments, and
          the contract records this as the longest list in the app. */}
      <FlatList
        data={rows}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await load();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={C['muted-foreground']}
          />
        }
        keyExtractor={(row, i) =>
          row.kind === 'segment'
            ? `s-${row.segment.id}`
            : row.kind === 'cue'
              ? `c-${row.cue.id}`
              : `${row.kind}-${i}`
        }
        contentContainerClassName="px-5 pb-8"
        /*
         * Virtualization for a list that can now run to thousands of rows. A
         * two-hour call reads completely rather than stopping at the server's
         * row cap, so this screen got a great deal longer.
         *
         * Rows are variable height (a spoken line wraps unpredictably), so
         * getItemLayout is not available and these numbers are the only lever.
         * They are reasoned, NOT measured: nothing here has run on a device, and
         * the right values depend on real row heights and a real scroll. Worth
         * revisiting with a profiler once there is a build to profile.
         *
         * removeClippedSubviews is deliberately left off — it has a history of
         * blanking rows on iOS, and trading correctness for an unmeasured gain
         * is the wrong way round.
         */
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={11}
        renderItem={({ item }) => <RowView row={item} onSetOutcome={setOutcome} onRename={rename} />}
        /*
         * The PDF export sits AFTER the transcript rather than in the header or
         * beside the primary action, and both of those were the alternatives.
         *
         * The header already carries Share, and a second text button next to it
         * truncates the title on a long client label. The footer bar carries this
         * screen's ONE primary action (ask the coach), and the design law is
         * explicit that five emphasised elements means none are.
         *
         * Here it lands where the intent does: a rep who has just read the call
         * to the end is the rep who wants to send it. It is a real control with a
         * real label, not a gesture and not an icon.
         */
        ListFooterComponent={
          exportSource ? (
            <Pressable
              onPress={async () => {
                setNotice(null);
                const doc = buildSessionDoc(exportSource);
                const out = await shareSessionPdf(doc, exportSource.session.started_at);
                if (out.ok) return;
                if (out.reason === 'unavailable') {
                  setNotice(
                    'This device cannot share files. Share still sends the call as text.',
                  );
                  return;
                }
                // The platform's own message is not put on screen - see the note
                // on the Share button for why "The operation couldn't be
                // completed" is worse for a rep than a sentence naming a likely
                // cause. The detail goes where somebody can act on it.
                void recordCrash(out.error, 'Exporting a session PDF');
                setNotice(
                  'Could not make the PDF. Try again, and use Share to send the call as text if it keeps failing.',
                );
              }}
              accessibilityRole="button"
              accessibilityLabel="Save this call as a PDF"
              className="mt-6 min-h-11 items-center justify-center rounded-lg border border-border-control px-4 active:bg-surface"
            >
              <Text className="font-emphasis text-base text-primary">Save as PDF</Text>
            </Pressable>
          ) : null
        }
      />

      {/* This screen's one primary action. A16: the transcript above and the
          coach act on the SAME conversation, so the rep should never have to
          retype it to ask about it. */}
      <View className="gap-2 border-t border-border px-5 pb-2 pt-3">
        {/* What they already asked for, before they are offered another round
            trip they would pay for. One line, because the full answer is one tap
            away and this is a reminder, not a second copy of it. */}
        {saved ? (
          <View>
            <Text className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground">
              You asked the coach · {shortDate(saved.at.toISOString())},{' '}
              {clockTime(saved.at.toISOString())}
            </Text>
            <Text numberOfLines={2} className="mt-1 font-body text-sm leading-relaxed text-foreground">
              {saved.reply}
            </Text>
          </View>
        ) : null}
        <Pressable
          onPress={() => router.push({ pathname: '/(app)/coach', params: { sessionId: id } })}
          accessibilityRole="button"
          accessibilityLabel={
            saved ? 'Open what the coach said about this session' : 'Ask the coach about this session'
          }
          className="min-h-7 items-center justify-center rounded-md bg-primary px-5 active:bg-primary-pressed"
        >
          <Text className="font-strong text-base text-primary-foreground">
            {saved ? 'See what the coach said' : 'Ask the coach about this'}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function RowView({
  row,
  onSetOutcome,
  onRename,
}: {
  row: Row;
  onSetOutcome: (outcome: SessionOutcome, dealValue?: number | null) => Promise<void>;
  onRename: (next: string) => Promise<void>;
}) {
  if (row.kind === 'meta') return <Meta session={row.session} />;

  if (row.kind === 'outcome') {
    return <OutcomeRow session={row.session} onSet={onSetOutcome} />;
  }

  if (row.kind === 'rename') {
    return <RenameRow session={row.session} onRename={onRename} />;
  }

  // Says plainly that this is a saved copy and when it was taken. A rep deciding
  // whether the coach cued them needs to know they are looking at yesterday.
  if (row.kind === 'audio') {
    return <SessionAudio assetUrl={row.assetUrl} />;
  }

  if (row.kind === 'read') {
    return <SessionReadCard sessionId={row.sessionId} segments={row.segments} />;
  }

  if (row.kind === 'debrief') {
    return (
      <AfterPitchCard
        sessionId={row.sessionId}
        hasAudio={row.hasAudio}
        segmentCount={row.segmentCount}
        unattributedCount={row.unattributedCount}
      />
    );
  }

  if (row.kind === 'stale') {
    return (
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        className="mt-4 rounded-md border border-border-control px-3 py-3"
      >
        <Text className="font-strong text-base text-foreground">Saved copy</Text>
        <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
          Showing this session as of {shortDate(row.at.toISOString())},{' '}
          {clockTime(row.at.toISOString())}. Anything added since will appear when
          you have signal.
        </Text>
      </View>
    );
  }

  if (row.kind === 'heading') {
    return (
      <Text
        accessibilityRole="header"
        className="mt-6 font-strong text-lg text-foreground"
      >
        {row.text}
        {row.count > 0 ? (
          <Text className="font-body text-base text-muted-foreground"> · {row.count}</Text>
        ) : null}
      </Text>
    );
  }

  if (row.kind === 'note') {
    return (
      <Text className="mt-3 font-body text-base leading-relaxed text-muted-foreground">
        {row.text}
      </Text>
    );
  }

  if (row.kind === 'segment') {
    const { speaker, text, spoken_at } = row.segment;
    const isRep = speaker === 'agent';
    const isCustomer = speaker === 'customer';
    const who = isRep ? 'You' : isCustomer ? 'Customer' : 'Unattributed';
    return (
      // A continuing line sits close to the one above it and a new turn opens a
      // gap. That spacing IS the turn-taking: it can be read at arm's length,
      // scrolling, without reading a single word.
      <View className={row.startsTurn ? 'mt-5' : 'mt-2'}>
        {row.startsTurn ? (
          <Text className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground">
            {who}
            {spoken_at ? ` · ${clockTime(spoken_at)}` : ''}
          </Text>
        ) : null}
        {/* Speaker is carried by the label, never by colour alone. The rule is a
            second, redundant channel for the rep's own lines — their side of the
            conversation is what the call is being read for.

            UNATTRIBUTED IS NOT A THIRD SPEAKER. It is an unanswered question, and
            it is set in the muted colour to look unresolved rather than like a
            known participant — a rep should be able to see at a glance that the
            app does not know who said this, not have to read the label to
            discover it. */}
        <View className={isRep ? 'mt-1 border-l-2 border-border-control pl-3' : 'mt-1 pl-3'}>
          <Text
            className={`font-body text-base leading-relaxed ${
              isRep || isCustomer ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {text}
          </Text>
        </View>
      </View>
    );
  }

  const { text, mode, delivered_at } = row.cue;
  return (
    <View className="mt-4 rounded-md border border-border-control px-3 py-3">
      <Text className="font-emphasis text-xs uppercase tracking-widest text-primary">
        {mode === 'guide_response' ? 'Guided response' : 'Suggestion'}
        {delivered_at ? ` · ${clockTime(delivered_at)}` : ''}
      </Text>
      <Text className="mt-2 font-body text-base leading-relaxed text-foreground">{text}</Text>
    </View>
  );
}

/**
 * The rows this screen renders, built once so the network path and the cache
 * path can never show the same session two different ways.
 */
function buildRows(
  session: CoachingSession,
  segments: TranscriptSegment[],
  cues: CoachingCue[],
  cachedAt: Date | null,
): Row[] {
  // One account, in the order it happened: the cues sit where the coach
  // actually delivered them rather than in a separate list underneath, so a
  // rep can see what was offered at the moment the objection landed.
  const { entries, unplacedCues } = buildTimeline(segments, cues);

  const built: Row[] = [{ kind: 'meta', session }];
  if (cachedAt) built.push({ kind: 'stale', at: cachedAt });
  // Offered only when the server actually says it holds the audio. A play
  // control that produces silence is worse than none: a rep would conclude the
  // recording was lost rather than that it was never uploaded.
  if (session.audio_asset_url) {
    built.push({ kind: 'audio', assetUrl: session.audio_asset_url });
  }
  // Under the facts and the audio, above the outcome: a rep who has just
  // listened back is exactly who wants to read how it went.
  built.push({
    kind: 'debrief',
    sessionId: session.id,
    hasAudio: Boolean(session.audio_asset_url),
    segmentCount: segments.length,
    // Counted here rather than asked for: the screen already holds every segment, so
    // the card can be told why a debrief is not ready instead of promising one that
    // would come back blank.
    unattributedCount: segments.filter((s) => s.speaker === 'unknown').length,
  });
  /*
    "YOUR READ", under the debrief, and the app has never had it.

    The debrief is the between-doors note; this is the deep read of the whole conversation - what
    worked, what to work on, and the play the rep ran without naming it. The web has had it since the
    coach was built and the phone never did, so a rep on the doors could see their transcript and their
    scores but not the thing that reads the call.

    It became load-bearing on 10 September, when the sessions list started showing "Read didn't finish"
    on a call where the coach came back blank. That chip had nothing behind it until now.

    The segments go in rather than a count: the card has to tell "no read yet" apart from "this
    recording caught no speech", and only the words can say which. It never generates on open - a read
    is a real LLM call over a whole conversation, so it is offered, not spent.
  */
  built.push({
    kind: 'read',
    sessionId: session.id,
    segments: segments.map((s) => ({ speaker: s.speaker, text: s.text })),
  });
  // Directly under the facts, because setting it is the one thing a rep can
  // change about a finished call — and an unset outcome is the difference
  // between this call counting toward their numbers and not.
  built.push({ kind: 'outcome', session });
  built.push({ kind: 'rename', session });

  if (segments.length === 0) {
    built.push({ kind: 'heading', text: 'Conversation', count: 0 });
    // TWO DIFFERENT SILENCES, and until now they read identically.
    //
    // `audio_asset_url` is the server saying it holds the audio. With audio and
    // no segments, transcription simply has not finished — the rep should come
    // back. With no audio at all, nothing was ever recorded for this call and
    // there is nothing to wait for.
    //
    // Telling a rep "recordings are transcribed after they upload" when no
    // recording exists sends them to wait for something that will never arrive;
    // telling a rep whose upload finished two minutes ago that there is no
    // transcript reads as the call having been lost. The app knows the
    // difference, so it says it.
    built.push({
      kind: 'note',
      text: session.audio_asset_url
        ? 'The recording is on the server and is still being turned into a transcript. It usually takes a few minutes for a call of this length. Pull down to check again.'
        : 'No recording was sent for this call, so there is no transcript. You can still set how it ended.',
    });
    built.push({ kind: 'heading', text: 'Coach cues', count: cues.length });
    if (cues.length === 0) {
      built.push({ kind: 'note', text: 'The coach did not cue during this session.' });
    } else {
      for (const cue of cues) built.push({ kind: 'cue', cue });
    }
  } else {
    built.push({ kind: 'heading', text: 'Conversation', count: segments.length });
    // A cue between two of the rep's lines ENDS the turn: the coach interrupted,
    // and the line after it is the rep speaking again after being prompted —
    // which is exactly the moment the transcript exists to show. Tracking the
    // previous speaker through cues would hide it.
    let previousSpeaker: string | null | undefined;
    for (const entry of entries) {
      if (entry.kind === 'segment') {
        const speaker = entry.segment.speaker ?? null;
        built.push({
          kind: 'segment',
          segment: entry.segment,
          startsTurn: speaker !== previousSpeaker,
        });
        previousSpeaker = speaker;
      } else {
        built.push({ kind: 'cue', cue: entry.cue });
        previousSpeaker = undefined;
      }
    }
    if (cues.length === 0) {
      built.push({
    kind: 'note',
    text: 'The coach did not cue during this session.',
      });
    }
    // Cues the server never timestamped cannot honestly be placed in the
    // conversation, so they are shown apart and SAID to be unplaced rather
    // than dropped into a position that was never recorded.
    if (unplacedCues.length > 0) {
      built.push({ kind: 'heading', text: 'Cues without a time', count: unplacedCues.length });
      built.push({
    kind: 'note',
    text: 'These were delivered during the session, but no time was recorded for them.',
      });
      for (const cue of unplacedCues) built.push({ kind: 'cue', cue });
    }
  }

  return built;
}

/**
 * Listening back to a call the server holds.
 *
 * WHY IT IS OFFERED RATHER THAN MOUNTED. A player holds the device's audio
 * session for as long as it exists, and on iOS a live player is exactly what
 * makes the NEXT recording come out quiet — a bug a rep would meet one screen
 * away from where it was caused. So nothing is created until the rep asks.
 *
 * WHY THE LINK IS FETCHED ON THE TAP, not on load. Signing a URL is a network
 * round trip, and most visits to a session are to read it. Spending a request on
 * every open, for a control most reps will not press, is a data allowance spent
 * on nothing.
 *
 * WHAT IT SAYS WHEN IT CANNOT. The recording is on the server either way — this
 * is a link that could not be made, not a call that was lost — and the wording
 * says exactly that. A rep who reads "could not play" and concludes their
 * recording is gone has been told something false by omission.
 */
function SessionAudio({ assetUrl }: { assetUrl: string }) {
  // Its own reading: this is a separate component from the screen above.
  const online = useOnline();
  const [uri, setUri] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'failed'>('idle');

  if (!RECORDING_AVAILABLE) return null;

  if (uri) return <RecordingPlayer fileUri={uri} />;

  return (
    <View className="mt-4">
      <Pressable
        onPress={async () => {
          setState('loading');
          const signed = await signedRecordingUrl(assetUrl);
          if (signed) {
            setUri(signed);
            setState('idle');
          } else {
            setState('failed');
          }
        }}
        disabled={state === 'loading'}
        accessibilityRole="button"
        accessibilityLabel="Listen to this call"
        accessibilityState={{ disabled: state === 'loading', busy: state === 'loading' }}
        className="min-h-7 items-center justify-center rounded-md border border-border-control px-5 py-3 disabled:opacity-50 active:opacity-70"
      >
        <Text className="font-emphasis text-base text-foreground">
          {state === 'loading' ? 'Getting the recording…' : 'Listen to this call'}
        </Text>
      </Pressable>

      {state === 'failed' ? (
        <Text
          accessibilityLiveRegion="polite"
          className="mt-2 font-body text-sm leading-relaxed text-muted-foreground"
        >
          {/* Says what is CERTAIN (the call is safe) and then only what it has
              actually checked. It used to assert "this is a connection problem"
              on any failure, including on a phone with full signal. */}
          {isOffline(online)
            ? 'Could not get the recording just now. It is still on the server — this is not a lost call. Try again when you have signal.'
            : 'Could not get the recording just now. It is still on the server — this is not a lost call. Your connection looks fine, so try again; if it keeps happening somebody needs to look at the server.'}
        </Text>
      ) : null}
    </View>
  );
}

/**
 * The call's name.
 *
 * Editable in place rather than behind a pencil icon: there is one thing to edit
 * on this screen and hiding it behind a second tap buys nothing. Saved on blur,
 * and only when it actually changed — opening the keyboard and closing it again
 * should not write to the server.
 *
 * A blank is refused rather than sent: the server requires a label, and clearing
 * it would ask for a rejection the rep would read as the app being broken.
 */
function RenameRow({
  session,
  onRename,
}: {
  session: CoachingSession;
  onRename: (next: string) => Promise<void>;
}) {
  const current = session.client_label ?? '';
  const [text, setText] = useState(current);
  const [focused, setFocused] = useState(false);
  const [saving, setSaving] = useState(false);

  return (
    <View className="mt-6">
      <Text className="font-emphasis text-sm text-muted-foreground">Who this was with</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        editable={!saving}
        accessibilityLabel="Who this was with"
        maxLength={120}
        placeholder="Rowan &amp; Co, the corner unit"
        placeholderTextColor={C['muted-foreground']}
        returnKeyType="done"
        onFocus={() => setFocused(true)}
        onBlur={async () => {
          setFocused(false);
          const next = text.trim();
          if (!next) {
            // Put back what it was, rather than leaving an empty box that looks
            // like it saved something.
            setText(current);
            return;
          }
          if (next === current.trim()) return;
          setSaving(true);
          try {
            await onRename(next);
          } finally {
            setSaving(false);
          }
        }}
        className={`mt-2 min-h-7 rounded-md border px-3 py-3 font-body text-base text-foreground ${
          focused ? 'border-primary' : 'border-border-control'
        }`}
      />
    </View>
  );
}

/**
 * The outcome, set or settable.
 *
 * Shown whether or not one exists: a rep who marked a call wrong at the door
 * needs to be able to correct it, and hiding the control once an answer is
 * recorded would make the first answer feel permanent.
 *
 * The line about counting is stated only when it is TRUE — when nothing is set
 * yet. Repeating it after the fact would read as nagging about something they
 * have already done.
 */
function OutcomeRow({
  session,
  onSet,
}: {
  session: CoachingSession;
  onSet: (outcome: SessionOutcome, dealValue?: number | null) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [value, setValue] = useState(session.deal_value == null ? '' : String(session.deal_value));
  const [focused, setFocused] = useState(false);
  // Shown after a real save, so the rep sees that the number landed. The form rules ask
  // for this explicitly: "confirm success visibly".
  const [saved, setSaved] = useState(false);

  /*
    WHY THERE IS A BUTTON HERE AND NOT JUST A BLUR HANDLER.

    Measured on production 10 September 2026: of 14 sessions marked SOLD across the company,
    NOT ONE carries a deal value - so `revenue` and `avgDealSize` on the KPI screen can
    never produce a number for anybody, for any rep.

    The field was not missing. It was unreachable at the end. `keyboardType="decimal-pad"`
    renders a keypad with NO return key on iOS, so `returnKeyType="done"` is a no-op and the
    only way to blur - the only thing that saved - was to tap somewhere else on the screen.
    A rep who types the amount and swipes back loses it, and is told nothing.

    So the commit is now an explicit, visible action with a 44pt target, and the blur is
    kept as well: whichever the rep reaches first, the number is saved.
  */
  const parsed = parseMoney(value);
  const stored = session.deal_value ?? null;
  const unsaved = parsed !== stored;

  const commit = useCallback(async () => {
    if (!unsaved) return;
    setSaving(true);
    try {
      await onSet('sold', parsed);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }, [unsaved, parsed, onSet]);

  return (
    <View className="mt-6 border-t border-border pt-2">
      <OutcomePicker
        value={session.outcome}
        disabled={saving}
        label={session.outcome ? 'How it ended' : 'How did it end?'}
        hint={
          session.outcome
            ? undefined
            : 'Until this is set, the call is not counted in your numbers.'
        }
        onChange={async (next) => {
          if (next === session.outcome) return;
          setSaving(true);
          try {
            await onSet(next);
          } finally {
            setSaving(false);
          }
        }}
      />

      {/* Asked only for a sale, because it is the only outcome it means anything
          for — and revenue and average deal size are computed from it. */}
      {session.outcome === 'sold' ? (
        <View className="mt-4">
          <Text className="font-emphasis text-sm text-muted-foreground">What was it worth?</Text>
          <Text className="mt-1 font-body text-xs text-muted-foreground">
            Dollars. Leave blank if you would rather not say.
          </Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            editable={!saving}
            keyboardType="decimal-pad"
            accessibilityLabel="What was it worth?"
            placeholder="1500"
            placeholderTextColor={C['muted-foreground']}
            returnKeyType="done"
            onFocus={() => {
              setFocused(true);
              setSaved(false);
            }}
            onBlur={() => {
              setFocused(false);
              void commit();
            }}
            className={`mt-2 min-h-7 rounded-md border px-3 py-3 font-body text-base tabular-nums text-foreground ${
              focused ? 'border-primary' : 'border-border-control'
            }`}
          />

          {/* The reachable end of the field. Present only when there is something to save,
              so it never sits there inviting a tap that would do nothing. */}
          {unsaved ? (
            <Pressable
              onPress={() => void commit()}
              disabled={saving}
              accessibilityRole="button"
              accessibilityLabel={
                parsed == null
                  ? 'Save, leaving what it was worth blank'
                  : `Save what it was worth, ${money(parsed)}`
              }
              accessibilityState={{ disabled: saving }}
              className={`mt-3 min-h-7 items-center justify-center rounded-md bg-primary px-5 py-3 active:bg-primary-pressed ${
                saving ? 'opacity-50' : ''
              }`}
            >
              <Text className="font-strong text-base text-primary-foreground">
                {saving ? 'Saving' : 'Save'}
              </Text>
            </Pressable>
          ) : null}

          {saved && !unsaved ? (
            <Text
              accessibilityRole="text"
              className="mt-2 font-emphasis text-sm text-muted-foreground"
            >
              {stored == null ? 'Saved — left blank.' : `Saved — ${money(stored)}.`}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * The session's facts. Presented plainly, with no verdict attached — asset A11:
 * the app surfaces what happened and the rep renders the judgement.
 */
function Meta({ session }: { session: CoachingSession }) {
  const facts: { label: string; value: string }[] = [];

  facts.push({ label: 'When', value: `${shortDate(session.started_at)}, ${clockTime(session.started_at)}` });

  const length = duration(session.audio_duration_seconds);
  if (length) facts.push({ label: 'Length', value: length });

  facts.push({ label: 'Outcome', value: outcomeLabel(session.outcome) });

  const value = money(session.deal_value);
  if (value) facts.push({ label: 'Deal value', value });

  if (session.territory) facts.push({ label: 'Where', value: session.territory });
  if (session.approach) facts.push({ label: 'How', value: session.approach });
  if (session.offer) facts.push({ label: 'What', value: session.offer });

  return (
    <View className="mt-4 gap-2" accessible accessibilityLabel={
      facts.map((f) => `${f.label}: ${f.value}`).join('. ')
    }>
      {facts.map((f) => (
        <FactRow key={f.label} label={f.label} value={f.value} />
      ))}
    </View>
  );
}

/**
 * One fact, label and value.
 *
 * The label column was a fixed third of the width. At the default text size that
 * is right; at an accessibility text size "Deal value" needs the whole width on
 * its own, and a third of a phone screen turns both columns into a stack of
 * one-word fragments — a layout failure that only appears for the people who
 * most need the screen to be readable.
 *
 * So past that point it stacks: label above value, full width each. Nothing is
 * hidden or shortened; the same two pieces of text are arranged down instead of
 * across. The whole Meta block is one accessible element either way, so a screen
 * reader hears the same sentence regardless of which layout is on screen.
 */
function FactRow({ label, value }: { label: string; value: string }) {
  const stacked = useLargeText();
  if (stacked) {
    return (
      <View>
        <Text className="font-emphasis text-sm text-muted-foreground">{label}</Text>
        <Text className="font-body text-base text-foreground">{value}</Text>
      </View>
    );
  }
  return (
    <View className="flex-row items-baseline gap-3">
      <Text className="w-1/3 font-emphasis text-sm text-muted-foreground">{label}</Text>
      <Text className="flex-1 font-body text-base text-foreground">{value}</Text>
    </View>
  );
}

/**
 * The session as plain text a rep can send to themselves, a manager, or a CRM.
 *
 * 07-HANDOVER-GATE section E requires that a user can get their own data out.
 * Plain text rather than CSV on purpose: this is a conversation, not a table, and
 * a CSV of speech would need formula-injection neutralising for no gain — nobody
 * opens a pitch transcript in a spreadsheet.
 *
 * Cues are included because they are half the record: what was said, and what the
 * coach offered while it was being said.
 */
function buildExport({
  session,
  segments,
  cues,
}: {
  session: CoachingSession;
  segments: TranscriptSegment[];
  cues: CoachingCue[];
}): string {
  const L: string[] = [];
  const title = session.client_label?.trim() || 'Session';

  L.push(title);
  L.push(`${shortDate(session.started_at)} at ${clockTime(session.started_at)}`);

  const length = duration(session.audio_duration_seconds);
  if (length) L.push(`Length: ${length}`);
  L.push(`Outcome: ${outcomeLabel(session.outcome)}`);

  const value = money(session.deal_value);
  if (value) L.push(`Deal value: ${value}`);
  if (session.territory) L.push(`Where: ${session.territory}`);
  if (session.approach) L.push(`How: ${session.approach}`);
  if (session.offer) L.push(`What: ${session.offer}`);

  const { entries, unplacedCues } = buildTimeline(segments, cues);

  L.push('');
  L.push('CONVERSATION');
  if (segments.length === 0) {
    L.push('(none — the recording was not transcribed)');
  } else {
    // The same thing the screen and the coach are told. An export is read away
    // from the app — forwarded to a manager, pasted into a CRM — so a reader
    // has no other way to learn that "Unclear" means nobody has said which voice
    // is the rep, rather than the recording being poor.
    if (!segments.some((seg) => seg.speaker === 'agent' || seg.speaker === 'customer')) {
      L.push('(Nobody has said which voice is the salesperson, so the lines below are not');
      L.push(' attributed. "Unclear" does not mean the audio was bad.)');
      L.push('');
    }
    for (const entry of entries) {
      if (entry.kind === 'segment') {
        const seg = entry.segment;
        const who =
          seg.speaker === 'agent' ? 'Me' : seg.speaker === 'customer' ? 'Customer' : 'Unclear';
        L.push(`${who}: ${seg.text}`);
      } else {
        const kind = entry.cue.mode === 'guide_response' ? 'Guided response' : 'Suggestion';
        L.push(`    [Coach · ${kind}] ${entry.cue.text}`);
      }
    }
  }

  // With no transcript there is nothing to interleave against, so the cues are
  // listed on their own rather than silently vanishing from the export.
  const listedApart = segments.length === 0 ? cues : unplacedCues;
  if (segments.length === 0 || unplacedCues.length > 0) {
    L.push('');
    L.push(segments.length === 0 ? 'COACH CUES' : 'CUES WITHOUT A TIME');
    if (listedApart.length === 0) {
      L.push('(none delivered)');
    } else {
      for (const cue of listedApart) {
        const kind = cue.mode === 'guide_response' ? 'Guided response' : 'Suggestion';
        L.push(`[${kind}] ${cue.text}`);
      }
    }
  }

  return L.join('\n');
}
