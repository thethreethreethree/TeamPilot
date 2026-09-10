/**
 * Team coaching — the manager's read-out, on the phone for the first time.
 *
 * Per rep: what they are doing well and where they can grow, in the real words of their own dissects and
 * door pitches. This is the one web page that had no counterpart in this app, and it could not have had
 * one: the route was browser-only until 2026-09-11, so a manager holding a phone could not read their own
 * team's coaching at all.
 *
 * A18 / A10 GOVERN THIS SCREEN, and the rules live in `@/lib/coach-assessment` under test rather than
 * here, because a comment does not fail when somebody adds a sort:
 *
 *   - NOT A SCOREBOARD. No ranking, no cross-rep comparison, no total that invites one.
 *   - THE SERVER'S ORDER IS AN ORG-CHART ORDER, not a grade, and is rendered exactly as given.
 *   - A rep with nothing yet is LISTED, with the reason. Dropping them would answer "how is my team
 *     doing" with a smaller team.
 *
 * The route 403s a non-manager and IS the gate — this screen does not re-implement it, it reports it.
 */
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { coachGet } from '@/lib/coach-api';
import { authFailureMessage } from '@/lib/auth-failure';
import { reachError } from '@/lib/reach-failure';
import { useOnline } from '@/lib/use-online';
import { shortDate } from '@/lib/format';
import {
  emptyNote,
  hasCoachingContent,
  inServerOrder,
  materialLine,
  type Assessment,
  type TeamMember,
} from '@/lib/coach-assessment';

type Phase = 'loading' | 'ready' | 'denied' | 'error';

export default function CoachAssessmentScreen() {
  const online = useOnline();
  const [phase, setPhase] = useState<Phase>('loading');
  const [data, setData] = useState<Assessment | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await coachGet<Assessment>('/api/coach/sales-session/coach-assessment');
      setData(res ?? { team: [] });
      setPhase('ready');
    } catch (e) {
      const status = (e as { status?: number })?.status;
      const why = (e as { authFailure?: 'signed-out' | 'route' })?.authFailure;
      if (why === 'signed-out') {
        setMessage(authFailureMessage('signed-out'));
        setPhase('error');
        return;
      }
      // 403 is the route's manager gate answering, not a fault. It gets its own screen so a rep who
      // reaches this by a stale link is told plainly rather than shown a red error about a server.
      if (status === 403) {
        setPhase('denied');
        return;
      }
      setMessage(`${reachError(e, online, 'your team coaching')} Nothing has changed.`);
      setPhase('error');
    }
  }, [online]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView
        contentContainerClassName="px-5 pb-10"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      >
        <Text accessibilityRole="header" className="mt-4 font-heading text-2xl text-foreground">
          Team coaching
        </Text>
        <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
          What each of your reps is doing well, and where they can grow — in the words of their own calls
          and door pitches.
        </Text>
        {/* Said once, at the top, because the whole screen depends on it being understood. */}
        <Text className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
          This is not a ranking. Everyone is measured against their own conversations, and the order is
          your team&apos;s, not a table.
        </Text>

        {phase === 'loading' ? (
          <View className="mt-8 flex-row items-center gap-2">
            <ActivityIndicator accessibilityLabel="Loading your team coaching" />
            <Text className="font-body text-base text-muted-foreground">Loading…</Text>
          </View>
        ) : null}

        {phase === 'denied' ? (
          <View className="mt-6 rounded-md border border-border-control px-4 py-4">
            <Text accessibilityRole="header" className="font-strong text-base text-foreground">
              For managers
            </Text>
            <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
              This page shows a whole team&apos;s coaching, so it is only open to managers. Your own
              coaching is on each of your calls, and in Training.
            </Text>
          </View>
        ) : null}

        {phase === 'error' ? (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="mt-6 rounded-md border border-destructive px-4 py-3"
          >
            <Text className="font-body text-sm leading-relaxed text-destructive">{message}</Text>
          </View>
        ) : null}

        {phase === 'ready' && data?.degraded ? (
          // The server says it could not read every rep. Showing a partial team as if it were the whole
          // team is the failure this whole build has been about, so it says so instead.
          <View className="mt-6 rounded-md border border-border-control px-4 py-4">
            <Text accessibilityRole="header" className="font-strong text-base text-foreground">
              Not everyone came back
            </Text>
            <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
              Part of your team&apos;s coaching could not be read just now, so none of it is shown — a
              partial team would look like a complete one. Pull down to try again.
            </Text>
          </View>
        ) : null}

        {phase === 'ready' && !data?.degraded
          ? inServerOrder(data?.team ?? []).map((member) => <RepCard key={member.agentId} member={member} />)
          : null}

        {phase === 'ready' && !data?.degraded && (data?.team ?? []).length === 0 ? (
          <View className="mt-6 rounded-md border border-border-control px-4 py-4">
            <Text accessibilityRole="header" className="font-strong text-base text-foreground">
              No reps yet
            </Text>
            <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
              Nobody is on your team in the app yet. Once a rep records a call or a door pitch, their
              coaching appears here.
            </Text>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function RepCard({ member }: { member: TeamMember }) {
  const content = hasCoachingContent(member);
  return (
    <View className="mt-4 gap-3 rounded-lg border border-border-control px-4 py-4">
      <View className="gap-0.5">
        <Text accessibilityRole="header" className="font-strong text-lg text-foreground">
          {member.agentName}
        </Text>
        <Text className="font-body text-sm text-muted-foreground">
          {materialLine(member)}
          {member.lastAt ? ` · last on ${shortDate(member.lastAt)}` : ''}
        </Text>
      </View>

      {!content ? (
        <Text className="font-body text-sm leading-relaxed text-muted-foreground">{emptyNote(member)}</Text>
      ) : null}

      {member.strengths.length > 0 ? (
        <View className="gap-1">
          <Text accessibilityRole="header" className="font-emphasis text-xs uppercase tracking-wide text-muted-foreground">
            Doing well
          </Text>
          {member.strengths.map((s, i) => (
            <Text key={`s-${i}`} className="font-body text-base leading-relaxed text-foreground">
              {s}
            </Text>
          ))}
        </View>
      ) : null}

      {member.growthAreas.length > 0 ? (
        <View className="gap-1">
          <Text accessibilityRole="header" className="font-emphasis text-xs uppercase tracking-wide text-muted-foreground">
            To coach on
          </Text>
          {member.growthAreas.map((g, i) => (
            <Text key={`g-${i}`} className="font-body text-base leading-relaxed text-foreground">
              {g}
            </Text>
          ))}
        </View>
      ) : null}

      {member.strategies.length > 0 ? (
        <View className="gap-1">
          <Text accessibilityRole="header" className="font-emphasis text-xs uppercase tracking-wide text-muted-foreground">
            Plays they ran
          </Text>
          {member.strategies.map((t, i) => (
            <Text key={`t-${i}`} className="font-body text-base leading-relaxed text-foreground">
              {t}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
