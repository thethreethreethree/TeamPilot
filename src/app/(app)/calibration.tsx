/**
 * Score Calibration (spec 5.4) — checking whether the AI scorer can be trusted.
 *
 * A manager reads an ANONYMISED transcript, scores it blind on the five judged
 * dimensions, submits, and only then sees the model's scores beside their own.
 *
 * THE BLIND IS THE FEATURE. The model's answer is withheld by the server until
 * a submission lands, and this screen never asks for it early. Showing it first
 * would anchor the manager to the number being tested, and the agreement report
 * would then measure whether somebody can copy rather than whether the scorer is
 * right.
 *
 * IT MEASURES TRUST, IT DOES NOT ACT ON IT. Nothing here changes anybody's
 * points or rank. The spec is explicit that this validates the score before it
 * is allowed to drive ranks — so a poor agreement is information for a human,
 * not an automatic adjustment.
 *
 * THE TRANSCRIPT NEVER NAMES THE REP. It arrives as REP / PROSPECT and is
 * rendered as it arrives. A manager calibrates the scorer, not a person.
 */
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';

import {
  agreementLine,
  DIMENSION_LABEL,
  JUDGED_DIMENSIONS,
  missingDimensions,
  scoresComplete,
  type JudgedDimension,
  type Scores,
} from '@/lib/gamification/calibration';
import {
  fetchCalibration,
  submitCalibration,
  type CalibrationLoad,
  type CalibrationState,
} from '@/lib/gamification/calibration-api';
import { authFailureMessage } from '@/lib/auth-failure';
import { ENV } from '@/lib/env';
import { webCalibrationUrl } from '@/lib/web-links';
import { WebsiteLink } from '@/components/website-link';
import { C } from '@/lib/theme';
import { useLargeText } from '@/lib/use-large-text';

const SCALE = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function CalibrationScreen() {
  const [load, setLoad] = useState<CalibrationLoad | null>(null);
  const [scores, setScores] = useState<Scores>({});
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [reveal, setReveal] = useState<{
    model: Record<string, number>;
    human: Record<string, number>;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const read = useCallback(async () => {
    setLoad(await fetchCalibration());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void read();
    }, [read]),
  );

  const state = load?.kind === 'ready' ? load.state : null;
  const next = state?.next ?? null;
  const missing = missingDimensions(scores);

  const submit = useCallback(async () => {
    if (!next || busy || !scoresComplete(scores)) return;
    setBusy(true);
    setNotice(null);
    const result = await submitCalibration(next.sessionId, scores);
    setBusy(false);
    if (typeof result === 'string') {
      setNotice(result);
      return;
    }
    setReveal(result);
  }, [next, busy, scores]);

  const nextTranscript = useCallback(async () => {
    setReveal(null);
    setScores({});
    setNotice(null);
    await read();
  }, [read]);

  return (
    <SafeAreaView edges={['bottom']} className="flex-1 bg-background">
      <ScrollView
        contentContainerClassName="px-4 pb-10 pt-4"
        className="flex-1"
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await read();
              } finally {
                setRefreshing(false);
              }
            }}
            tintColor={C['muted-foreground']}
          />
        }
      >
        {load === null ? (
          <View className="items-start gap-3 py-6">
            <ActivityIndicator color={C['muted-foreground']} />
            <Text className="font-body text-base text-muted-foreground">Loading…</Text>
          </View>
        ) : load.kind === 'not-a-manager' ? (
          <View className="gap-3 py-6">
            <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
              For managers
            </Text>
            <Text className="font-body text-base leading-relaxed text-muted-foreground">
              Calibration is how a manager checks the coach&apos;s scoring against their own
              judgement. It is not part of a rep&apos;s day.
            </Text>
          </View>
        ) : load.kind === 'signed-out' ? (
          <View className="gap-3 py-6">
            <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
              You have been signed out
            </Text>
            <Text className="font-body text-base leading-relaxed text-muted-foreground">
              {/* The one case with a fix the manager can perform. This screen used to tell them the
                  opposite — that signing in again would not help — which was the single most
                  expensive thing it could have said. */}
              {authFailureMessage('signed-out')}
            </Text>
          </View>
        ) : load.kind === 'route-refused' ? (
          <View className="gap-3 py-6">
            <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
              Calibration could not be opened
            </Text>
            <Text className="font-body text-base leading-relaxed text-muted-foreground">
              {/* Not "try again": retrying cannot fix a route that refuses a live token. */}
              {authFailureMessage('route')} It works on the website now.
            </Text>
            {/* A manager blocked HERE is blocked from the one screen that tells
                them whether the coach scores like they do. Naming the website
                and not offering it is the dead end this closes. */}
            <WebsiteLink
              url={webCalibrationUrl(ENV.API_BASE)}
              label="Open Calibration on the website"
              spoken="Open Score Calibration on the Elostate website"
              whereInstead="Calibration is on elostate.com, under Sales Coach."
            />
          </View>
        ) : load.kind === 'error' ? (
          <View
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            className="gap-3 rounded-md border border-destructive px-3 py-3"
          >
            <Text className="font-body text-base leading-relaxed text-destructive">
              {load.message}
            </Text>
            <Pressable
              onPress={() => void read()}
              accessibilityRole="button"
              accessibilityLabel="Try loading calibration again"
              className="min-h-7 justify-center self-start rounded-md border border-primary px-4 active:opacity-70"
            >
              <Text className="font-emphasis text-base text-primary">Try again</Text>
            </Pressable>
          </View>
        ) : (
          <View className="gap-6">
            <Report state={state} />

            {reveal ? (
              <Reveal
                human={reveal.human}
                model={reveal.model}
                onNext={() => void nextTranscript()}
              />
            ) : next ? (
              <View className="gap-4">
                <View className="gap-2">
                  <Text
                    accessibilityRole="header"
                    className="font-emphasis text-xs uppercase tracking-wide text-muted-foreground"
                  >
                    Score this call
                  </Text>
                  <Text className="font-body text-sm leading-relaxed text-muted-foreground">
                    {/* Says the two things a manager needs before reading it. */}
                    The rep is not named, and the coach&apos;s own scores stay hidden until you
                    submit — so your read is your own.
                  </Text>
                </View>

                <View className="rounded-lg border border-border-control px-3 py-3">
                  <Text className="font-body text-base leading-relaxed text-foreground">
                    {next.transcript}
                  </Text>
                </View>

                {JUDGED_DIMENSIONS.map((d) => (
                  <Dimension
                    key={d}
                    dimension={d}
                    value={scores[d]}
                    onPick={(v) => setScores((s) => ({ ...s, [d]: v }))}
                  />
                ))}

                {notice ? (
                  <Text
                    accessibilityRole="alert"
                    accessibilityLiveRegion="polite"
                    className="font-body text-sm leading-relaxed text-destructive"
                  >
                    {notice}
                  </Text>
                ) : missing.length > 0 ? (
                  <Text className="font-body text-sm leading-relaxed text-muted-foreground">
                    {/* Names what is missing rather than only greying the button. */}
                    Still to score: {missing.map((m) => DIMENSION_LABEL[m] ?? m).join(', ')}.
                  </Text>
                ) : null}

                <Pressable
                  onPress={() => void submit()}
                  disabled={busy || missing.length > 0}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: busy || missing.length > 0, busy }}
                  accessibilityLabel="Submit your scores and see the coach's"
                  className={`min-h-7 items-center justify-center rounded-md px-4 py-3 ${
                    busy || missing.length > 0
                      ? 'bg-surface'
                      : 'bg-primary active:opacity-80'
                  }`}
                >
                  <Text
                    className={`font-emphasis text-base ${
                      busy || missing.length > 0 ? 'text-muted-foreground' : 'text-primary-foreground'
                    }`}
                  >
                    {busy ? 'Submitting…' : 'Submit and compare'}
                  </Text>
                </Pressable>
              </View>
            ) : (
              <View className="gap-3">
                <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
                  Nothing left to score
                </Text>
                <Text className="font-body text-base leading-relaxed text-muted-foreground">
                  Every call in the pool has been calibrated. More appear as your team records
                  them.
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** The running agreement report. */
function Report({ state }: { state: CalibrationState | null }) {
  const stacked = useLargeText();
  const report = state?.report ?? null;
  const scored = state?.scored ?? 0;
  const pool = state?.pool ?? 0;

  return (
    <View className="gap-3">
      <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
        Does the coach score like you?
      </Text>
      <Text className="font-body text-sm leading-relaxed text-muted-foreground">
        {scored} of {pool} calls calibrated. This measures the scorer — it does not change
        anybody&apos;s points.
      </Text>

      {report && report.overallTrustworthy !== null ? (
        <Text
          className={`font-strong text-base ${
            report.overallTrustworthy ? 'text-primary' : 'text-foreground'
          }`}
        >
          {report.overallTrustworthy
            ? 'The coach agrees with you closely enough to trust.'
            : 'The coach and you disagree on at least one dimension.'}
        </Text>
      ) : (
        <Text className="font-body text-sm leading-relaxed text-muted-foreground">
          {/* Never a verdict with nothing behind it — spec 0.5. */}
          Not enough scored yet to say whether the coach agrees with you.
        </Text>
      )}

      {report?.perDimension?.length ? (
        <View className="gap-2">
          {report.perDimension.map((r) => (
            <View
              key={r.dimension}
              accessible
              accessibilityLabel={`${DIMENSION_LABEL[r.dimension] ?? r.dimension}: ${agreementLine(r)}`}
              className={`gap-3 ${stacked ? '' : 'flex-row items-baseline justify-between'}`}
            >
              <Text className="flex-1 font-body text-base text-foreground">
                {DIMENSION_LABEL[r.dimension] ?? r.dimension}
              </Text>
              <Text
                className={`font-body text-sm ${
                  // Only a definite FALSE is a problem. null means unmeasured,
                  // and colouring that as a disagreement would flag a dimension
                  // nobody has scored.
                  r.trustworthy === false ? 'text-destructive' : 'text-muted-foreground'
                }`}
              >
                {agreementLine(r)}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** One dimension's 0–10 picker. */
function Dimension({
  dimension,
  value,
  onPick,
}: {
  dimension: JudgedDimension;
  value: number | undefined;
  onPick: (v: number) => void;
}) {
  return (
    <View className="gap-2">
      <Text className="font-strong text-base text-foreground">
        {DIMENSION_LABEL[dimension] ?? dimension}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {SCALE.map((v) => {
          const on = value === v;
          return (
            <Pressable
              key={v}
              onPress={() => onPick(v)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${DIMENSION_LABEL[dimension] ?? dimension}, ${v} out of 10`}
              className={`min-h-7 w-11 items-center justify-center rounded-md border active:opacity-70 ${
                on ? 'border-primary bg-surface' : 'border-border-control'
              }`}
            >
              <Text
                className={`font-body text-base tabular-nums ${
                  on ? 'text-primary' : 'text-foreground'
                }`}
              >
                {v}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** You versus the coach, after submission. */
function Reveal({
  human,
  model,
  onNext,
}: {
  human: Record<string, number>;
  model: Record<string, number>;
  onNext: () => void;
}) {
  const stacked = useLargeText();
  return (
    <View className="gap-4">
      <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
        You and the coach
      </Text>
      <View className="gap-2">
        {JUDGED_DIMENSIONS.map((d) => {
          const h = human[d];
          const m = model[d];
          const diff = typeof h === 'number' && typeof m === 'number' ? Math.abs(h - m) : null;
          return (
            <View
              key={d}
              accessible
              accessibilityLabel={`${DIMENSION_LABEL[d] ?? d}: you ${h ?? 'not scored'}, coach ${
                m ?? 'not scored'
              }`}
              className={`gap-3 border-b border-border py-2 ${
                stacked ? '' : 'flex-row items-baseline justify-between'
              }`}
            >
              <Text className="flex-1 font-body text-base text-foreground">
                {DIMENSION_LABEL[d] ?? d}
              </Text>
              <Text className="font-body text-base tabular-nums text-muted-foreground">
                {/* An em dash where a score is absent — never a 0, which is a
                    legitimate score somebody may have given. */}
                you {h ?? '—'} · coach {m ?? '—'}
              </Text>
              {diff !== null ? (
                <Text
                  className={`w-10 text-right font-body text-sm tabular-nums ${
                    diff > 1.5 ? 'text-destructive' : 'text-muted-foreground'
                  }`}
                >
                  {diff}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
      <Pressable
        onPress={onNext}
        accessibilityRole="button"
        accessibilityLabel="Score another call"
        className="min-h-7 items-center justify-center rounded-md bg-primary px-4 py-3 active:opacity-80"
      >
        <Text className="font-emphasis text-base text-primary-foreground">Score another</Text>
      </Pressable>
    </View>
  );
}
