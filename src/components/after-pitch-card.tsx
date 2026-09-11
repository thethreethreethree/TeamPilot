/**
 * The After Pitch debrief, on the session it belongs to.
 *
 * WHY IT LIVES ON THE SESSION SCREEN rather than getting its own route: a
 * debrief is about one call, and a rep reading a transcript and wanting to know
 * how it went should not have to navigate anywhere. The web gives it a page
 * because a browser has room; a phone does not.
 *
 * IT IS NEVER GENERATED AUTOMATICALLY. POST runs the coaching engines over a
 * whole call, which costs real money per press. A card that fired that on open
 * would bill the company every time a rep glanced at a session.
 *
 * ABSENT SCORES ARE NOT SHOWN AS ZERO. The route strips the private scores for
 * anyone who is not the call's owner — they are "a mirror for the rep, not a
 * manager scorecard" — so a manager sees the coaching substance and no numbers,
 * and this says so rather than rendering blanks that look like a bad result.
 */
import {
  canRebuild,
  canReRead,
  emptyReadReason,
  emptyReadWording,
  hasContent,
} from '@/lib/after-pitch-empty';
import {
  RECOVERY_COST_NOTE,
  TIMING_LOST_NOTE,
  type RecoveryStatus,
  canAskAgain,
  recoveryRecoveredWords,
  recoveryWording,
} from '@/lib/transcript-recovery';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import {
  generateAfterPitch,
  readAfterPitch,
  reReadRecording,
  type AfterPitch,
} from '@/lib/after-pitch';
import { blockedState } from '@/lib/blocked-state';
import { type AuthFailure } from '@/lib/auth-failure';
import { C } from '@/lib/theme';
import { barWidth, hasScores, readableScores } from '@/lib/after-pitch-scores';
import { bandLabel } from '@/lib/gamification/points';
import { fetchSessionPoints } from '@/lib/gamification/points-api';
import { useOnline } from '@/lib/use-online';
import { failureCause, reachFallback } from '@/lib/reach-failure';
import {
  canReReadFrom,
  debriefAvailability,
  unavailableBody,
  unavailableTitle,
} from '@/lib/debrief-availability';
import { transcriptOverdue } from '@/lib/transcript-wait';

type Phase = 'idle' | 'loading' | 'working' | 'ready' | 'blocked' | 'error';

/**
 * What a recovery cost, when it cost something.
 *
 * ONE COMPONENT, USED IN THREE BRANCHES, because the alternative was the same six lines written
 * three times and then drifting - and the one that drifted would be the one nobody read. It is
 * quiet on purpose: a left rule and muted text, not an alert. Nothing is wrong with the rep's call
 * and nothing is theirs to fix; they are simply being told what is missing before they notice it
 * themselves and wonder.
 */
function TimingLostNote() {
  return (
    <View accessibilityLiveRegion="polite" className="mt-3 border-l-2 border-border-control pl-3">
      <Text className="font-body text-sm leading-relaxed text-muted-foreground">
        {TIMING_LOST_NOTE}
      </Text>
    </View>
  );
}

export function AfterPitchCard({
  sessionId,
  hasAudio,
  segmentCount,
  unattributedCount = 0,
  endedAt,
  startedAt,
  agentTurnCount,
}: {
  sessionId: string;
  /** Whether the server holds audio for this call. */
  hasAudio: boolean;
  /** How many transcript segments exist. */
  segmentCount: number;
  /**
   * Segments nobody has attributed. Defaulted, so a caller that does not know stays
   * exactly as it was rather than withholding a debrief that may be ready.
   */
  unattributedCount?: number;
  /**
   * When the call finished, and when it began.
   *
   * Only ever used to tell "the transcript has not arrived yet" from "the transcript is never
   * arriving". Both optional: a caller that does not know says nothing, and the card keeps the
   * softer sentence rather than accusing a call of failing on no evidence.
   */
  endedAt?: string | null;
  startedAt?: string | null;
  /**
   * How many segments are the rep's own.
   *
   * Left undefined by a caller that has not counted, which reads as "not asked" rather than as
   * "none" - see the default in `debriefAvailability`. Getting that backwards would declare every
   * call agent-missing.
   */
  agentTurnCount?: number;
}) {
  // Read so the failure line names a cause it has checked, rather than blaming
  // the signal for every failure including a server fault.
  const online = useOnline();
  const [summary, setSummary] = useState<AfterPitch | null>(null);
  const [isOwner, setIsOwner] = useState(true);
  const [phase, setPhase] = useState<Phase>('idle');
  /** The rep rebuilt it in this sitting and it still came back empty - a different sentence. */
  const [justTried, setJustTried] = useState(false);
  /**
   * What the last re-read of the recording answered, if the rep asked in this sitting.
   *
   * Null means they have not asked. It is NOT folded into `justTried`: that one is about the
   * write-up being rebuilt, this one is about the words themselves being recovered, and they have
   * different causes, different sentences and different right next steps.
   */
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus | null>(null);
  /** The words came back and this call's pacing did not. Shown ALONGSIDE the outcome, not instead. */
  const [timingLost, setTimingLost] = useState(false);
  const [rereading, setRereading] = useState(false);
  /** Why it is blocked — a session that ended, or a route that refused. */
  const [why, setWhy] = useState<AuthFailure | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /**
   * The points this call banked, if any.
   *
   * SHOWN ONLY TO THE OWNER. The ledger's policy already scopes the read, and
   * this asks with the caller's own id — a manager opening a rep's call sees the
   * debrief, not the rep's banked score, which is the boundary spec 6 draws.
   * Absent is silent: a call from before gamification, or one never scored, has
   * no points and says nothing rather than showing a zero.
   */
  const [banked, setBanked] = useState<{ points: number; band: string | null } | null>(null);

  const open = useCallback(async () => {
    setPhase('loading');
    const result = await readAfterPitch(sessionId);
    if (result.ok) {
      setSummary(result.summary);
      setIsOwner(result.isOwner);
      setPhase('ready');
      // Not gated on isOwner: a manager is entitled to their team's per-session
      // detail (spec 6), their alert has often already quoted the score, and the
      // ledger's own policy is what decides. A peer gets nothing back.
      setBanked(await fetchSessionPoints(sessionId));
      return;
    }
    if (result.reason === 'needs-shim') {
      // KEEP THE REASON. `readAfterPitch` already worked out whether this was a
      // session that has ended or a route that refused a live token, and this
      // card used to throw that away and print one sentence for both.
      setWhy(result.why);
      setPhase('blocked');
      return;
    }
    setMessage(result.message ?? null);
    setPhase('error');
  }, [sessionId]);

  const make = useCallback(async () => {
    setPhase('working');
    const result = await generateAfterPitch(sessionId);
    if (result.ok) {
      setSummary(result.summary);
      setIsOwner(result.isOwner);
      // Remembered ONLY when the rebuild produced nothing. On success the card shows the debrief and
      // this never matters; on failure it is the difference between "try again" and "that did not work".
      setJustTried(!hasContent(result.summary));
      setPhase('ready');
      return;
    }
    if (result.reason === 'needs-shim') {
      setWhy(result.why);
      setPhase('blocked');
      return;
    }
    setMessage(result.message ?? null);
    setPhase('error');
  }, [sessionId]);

  /**
   * Read the saved recording a second time, to recover the side that was never transcribed.
   *
   * ONLY EVER STARTED BY A TAP. The website fires the same route automatically when a rep opens such
   * a call; this does not, and the difference is deliberate. Each attempt is a speech-to-text charge
   * on a multi-minute recording, an hourly sweep already reaches these calls unattended, and a rep at
   * a door on a metered connection should be the one who decides to spend it. What the app owes them
   * is to say plainly that it can be done and what it will do - which the card now does.
   *
   * ON SUCCESS THE READ IS REBUILT, because recovering the words is only half of it: the debrief
   * stored against this call is still the blank one written from the one-sided transcript, and
   * without this the rep would be told it worked while still looking at nothing.
   */
  const reRead = useCallback(async () => {
    setRereading(true);
    const { status, timingLost: lost } = await reReadRecording(sessionId);
    setRecoveryStatus(status);
    setTimingLost(lost);
    setRereading(false);
    if (recoveryRecoveredWords(status)) {
      // `make` sets its own phase and handles its own failures, including the case where the rebuilt
      // read is STILL empty - which then reads as "that did not work either" rather than silence.
      await make();
    }
  }, [sessionId, make]);

  /**
   * ASKED BEFORE ANYTHING IS REQUESTED, and that ordering is the fix. The card
   * used to offer the debrief on every session, send the request, and translate
   * whatever came back into a failure — so "this call has no recording" arrived
   * as "the server does not accept the app's sign-in". Nothing is asked of the
   * server for a call that cannot have a debrief.
   */
  const availability = debriefAvailability(
    hasAudio,
    segmentCount,
    unattributedCount,
    /*
      READ AT RENDER, deliberately, rather than held in state.

      There is no timer here and there does not need to be one. The boundary is fifteen minutes;
      a rep who has a call open across it has already scrolled, pulled to refresh or left and come
      back, and every one of those re-renders. A ticking clock would buy a sentence changing under
      somebody's eyes, which nobody asked for, at the price of a timer per mounted card.
    */
    { overdue: transcriptOverdue(endedAt, startedAt, new Date()), agentTurnCount },
  );
  /*
    THE PROPS ARE STALE THE MOMENT A RE-READ SUCCEEDS, and this is the bug that fixing them
    prevents rather than a precaution.

    `segmentCount`, `agentTurnCount` and the timestamps are counted by the SCREEN, from the
    segments it loaded when it opened. A successful re-read writes a new transcript on the server;
    the screen does not know that until it reloads. So the availability computed above still says
    the words never arrived - and the card would go on saying so, immediately after telling the rep
    they had come back, with the read sitting ready underneath.
  */
  const recoveredNow = recoveryStatus !== null && recoveryRecoveredWords(recoveryStatus);
  if (availability !== 'ready' && !recoveredNow) {
    const recovery = recoveryStatus ? recoveryWording(recoveryStatus) : null;
    return (
      <View className="mt-4 rounded-md border border-border-control px-4 py-3">
        <Text className="font-emphasis text-base text-foreground">
          {unavailableTitle(availability)}
        </Text>
        <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
          {unavailableBody(availability)}
        </Text>

        {recovery ? (
          <View
            accessibilityLiveRegion="polite"
            className="mt-3 border-l-2 border-border-control pl-3"
          >
            <Text className="font-strong text-sm text-foreground">{recovery.title}</Text>
            <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
              {recovery.body}
            </Text>
          </View>
        ) : null}
        {timingLost ? <TimingLostNote /> : null}

        {/*
          The same button, from the other direction. Above, the transcript exists and holds one
          voice; here it does not exist at all. The route treats them as one problem - its rewrite
          "covers blank, unknown-only, customer-only and the original customer-missing gap alike" -
          and a rep should not have to know which of the two happened to them.

          Not offered while the wait is still honest, and not offered after a settled answer: the
          first would spend a charge on work already in flight, the second on work that has already
          reached its conclusion.
        */}
        {canReReadFrom(availability) && (!recoveryStatus || canAskAgain(recoveryStatus)) ? (
          <>
            {/* The price, before it is spent rather than after. See RECOVERY_COST_NOTE. */}
            <Text className="mt-3 font-body text-sm leading-relaxed text-muted-foreground">
              {RECOVERY_COST_NOTE}
            </Text>
            <Pressable
            onPress={reRead}
            disabled={rereading}
            accessibilityRole="button"
            accessibilityState={{ disabled: rereading, busy: rereading }}
            accessibilityLabel="Read the recording again to recover this call's words"
            className={`mt-3 min-h-7 flex-row items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 active:bg-primary-pressed ${
              rereading ? 'opacity-60' : ''
            }`}
          >
            {rereading ? <ActivityIndicator size="small" color={C['primary-foreground']} /> : null}
            <Text className="font-strong text-base text-primary-foreground">
              {rereading ? 'Reading the recording…' : 'Read the recording again'}
            </Text>
            </Pressable>
          </>
        ) : null}
      </View>
    );
  }

  if (phase === 'idle') {
    return (
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel="See how this call went"
        className="mt-4 min-h-7 justify-center rounded-md border border-border-control px-4 py-3 active:bg-surface"
      >
        <Text className="font-emphasis text-base text-foreground">How this call went</Text>
        <Text className="mt-1 font-body text-sm text-muted-foreground">
          The between-doors debrief: what worked, what to try, one thing for the next door.
        </Text>
      </Pressable>
    );
  }

  if (phase === 'loading' || phase === 'working') {
    return (
      <View className="mt-4 flex-row items-center gap-2">
        <ActivityIndicator color={C.primary} />
        <Text accessibilityLiveRegion="polite" className="font-body text-sm text-muted-foreground">
          {phase === 'working' ? 'Reading the whole call…' : 'Loading…'}
        </Text>
      </View>
    );
  }

  if (phase === 'blocked') {
    /**
     * SAYS WHICH IT IS, rather than one sentence for three different problems.
     *
     * This used to read "the server ... does not accept the app's sign-in yet",
     * which was wrong in two ways at once. It was wrong ABOUT THE SERVER — the
     * after-pitch route takes a Bearer token like every other coach route
     * (`callerScopedDb(req) ?? createClient()`), checked against that repository
     * on 4 September. And it was wrong TO THE REP, because `readAfterPitch`
     * already distinguishes a session that has expired from a route that turned
     * a live token down, and this card discarded that and told everyone the
     * same untrue thing.
     *
     * The difference is the whole point: one is fixed by signing in again, and
     * the other cannot be fixed by the rep at all. Telling somebody to wait for
     * a deploy when they simply need to sign in is the most expensive sentence
     * this app can print.
     */
    const blocked = blockedState(why, 'this debrief');
    return (
      <View className="mt-4 rounded-md border border-border-control px-4 py-3">
        <Text className="font-strong text-base text-foreground">{blocked.title}</Text>
        <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
          {blocked.body}
        </Text>
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        className="mt-4 rounded-md border border-destructive px-4 py-3"
      >
        <Text className="font-body text-sm leading-relaxed text-destructive">
          {message ?? reachFallback('the debrief', failureCause(null, online))}
        </Text>
      </View>
    );
  }

  const reason = emptyReadReason(summary, justTried);
  if (reason) {
    /*
      THE SENTENCES LIVE IN `after-pitch-empty.ts`, not here.

      They were four nested ternaries in this file, and a fifth branch is exactly where a wrong
      sentence hides. Every one of them exists because an earlier sentence was wrong about a real
      rep's real call, so they are worth being able to read side by side - and to test, which they
      now are.
    */
    const words = emptyReadWording(reason);
    // What the LAST re-read answered, when the rep has asked in this sitting. Its own sentence, kept
    // apart from the diagnosis above: one says what is wrong with the call, the other says what
    // happened when we tried to fix it, and collapsing them loses whichever is not mentioned.
    const recovery = recoveryStatus ? recoveryWording(recoveryStatus) : null;
    return (
      <View className="mt-4 rounded-md border border-border-control px-4 py-3">
        <Text className="font-strong text-base text-foreground">{words.title}</Text>
        <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
          {words.body}
        </Text>

        {recovery ? (
          <View
            accessibilityLiveRegion="polite"
            className="mt-3 border-l-2 border-border-control pl-3"
          >
            <Text className="font-strong text-sm text-foreground">{recovery.title}</Text>
            <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
              {recovery.body}
            </Text>
          </View>
        ) : null}
        {timingLost ? <TimingLostNote /> : null}

        {canRebuild(reason) ? (
          <Pressable
            onPress={make}
            accessibilityRole="button"
            accessibilityLabel={
              reason === 'none'
                ? 'Write the debrief for this call'
                : 'Build the debrief for this call again'
            }
            className="mt-3 min-h-7 items-center justify-center rounded-md bg-primary px-5 py-3 active:bg-primary-pressed"
          >
            <Text className="font-strong text-base text-primary-foreground">
              {reason === 'none' ? 'Write it' : 'Build it again'}
            </Text>
          </Pressable>
        ) : null}

        {/*
          THE ACTION THAT CAN ACTUALLY WORK on a call whose customer side was never captured.

          OWNER ONLY, STATED RATHER THAN INHERITED. The route refuses anybody but the session's
          rep - it writes the canonical transcript, so a colleague must not trigger it on someone
          else's record. A manager would not see this button anyway, because their payload has the
          scores stripped and the diagnosis keys on one of them - but that is an accident of a
          privacy rule, not a permission check, and the day scores reach a manager it becomes a
          button that 403s. Two independent reasons for the same correct behaviour is the cheapest
          insurance there is.

          It is offered instead of "Build it again", never beside it - a rebuild here re-runs the
          write-up over the same one-voice transcript and returns the same blank, at a real cost per
          tap. Once a re-read has answered, it is offered again ONLY for a genuine outage: every
          other outcome is settled, and a second identical button after a settled answer is an
          invitation to keep paying for the same nothing. This app has already learned that twice.
        */}
        {isOwner && canReRead(reason) && (!recoveryStatus || canAskAgain(recoveryStatus)) ? (
          <>
            {/* The price, before it is spent rather than after. See RECOVERY_COST_NOTE. */}
            <Text className="mt-3 font-body text-sm leading-relaxed text-muted-foreground">
              {RECOVERY_COST_NOTE}
            </Text>
            <Pressable
            onPress={reRead}
            disabled={rereading}
            accessibilityRole="button"
            accessibilityState={{ disabled: rereading, busy: rereading }}
            accessibilityLabel="Read the recording again to recover the missing side"
            className={`mt-3 min-h-7 flex-row items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 active:bg-primary-pressed ${
              rereading ? 'opacity-60' : ''
            }`}
          >
            {rereading ? <ActivityIndicator size="small" color={C['primary-foreground']} /> : null}
            <Text className="font-strong text-base text-primary-foreground">
              {rereading ? 'Reading the recording…' : 'Read the recording again'}
            </Text>
            </Pressable>
          </>
        ) : null}
      </View>
    );
  }

  const s = summary as AfterPitch;
  return (
    <View className="mt-5 border-t border-border pt-5">
      <Text
        accessibilityRole="header"
        className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground"
      >
        How this call went
      </Text>

      {/*
        THE PLACE THIS MATTERS MOST. A recovery that worked shows the read and says nothing about
        mechanics - deliberately, because a wall of process over a rep's coaching would be noise.
        But "it worked" is not the whole truth when the call's pacing was lost getting here, and
        this is the only screen that will ever mention it.
      */}
      {timingLost ? <TimingLostNote /> : null}

      {/* What this call banked. Closes the loop from Your points, where a rep
          taps "84 points" and would otherwise land on a screen that never
          mentions them. Silent when there are none: a call from before scoring
          existed has no points, and a zero would read as a judgement. */}
      {banked ? (
        <View
          accessible
          accessibilityLabel={`This call banked ${banked.points} points${
            banked.band ? `, ${bandLabel(banked.band)}` : ''
          }`}
          className="mt-3 flex-row items-baseline gap-2"
        >
          <Text className="font-heading text-xl tabular-nums text-primary">{banked.points}</Text>
          <Text className="font-body text-sm text-muted-foreground">
            points{banked.band ? ` · ${bandLabel(banked.band)}` : ''}
          </Text>
        </View>
      ) : null}

      {s.narrative.strengths.length > 0 ? (
        <>
          <Text className="mt-3 font-strong text-base text-foreground">What worked</Text>
          <View className="mt-1 gap-3">
            {s.narrative.strengths.map((x) => (
              <View key={x.point}>
                <Text className="font-body text-base leading-relaxed text-foreground">
                  {x.point}
                </Text>
                {x.example ? (
                  // The rep's own words, quoted back. Evidence rather than
                  // advice — the reason to believe the point above it.
                  <Text className="mt-1 border-l-2 border-border-control pl-3 font-body text-sm leading-relaxed text-muted-foreground">
                    {x.example}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </>
      ) : null}

      {s.narrative.growthAreas.length > 0 ? (
        <>
          <Text className="mt-5 font-strong text-base text-foreground">Worth trying next</Text>
          <View className="mt-1 gap-3">
            {s.narrative.growthAreas.map((x) => (
              <View key={x.opportunity}>
                <Text className="font-body text-base leading-relaxed text-foreground">
                  {x.opportunity}
                </Text>
                {x.nextStep ? (
                  <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
                    {x.nextStep}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </>
      ) : null}

      {s.focus ? (
        <View className="mt-5 rounded-md border border-primary px-3 py-3">
          <Text className="font-emphasis text-xs uppercase tracking-widest text-primary">
            For the next door
          </Text>
          <Text className="mt-2 font-body text-base leading-relaxed text-foreground">
            {s.focus.focus}
          </Text>
          {s.focus.why ? (
            <Text className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
              {s.focus.why}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* The rep's OWN scores. Stripped server-side for anyone else, so reaching
          this branch already means the viewer owns the call — there is no
          second privacy check here to drift from the one that matters. */}
      {isOwner && hasScores(s.scores) ? (
        <View className="mt-5 gap-3">
          <Text
            accessibilityRole="header"
            className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground"
          >
            How this one scored
          </Text>
          {readableScores(s.scores).map((row) => (
            <View
              key={row.label}
              accessible
              accessibilityLabel={`${row.label}, ${row.score} out of 100`}
            >
              <View className="flex-row justify-between gap-3">
                <Text className="flex-1 font-body text-sm text-muted-foreground">
                  {row.label}
                </Text>
                <Text className="font-body text-sm tabular-nums text-foreground">
                  {row.score}
                </Text>
              </View>
              <View className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
                <View
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${barWidth(row.score)}%` }}
                />
              </View>
            </View>
          ))}
          <Text className="font-body text-xs leading-relaxed text-muted-foreground">
            These are yours. Nobody else on your team can see them, including your manager.
          </Text>
        </View>
      ) : null}

      {!isOwner ? (
        // Said out loud rather than left as an absence. A manager seeing no
        // scores should know they were withheld on purpose, not assume the rep
        // scored nothing.
        <Text className="mt-4 font-body text-sm leading-relaxed text-muted-foreground">
          The rep&apos;s own scores are not shown here. They are a mirror for them, not a
          scorecard for anyone else.
        </Text>
      ) : null}
    </View>
  );
}
