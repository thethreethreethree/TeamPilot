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
import { emptyReadReason } from '@/lib/after-pitch-empty';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import {
  generateAfterPitch,

  readAfterPitch,
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
  debriefAvailability,
  unavailableBody,
  unavailableTitle,
} from '@/lib/debrief-availability';

type Phase = 'idle' | 'loading' | 'working' | 'ready' | 'blocked' | 'error';

export function AfterPitchCard({
  sessionId,
  hasAudio,
  segmentCount,
  unattributedCount = 0,
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
}) {
  // Read so the failure line names a cause it has checked, rather than blaming
  // the signal for every failure including a server fault.
  const online = useOnline();
  const [summary, setSummary] = useState<AfterPitch | null>(null);
  const [isOwner, setIsOwner] = useState(true);
  const [phase, setPhase] = useState<Phase>('idle');
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
   * ASKED BEFORE ANYTHING IS REQUESTED, and that ordering is the fix. The card
   * used to offer the debrief on every session, send the request, and translate
   * whatever came back into a failure — so "this call has no recording" arrived
   * as "the server does not accept the app's sign-in". Nothing is asked of the
   * server for a call that cannot have a debrief.
   */
  const availability = debriefAvailability(hasAudio, segmentCount, unattributedCount);
  if (availability !== 'ready') {
    return (
      <View className="mt-4 rounded-md border border-border-control px-4 py-3">
        <Text className="font-emphasis text-base text-foreground">
          {unavailableTitle(availability)}
        </Text>
        <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
          {unavailableBody(availability)}
        </Text>
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

  const reason = emptyReadReason(summary);
  if (reason) {
    return (
      <View className="mt-4 rounded-md border border-border-control px-4 py-3">
        <Text className="font-strong text-base text-foreground">
          {reason === 'none'
            ? 'No debrief yet'
            : reason === 'engine-blank'
              ? // NOT "not enough in this call". This call WAS scored, so there was plenty
                // to say — the write-up is what failed, and rebuilding usually fixes it.
                'Your read did not come through'
              : 'Not enough in this call to debrief'}
        </Text>
        <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
          {reason === 'none'
            ? 'Nothing has been written for this call yet. Making one reads the whole conversation, so it takes a moment.'
            : reason === 'engine-blank'
              ? 'The call was captured and scored, but the coaching write-up came back empty. That is the write-up failing, not the call — try building it again.'
              : 'There was not enough of a conversation here for the coach to say anything useful. That is a fact about the call, not about you.'}
        </Text>
        {reason === 'none' || reason === 'engine-blank' ? (
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
