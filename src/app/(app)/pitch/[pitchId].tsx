/**
 * One pitch, in full — the drill-down from Pitch Performance.
 *
 * Mirrors `dashboard/sales-coach/doors/report-card/[pitchId]`: scores, summary,
 * strengths, growth opportunities, the offer to run the pitch back as a role
 * play, and the transcript. Read-only.
 *
 * Every decision about WHAT to say lives in `@/lib/pitch-detail`, under test.
 * This file only lays it out. The one that would bite hardest if it were done by
 * eye is a completed pitch whose analysis never saved: it must not read as
 * "still processing", because nothing is coming.
 *
 * A 404 HERE MEANS A MISSING PITCH, not a missing route — and the reasoning is
 * stronger than it was: getting to this screen required the list to load from
 * the same route, so that route is reachable by definition.
 *
 * (The aside that used to sit here said a 404 from a coach route "means the
 * bearer shim is not deployed". That stopped being true — every coach route this
 * app calls now resolves a mobile Bearer token, swept and confirmed against the
 * web repository on 4 September. Three separate screens were still telling reps
 * to wait for a deploy that had already happened, which is why this correction
 * is written down rather than quietly made.)
 */
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Feather } from '@expo/vector-icons';

import { coachGet } from '@/lib/coach-api';
import { authFailureMessage } from '@/lib/auth-failure';
import { useOnline } from '@/lib/use-online';
import { reachError } from '@/lib/reach-failure';
import { clockTime, shortDate } from '@/lib/format';
import { pitchOutcomeLabel } from '@/lib/doors/outcome-label';
import {
  analysisState,
  canRolePlay,
  dimensionLabel,
  orderedScores,
  scoreWidth,
  type PitchAnalysis,
  type PitchDetail,
} from '@/lib/pitch-detail';
import { C } from '@/lib/theme';
import { useLargeText } from '@/lib/use-large-text';


/** Missing and broken are different answers. Only one of them is retryable. */
type Phase = 'loading' | 'ready' | 'missing' | 'error';

export default function PitchDetailScreen() {
  // Read here so the failure notice can name a cause it has actually checked.
  // These screens all said "check your connection" for every failure, 5xx
  // included — reported 4 September from a phone with full bars.
  const online = useOnline();

  const { pitchId } = useLocalSearchParams<{ pitchId: string }>();
  const [detail, setDetail] = useState<PitchDetail | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!pitchId) {
      setPhase('missing');
      return;
    }
    setPhase('loading');
    try {
      const data = await coachGet<PitchDetail>(
        `/api/coach/sales-session/report-card/${encodeURIComponent(pitchId)}`,
      );
      setDetail(data);
      setPhase('ready');
    } catch (e) {
      if ((e as { status?: number })?.status === 404) {
        setPhase('missing');
        return;
      }
      // Consume coach-api's verdict rather than re-deriving it (2.2). Reaching
      // this screen required the list to load from the same shimmed route, so a
      // 401 here is a dead session, not an undeployed route — and telling that
      // rep to check their connection would send them nowhere useful.
      const why = (e as { authFailure?: 'signed-out' | 'route' })?.authFailure;
      setMessage(
        why === 'signed-out'
          ? authFailureMessage('signed-out')
          : reachError(e, online, 'this pitch'),
      );
      setPhase('error');
    }
  }, [pitchId, online]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <ScrollView contentContainerClassName="px-4 pb-10 pt-4" className="flex-1">
        {phase === 'loading' ? (
          <View className="items-start gap-3 py-6">
            <ActivityIndicator color={C['muted-foreground']} />
            <Text className="font-body text-base text-muted-foreground">Loading this pitch…</Text>
          </View>
        ) : phase === 'error' ? (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="gap-3 rounded-md border border-destructive px-3 py-3"
          >
            {/* Said explicitly, because "not available" would read as deleted. */}
            <Text className="font-body text-base leading-relaxed text-destructive">
              This pitch could not be loaded. That is an error, not a missing pitch — it is still
              there.
            </Text>
            <Text className="font-body text-sm leading-relaxed text-muted-foreground">
              {message}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Try loading this pitch again"
              onPress={() => void load()}
              className="min-h-7 justify-center self-start rounded-md border border-primary px-4 active:opacity-70"
            >
              <Text className="font-emphasis text-base text-primary">Try again</Text>
            </Pressable>
          </View>
        ) : phase === 'missing' || !detail ? (
          <Text className="font-body text-base leading-relaxed text-muted-foreground">
            This pitch is not available.
          </Text>
        ) : (
          <Body detail={detail} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Body({ detail }: { detail: PitchDetail }) {
  const state = analysisState(detail);
  const outcome = pitchOutcomeLabel(detail.outcome);

  return (
    <View className="gap-6">
      <View className="gap-1">
        <Text accessibilityRole="header" className="font-heading text-2xl text-foreground">
          {detail.name?.trim() || 'Unnamed pitch'}
        </Text>
        <Text className="font-body text-sm text-muted-foreground">
          {shortDate(detail.recordedAt)}, {clockTime(detail.recordedAt)} · {outcome}
        </Text>
      </View>

      {state.kind === 'failed' ? (
        <Note tone="bad" title="Processing failed" body={state.message} />
      ) : state.kind === 'lost' ? (
        <Note
          tone="warn"
          title="Analysis unavailable"
          // Never "still processing" — this pitch is finished and nothing more
          // is coming. A spinner here would never resolve.
          body="This pitch finished, but its analysis did not save. The transcript below is still here."
        />
      ) : state.kind === 'processing' ? (
        <Text className="font-body text-base leading-relaxed text-muted-foreground">
          Still being analysed. The scores and summary appear here when it is done.
        </Text>
      ) : (
        <Analysis analysis={state.analysis} />
      )}

      {canRolePlay(detail) ? (
        <View className="gap-2 rounded-lg border border-primary px-4 py-4">
          <Text accessibilityRole="header" className="font-strong text-base text-foreground">
            Practise this pitch
          </Text>
          <Text className="font-body text-sm leading-relaxed text-muted-foreground">
            Run it back as a role play. The coach plays this same customer and the objections they
            raised, so you can re-pitch it until it lands.
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Role play this pitch"
            onPress={() => router.push({ pathname: '/(app)/(tabs)/roleplay', params: { pitchId: detail.id } })}
            className="mt-1 min-h-7 flex-row items-center justify-center gap-2 rounded-md bg-primary px-4 active:opacity-80"
          >
            <Feather name="mic" size={16} color={C['primary-foreground']} />
            <Text className="font-emphasis text-base text-primary-foreground">Role play</Text>
          </Pressable>
        </View>
      ) : null}

      {detail.transcript?.trim() ? (
        <View className="gap-2">
          <Text
            accessibilityRole="header"
            className="font-emphasis text-xs uppercase tracking-wide text-muted-foreground"
          >
            Transcript
          </Text>
          <Text className="font-body text-base leading-relaxed text-foreground">
            {detail.transcript}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function Analysis({ analysis }: { analysis: PitchAnalysis }) {
  const stacked = useLargeText();
  const scores = orderedScores(analysis);

  return (
    <View className="gap-6">
      {scores.length > 0 ? (
        <View className="gap-3">
          <Text
            accessibilityRole="header"
            className="font-emphasis text-xs uppercase tracking-wide text-muted-foreground"
          >
            Scores
          </Text>
          {scores.map((s) => (
            <View
              key={s.dimension}
              accessible
              accessibilityLabel={`${dimensionLabel(s.dimension)}, ${s.value} out of 100`}
            >
              {/* Neither side carries flex-1: at an accessibility text size a
                  long dimension name pushes the score out of the row, and the
                  number a rep came here to read is simply gone. */}
              <View className={stacked ? 'gap-0.5' : 'flex-row justify-between'}>
                <Text className="font-body text-sm text-muted-foreground">
                  {dimensionLabel(s.dimension)}
                </Text>
                <Text className="font-body text-sm tabular-nums text-foreground">{s.value}</Text>
              </View>
              <View className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface">
                <View
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${scoreWidth(s.value)}%` }}
                />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {analysis.summary?.trim() ? (
        <View className="gap-2">
          <Text
            accessibilityRole="header"
            className="font-emphasis text-xs uppercase tracking-wide text-muted-foreground"
          >
            Summary
          </Text>
          <Text className="font-body text-base leading-relaxed text-foreground">
            {analysis.summary}
          </Text>
        </View>
      ) : null}

      <Bullets title="Strengths" items={analysis.strengths} icon="check-circle" />
      <Bullets title="Growth opportunities" items={analysis.improvements} icon="trending-up" />
    </View>
  );
}

function Bullets({
  title,
  items,
  icon,
}: {
  title: string;
  items: string[];
  icon: 'check-circle' | 'trending-up';
}) {
  if (!items?.length) return null;
  return (
    <View className="gap-2">
      <View className="flex-row items-center gap-1.5">
        <Feather name={icon} size={13} color={C['muted-foreground']} />
        <Text
          accessibilityRole="header"
          className="font-emphasis text-xs uppercase tracking-wide text-muted-foreground"
        >
          {title}
        </Text>
      </View>
      {items.map((item, i) => (
        <Text key={i} className="font-body text-base leading-relaxed text-foreground">
          {'•'} {item}
        </Text>
      ))}
    </View>
  );
}

function Note({ tone, title, body }: { tone: 'bad' | 'warn'; title: string; body: string }) {
  const border = tone === 'bad' ? 'border-destructive' : 'border-border-control';
  const colour = tone === 'bad' ? C.destructive : C.foreground;
  return (
    <View className={`gap-1 rounded-md border px-3 py-3 ${border}`}>
      <View className="flex-row items-center gap-1.5">
        <Feather name="alert-triangle" size={14} color={colour} />
        <Text className="font-strong text-base" style={{ color: colour }}>
          {title}
        </Text>
      </View>
      <Text className="font-body text-sm leading-relaxed text-muted-foreground">{body}</Text>
    </View>
  );
}
