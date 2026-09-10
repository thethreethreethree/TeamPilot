/**
 * Setting one rep's daily sales goal, and what a sale is worth.
 *
 * WHY IT IS ITS OWN SCREEN rather than a control on the team roster. That screen
 * says what it is for in its own header — "a manager opens this to find out who
 * needs a conversation today... not a leaderboard, not a ranking, not a monthly
 * review". Administration on top of it would blur the one job it does. A manager
 * taps a rep and arrives here instead.
 *
 * THE GOAL IS THE WHOLE DOOR SCREEN. Every number the rep sees is worked back
 * from it: sold target is the goal, presentations is the goal over the close
 * ratio, doors is that over the contact ratio. Until a manager sets one, that
 * rep's home screen can only say so and name who fixes it.
 *
 * THE VALUE PER SALE IS OPTIONAL AND SAYS SO. Left empty, the rep's cash box
 * counts sales instead of dollars — which is the honest fallback, not a
 * degraded one. What it must never do is show a rep who sold two houses "$0".
 *
 * IT DOES NOT PRETEND TO SAVE WHAT IT DID NOT. When the server writes the goal
 * but drops the value per sale (migration 0248 missing in that environment), the
 * route says so and this screen repeats it, rather than reporting a clean save.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';

import { parseMoney } from '@/lib/format';
import { C } from '@/lib/theme';
import { authFailureMessage } from '@/lib/auth-failure';
import { reachError } from '@/lib/reach-failure';
import { useOnline } from '@/lib/use-online';
import {
  PER_SALE_HINT,
  centsToDollarsText,
  goalPatch,
  goalProblem,
  goalProblemText,
} from '@/lib/doors/rep-goal';
import { fetchRepGoal, saveRepGoal } from '@/lib/doors/rep-goal-api';

type Phase = 'loading' | 'ready' | 'not-manager' | 'error';

export default function RepGoalScreen() {
  const router = useRouter();
  const online = useOnline();
  const { repId, name } = useLocalSearchParams<{ repId?: string; name?: string }>();
  const id = (repId ?? '').trim();
  const repName = (name ?? '').trim();

  const [phase, setPhase] = useState<Phase>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [goalText, setGoalText] = useState('');
  const [perSaleText, setPerSaleText] = useState('');
  /** True when this environment has no `sale_value_cents` column. */
  const [noCashColumn, setNoCashColumn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) {
      setPhase('error');
      setMessage('No rep was chosen.');
      return;
    }
    const result = await fetchRepGoal(id);
    if (result.ok) {
      setGoalText(result.goal.salesGoal === null ? '' : String(result.goal.salesGoal));
      setPerSaleText(centsToDollarsText(result.goal.saleValueCents));
      setNoCashColumn(result.goal.unavailable);
      setPhase('ready');
      return;
    }
    if (result.reason === 'not-manager') {
      setPhase('not-manager');
      return;
    }
    setPhase('error');
    setMessage(
      result.reason === 'needs-shim' && result.why === 'signed-out'
        ? authFailureMessage('signed-out')
        : reachError(null, online, "this rep's goal"),
    );
  }, [id, online]);

  // Loaded on FOCUS, like every other screen in this app, rather than from a
  // bare effect: a manager who sets a goal, backs out and returns should see
  // what is actually stored, not what they typed.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const draft = useMemo(() => ({ goalText, perSaleText }), [goalText, perSaleText]);
  const problem = goalProblem(draft, parseMoney);
  const problemText = goalProblemText(problem);
  const canSave = problem === null && !saving;

  const save = useCallback(async () => {
    const body = goalPatch(id, draft, parseMoney);
    if (!body) return;
    setSaving(true);
    setSaved(null);
    setMessage(null);
    const result = await saveRepGoal(body);
    setSaving(false);
    if (result.ok) {
      setSaved(
        result.saleValueSaved
          ? 'Saved. This rep sees it on their next refresh.'
          : 'The goal was saved. What a sale is worth could not be stored on this server yet, so the rep will see sales to goal rather than dollars.',
      );
      return;
    }
    if (result.reason === 'not-manager') {
      setPhase('not-manager');
      return;
    }
    setMessage(
      result.reason === 'needs-shim' && result.why === 'signed-out'
        ? authFailureMessage('signed-out')
        : reachError(null, online, 'the server'),
    );
  }, [draft, id, online]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <ScrollView contentContainerClassName="px-5 pb-10">
        <Text accessibilityRole="header" className="mt-4 font-heading text-2xl text-foreground">
          Daily goal{repName ? ` for ${repName}` : ''}
        </Text>
        <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
          Their door target is worked back from this. Set the sales they are aiming for in a day and
          the app works out how many doors that takes.
        </Text>

        {phase === 'loading' ? (
          <View
            accessible
            accessibilityState={{ busy: true }}
            accessibilityLabel="Loading this rep's goal"
            className="mt-8 flex-row items-center gap-2"
          >
            <ActivityIndicator color={C['muted-foreground']} />
            <Text className="font-body text-base text-muted-foreground">Loading…</Text>
          </View>
        ) : null}

        {phase === 'not-manager' ? (
          <Panel
            title="Only a manager can set this"
            body="Your account cannot set another rep's daily goal. A manager or an admin at your company can."
          />
        ) : null}

        {phase === 'error' ? <Panel title="Could not load the goal" body={message ?? ''} /> : null}

        {phase === 'ready' ? (
          <>
            <Field
              label="Sales a day"
              hint="A whole number, like 2."
              value={goalText}
              onChangeText={setGoalText}
              keyboardType="number-pad"
              placeholder="2"
            />

            <Field
              label="What one sale is worth"
              hint={noCashColumn ? 'Not available on this server yet.' : PER_SALE_HINT}
              value={perSaleText}
              onChangeText={setPerSaleText}
              keyboardType="decimal-pad"
              placeholder="185"
              editable={!noCashColumn}
            />

            {problemText ? (
              <Text
                accessibilityLiveRegion="polite"
                className="mt-3 font-body text-sm leading-relaxed text-destructive"
              >
                {problemText}
              </Text>
            ) : null}

            <Pressable
              onPress={save}
              disabled={!canSave}
              accessibilityRole="button"
              accessibilityLabel="Save this rep's daily goal"
              accessibilityState={{ disabled: !canSave, busy: saving }}
              style={canSave ? undefined : { opacity: 0.5 }}
              className="mt-6 min-h-14 items-center justify-center rounded-xl bg-primary active:opacity-80"
            >
              <Text className="font-emphasis text-base text-primary-foreground">
                {saving ? 'Saving…' : 'Save goal'}
              </Text>
            </Pressable>

            {saved ? (
              <Text
                accessibilityLiveRegion="polite"
                className="mt-3 font-body text-sm leading-relaxed text-muted-foreground"
              >
                {saved}
              </Text>
            ) : null}

            {message ? (
              <Text
                accessibilityLiveRegion="polite"
                className="mt-3 font-body text-sm leading-relaxed text-destructive"
              >
                {message}
              </Text>
            ) : null}
          </>
        ) : null}

        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back to the team"
          className="mt-8 min-h-7 justify-center active:opacity-70"
        >
          <Text className="font-emphasis text-base text-primary">Back to the team</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

/** A labelled input. A placeholder is not a label, so both are present. */
function Field({
  label,
  hint,
  ...input
}: {
  label: string;
  hint: string;
} & React.ComponentProps<typeof TextInput>) {
  return (
    <View className="mt-6">
      <Text className="font-strong text-base text-foreground">{label}</Text>
      <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">{hint}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={C['muted-foreground']}
        className="mt-2 min-h-14 rounded-xl border border-border-control bg-surface px-4 font-body text-base text-foreground"
        {...input}
      />
    </View>
  );
}

function Panel({ title, body }: { title: string; body: string }) {
  return (
    <View className="mt-8 rounded-xl border border-border-control px-4 py-4">
      <Text className="font-strong text-base text-foreground">{title}</Text>
      {body ? (
        <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">{body}</Text>
      ) : null}
    </View>
  );
}
