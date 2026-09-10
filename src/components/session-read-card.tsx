/**
 * "Your read" on the session screen — the deep, whole-conversation evaluation of a recorded call.
 *
 * WHY IT LIVES ON THE SESSION SCREEN rather than getting its own route: it is about one call, and a rep
 * arrives here from the list already holding that call in their head. A separate screen would make them
 * carry it.
 *
 * The app has never shown this. The web has had it since the coach was built; the phone showed the
 * transcript, the debrief and the scores but never the artifact that reads the WHOLE conversation. And on
 * 2026-09-10 the sessions list started saying "Read didn't finish" on calls where the coach came back
 * blank — a chip naming a problem with nothing behind it. This is what it points at.
 *
 * Every decision about WHAT to say lives in `@/lib/session-read`, under test. This file lays it out.
 * NOT GENERATED ON OPEN, ever: a read costs a real LLM call on a whole conversation, so it is offered and
 * never spent on a rep who only wanted to check the transcript.
 */
import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';

import { coachGet, coachPost } from '@/lib/coach-api';
import { readIssueForSession } from '@/lib/sync/sessions';
import { authFailureMessage } from '@/lib/auth-failure';
import { reachError } from '@/lib/reach-failure';
import { useOnline } from '@/lib/use-online';
import {
  canRetryRead,
  noReadReason,
  noReadWording,
  readSections,
  type ReadSegment,
  type SessionRead,
} from '@/lib/session-read';

type Phase = 'loading' | 'ready' | 'working' | 'error';

export function SessionReadCard({ sessionId, segments }: { sessionId: string; segments: ReadSegment[] }) {
  const online = useOnline();
  const [phase, setPhase] = useState<Phase>('loading');
  const [read, setRead] = useState<SessionRead | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  /*
    WHY THIS CARD ASKS THE SAME QUESTION THE LIST ALREADY ANSWERED.

    The sessions list shows "Read didn't finish" on a call where the coach ran and produced nothing. If
    tapping into that call then said "No read yet", the two screens would be describing the same call
    differently - and one of them would be wrong. Same helper, both surfaces.

    Best-effort by construction: a failed events read leaves this null, and the card falls back to
    "nobody has asked yet", which is the softer sentence and the right way to be wrong.
  */
  const [attemptFailed, setAttemptFailed] = useState(false);
  /** The rep asked in THIS sitting and it came back empty - a different sentence from 'nobody asked'. */
  const [justTried, setJustTried] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await coachGet<{ dissect: SessionRead | null }>(
        `/api/coach/sales-session/dissect?sessionId=${sessionId}`,
      );
      setRead(res?.dissect ?? null);
      setPhase('ready');
    } catch (e) {
      // A missing read is NOT an error state — the card has honest words for it. Only a failed
      // REQUEST lands here, and it says so rather than showing "no read yet" over a network fault.
      const why = (e as { authFailure?: 'signed-out' | 'route' })?.authFailure;
      setMessage(
        why === 'signed-out'
          ? authFailureMessage('signed-out')
          : `${reachError(e, online, 'your read')} Nothing about this call has changed.`,
      );
      setPhase('error');
    }
  }, [sessionId, online]);

  /*
    A FOCUS EFFECT RATHER THAN A PLAIN ONE, matching the eleven screens that already load this way.

    Two reasons, and the second is the one that matters. It reloads when the screen is returned to, so a
    rep who backs out, changes something and comes back is not reading a stale answer. And a plain effect
    calling a loader that sets state is what `react-hooks/set-state-in-effect` refuses - the rule is right
    that an effect should not drive a render cascade, and the fix is the codebase's own idiom rather than
    a suppression comment written over the top of it.
  */
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /*
    ONLY ASKED WHEN THERE IS NO READ, which is the only time the answer is used.

    This costs two more queries on a screen a rep opens constantly, and it exists solely to choose
    between two sentences on an EMPTY card - "nobody has asked yet" against "the coach tried and
    failed". When a read came back, `noReadReason` returns null and neither sentence is ever shown, so
    paying for the verdict would buy nothing at all.

    Most calls have a read. So most of the time this now costs nothing, and the cost falls exactly on
    the calls where the extra sentence is worth having.
  */
  useEffect(() => {
    if (phase !== 'ready' || read?.hasSignal) return;
    let live = true;
    void readIssueForSession(sessionId).then((issue) => {
      if (live) setAttemptFailed(issue === 'unfinished');
    });
    return () => {
      live = false;
    };
  }, [sessionId, phase, read]);

  const make = useCallback(async () => {
    setPhase('working');
    setMessage(null);
    try {
      const res = await coachPost<{ dissect: SessionRead | null }>('/api/coach/sales-session/dissect', {
        sessionId,
      });
      const got = res?.dissect ?? null;
      setRead(got);
      // Remembered ONLY when the attempt produced nothing. On success the card shows the read and this
      // never matters; on failure it is the difference between "ask again" and "asking again does this".
      setJustTried(!got?.hasSignal);
      setPhase('ready');
    } catch (e) {
      const why = (e as { authFailure?: 'signed-out' | 'route' })?.authFailure;
      setMessage(
        why === 'signed-out'
          ? authFailureMessage('signed-out')
          : `${reachError(e, online, 'your read')} Nothing about this call has changed.`,
      );
      setPhase('error');
    }
  }, [sessionId, online]);

  if (phase === 'loading') {
    return (
      <View className="mt-6 flex-row items-center gap-2">
        <ActivityIndicator accessibilityLabel="Loading your read" />
        <Text className="font-body text-base text-muted-foreground">Loading your read…</Text>
      </View>
    );
  }

  if (phase === 'error') {
    return (
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        className="mt-6 rounded-md border border-destructive px-4 py-3"
      >
        <Text className="font-body text-sm leading-relaxed text-destructive">{message}</Text>
      </View>
    );
  }

  const reason = noReadReason({ read, segments, attemptFailed, justTried });

  if (reason) {
    const w = noReadWording(reason);
    return (
      <View className="mt-6 rounded-md border border-border-control px-4 py-4">
        <Text accessibilityRole="header" className="font-strong text-base text-foreground">
          {w.title}
        </Text>
        <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">{w.body}</Text>
        {canRetryRead(reason) && w.action ? (
          <Pressable
            onPress={make}
            disabled={phase === 'working'}
            accessibilityRole="button"
            accessibilityLabel={
              reason === 'never-made'
                ? 'Read this call and write my coaching'
                : 'Try writing my coaching for this call again'
            }
            accessibilityState={{ disabled: phase === 'working', busy: phase === 'working' }}
            style={phase === 'working' ? { opacity: 0.5 } : undefined}
            className="mt-3 min-h-7 items-center justify-center rounded-md bg-primary px-5 py-3 active:bg-primary-pressed"
          >
            <Text className="font-strong text-base text-primary-foreground">
              {phase === 'working' ? 'Reading the call…' : w.action}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  }

  // From here `read` is non-null with signal — `noReadReason` returning null is exactly that.
  const r = read as SessionRead;
  const sections = readSections(r);

  return (
    <View className="mt-6 gap-4">
      <Text
        accessibilityRole="header"
        className="font-emphasis text-xs uppercase tracking-wide text-muted-foreground"
      >
        Your read
      </Text>

      {/*
        MEASURED AGAINST THE 121 READS ALREADY STORED, rather than designed against a guess. The real
        shape: up to 4 strengths and 4 growth areas per read; the "point" line that reads like a label
        runs to 248 characters; a quoted example to 357, with 55 of them over 200; `why` to 446; and
        `overall` to 778. Four of each at that length is roughly six thousand characters in one column.

        So every item gets its own bounded region. The design law says it plainly - common region
        overrides proximity as a grouping cue, which is why cards work - and it is what lets a rep scan
        the bold line of each item and stop at the one they care about, instead of reading a wall.
      */}
      {sections.hasOverall ? (
        <View className="rounded-md border border-border-control px-4 py-3">
          <Text className="font-body text-base leading-relaxed text-foreground">{r.overall}</Text>
        </View>
      ) : null}

      {sections.strengths > 0 ? (
        <View className="gap-3">
          <Text accessibilityRole="header" className="font-strong text-base text-foreground">
            What worked
          </Text>
          {r.strengths.map((s, i) => (
            <View key={`${s.point}-${i}`} className="gap-1 rounded-md border border-border px-4 py-3">
              <Text className="font-emphasis text-base leading-relaxed text-foreground">{s.point}</Text>
              {s.example.trim() ? (
                // The rep's own words back to them. Quoted, because a line you actually said lands
                // differently from a description of it.
                <Text className="font-body text-sm italic leading-relaxed text-muted-foreground">
                  “{s.example}”
                </Text>
              ) : null}
              {s.why.trim() ? (
                <Text className="font-body text-sm leading-relaxed text-muted-foreground">{s.why}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {sections.growth > 0 ? (
        <View className="gap-3">
          <Text accessibilityRole="header" className="font-strong text-base text-foreground">
            To work on
          </Text>
          {r.growthAreas.map((g, i) => (
            <View key={`${g.opportunity}-${i}`} className="gap-1 rounded-md border border-border px-4 py-3">
              <Text className="font-emphasis text-base leading-relaxed text-foreground">
                {g.opportunity}
              </Text>
              {g.nextStep.trim() ? (
                // The step, marked out. A growth note without one is a verdict, which the coach's own
                // tone law refuses to produce — so if it is here, it gets shown as the actionable half.
                <Text className="font-body text-sm leading-relaxed text-primary">{g.nextStep}</Text>
              ) : null}
              {g.why.trim() ? (
                <Text className="font-body text-sm leading-relaxed text-muted-foreground">{g.why}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {sections.hasStrategy && r.standoutStrategy ? (
        <View className="gap-1 rounded-md border border-primary px-4 py-3">
          <Text accessibilityRole="header" className="font-strong text-base text-foreground">
            The play you ran: {r.standoutStrategy.name}
          </Text>
          {r.standoutStrategy.example.trim() ? (
            <Text className="font-body text-sm italic leading-relaxed text-muted-foreground">
              “{r.standoutStrategy.example}”
            </Text>
          ) : null}
          {r.standoutStrategy.why.trim() ? (
            <Text className="font-body text-sm leading-relaxed text-muted-foreground">
              {r.standoutStrategy.why}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
