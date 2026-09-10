/**
 * Pitch Performance — the third door-to-door surface, on the phone.
 *
 * Mirrors `dashboard/sales-coach/doors/report-card`: the rep's recorded pitches,
 * newest first, each with its outcome and the after-pitch summary once the
 * analysis has run. The web's period tabs and pattern summary deliberately do
 * NOT live here — they moved to Today's Metrics in the founder's 2026-08-19
 * spec, and the route's own comment says so, so copying them back would put the
 * phone a revision behind the product it is mirroring.
 *
 * A PITCH STILL PROCESSING IS SAID, NOT HIDDEN. The route left-joins the
 * analysis precisely because a fresh pitch has none yet. A row with no summary
 * and no explanation reads as an analysis that failed; this screen says which of
 * the two it is, because only one of them is worth waiting for.
 *
 * THE LIST IS BOUNDED SERVER-SIDE at 200 and this screen does not paginate. That
 * is stated on screen when the list is full rather than left as a silent
 * truncation — a rep scrolling to the end and finding their oldest pitch missing
 * would reasonably conclude it was deleted.
 */
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';

import { coachGet } from '@/lib/coach-api';
import { useOnline } from '@/lib/use-online';
import { reachError } from '@/lib/reach-failure';
import { clockTime, shortDate } from '@/lib/format';
import { pitchOutcomeLabel } from '@/lib/doors/outcome-label';
import { C } from '@/lib/theme';
import { authFailureMessage } from '@/lib/auth-failure';
import { filterPitches, SEARCH_THRESHOLD } from '@/lib/pitch-search';
import { blockedState } from '@/lib/blocked-state';
import { useLargeText } from '@/lib/use-large-text';

/** One paragraph, written once. See blocked-state.ts for why it is not written here. */
const BLOCKED = blockedState('route', 'your pitches');

/** The route's own shape, mapped one-for-one. */
type Pitch = {
  id: string;
  name: string;
  status: string;
  recordedAt: string;
  outcome: string;
  summary: string | null;
};

/** The server's bound. Named here so the "showing the most recent" note cannot
 *  drift away from the number the route actually uses. */
const SERVER_LIMIT = 200;


type Phase = 'loading' | 'ready' | 'needs-shim' | 'error';

export default function PitchesScreen() {
  // Read here so the failure notice can name a cause it has actually checked.
  // These screens all said "check your connection" for every failure, 5xx
  // included — reported 4 September from a phone with full bars.
  const online = useOnline();

  const [pitches, setPitches] = useState<Pitch[]>([]);
  const [phase, setPhase] = useState<Phase>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await coachGet<{ pitches: Pitch[] }>(
        '/api/coach/sales-session/report-card',
      );
      setPitches(data.pitches ?? []);
      setPhase('ready');
    } catch (e) {
      const status = (e as { status?: number })?.status;
      // 2.2: consume coach-api's verdict rather than re-deriving it. A 401 that
      // survived its refresh can mean the rep is SIGNED OUT, and telling them to
      // wait for a deploy would leave them waiting for something that cannot
      // help. coach-api decides once; this branches on the answer.
      const why = (e as { authFailure?: 'signed-out' | 'route' })?.authFailure;
      if (why === 'signed-out') {
        setMessage(authFailureMessage('signed-out'));
        setPhase('error');
        return;
      }
      if (status === 401 || status === 403 || status === 404) {
        setPhase('needs-shim');
        return;
      }
      setMessage(reachError(e, online, 'your pitches'));
      setPhase('error');
    }
  }, [online]);

  const outcomeText = (o: string) => pitchOutcomeLabel(o);
  const visible = filterPitches(pitches, query, outcomeText);
  // A field is only offered once the list is long enough to need one.
  const searchable = pitches.length >= SEARCH_THRESHOLD;

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (phase === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background" edges={['top', 'bottom']}>
        <ActivityIndicator color={C.primary} accessibilityLabel="Loading your pitches" />
      </SafeAreaView>
    );
  }

  if (phase === 'needs-shim') {
    return (
      <SafeAreaView className="flex-1 bg-background px-5" edges={['top', 'bottom']}>
        <View className="mt-6">
          <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
            {BLOCKED.title}
          </Text>
          <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
              {BLOCKED.body}
            </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <FlatList
        data={visible}
        keyExtractor={(p) => p.id}
        contentContainerClassName="grow px-5 pb-10"
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
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <>
            {searchable ? (
              <View className="mt-4">
                <Text className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground">
                  Find a pitch
                </Text>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  // The label names what is ACTUALLY searched. A capability
                  // nobody knows about is one that does not exist.
                  accessibilityLabel="Find a pitch by address, outcome, or its summary"
                  placeholder="Address, outcome, or a word from the summary"
                  placeholderTextColor={C['muted-foreground']}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  clearButtonMode="while-editing"
                  className="mt-2 min-h-7 rounded-md border border-border-control px-3 font-body text-base text-foreground"
                />
                {query.trim() ? (
                  <View className="mt-2 flex-row items-baseline justify-between gap-3">
                  <Text
                    accessibilityLiveRegion="polite"
                    className="flex-1 font-body text-sm text-muted-foreground"
                  >
                    {/* Says what was SEARCHED, not just what was found. The list
                        is capped at 200, so "no matches" could otherwise read as
                        "you never pitched there" when the pitch is simply older
                        than the cap. */}
                    {visible.length} of {pitches.length}
                    {pitches.length >= SERVER_LIMIT
                      ? ` — searching your ${SERVER_LIMIT} most recent pitches only.`
                      : '.'}
                  </Text>
                  {/* clearButtonMode is iOS-only. Without this an Android rep
                      whose search HAS results can only clear it by selecting
                      and deleting the text by hand. */}
                  <Pressable
                    onPress={() => setQuery('')}
                    accessibilityRole="button"
                    accessibilityLabel="Clear the search"
                    className="min-h-7 justify-center active:opacity-70"
                  >
                    <Text className="font-emphasis text-sm text-primary">Clear</Text>
                  </Pressable>
                  </View>
                ) : null}
              </View>
            ) : null}
            {phase === 'error' ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="mt-4 rounded-md border border-destructive px-3 py-3"
            >
              <Text className="font-body text-sm leading-relaxed text-destructive">
                {message}
              </Text>
            </View>
            ) : null}
          </>
        }
        ListEmptyComponent={
          phase === 'error' ? null : query.trim() && pitches.length > 0 ? (
            // NOT "no pitches yet". They have pitches; this search found none of
            // them, and telling a rep they have never recorded a pitch because
            // they mistyped an address is the same lie as a failed load
            // rendering as a zero.
            <View className="grow items-start justify-center gap-3">
              <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
                Nothing matches
              </Text>
              <Text className="font-body text-base leading-relaxed text-muted-foreground">
                No pitch matches &ldquo;{query.trim()}&rdquo;. It searches the address, the
                outcome and the summary — not what was said in the call.
              </Text>
              <Pressable
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Clear the search"
                className="min-h-7 justify-center active:opacity-70"
              >
                <Text className="font-emphasis text-base text-primary">Clear the search</Text>
              </Pressable>
            </View>
          ) : (
            <View className="grow items-start justify-center gap-3">
              <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
                No pitches yet
              </Text>
              <Text className="font-body text-base leading-relaxed text-muted-foreground">
                A pitch appears here once you record one at a door. Each gets its outcome and,
                when the analysis has run, a summary of how it went.
              </Text>
              {/*
                THE ACTION, NOT ONLY THE EXPLANATION — copy.md.

                This screen was the odd one out. Sessions, Skills and One Liners
                all end their empty state with a way to fill it; this one told a
                rep what would appear here and then left them on it. An empty
                state that teaches and offers nothing is the one place in a
                product where a person is already looking for what to do next.

                It matters more here than on the others, because Pitches is a
                MACRO MODE tab: the rep looking at it knocks doors for a living
                and has just been told, on their own tab, that recording is how
                this fills — with no way to start recording.
              */}
              <Pressable
                onPress={() => router.push('/(app)/record')}
                accessibilityRole="button"
                accessibilityLabel="Start recording a pitch"
                className="mt-2 min-h-7 items-center justify-center rounded-md bg-primary px-5 py-3 active:bg-primary-pressed"
              >
                <Text className="font-strong text-base text-primary-foreground">
                  Record a pitch
                </Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={
          !query.trim() && pitches.length >= SERVER_LIMIT ? (
            <Text className="mt-4 font-body text-sm leading-relaxed text-muted-foreground">
              Showing your {SERVER_LIMIT} most recent pitches. Older ones are on the website.
            </Text>
          ) : null
        }
        ItemSeparatorComponent={() => <View className="h-px bg-border" />}
        renderItem={({ item }) => <Row pitch={item} />}
      />
    </SafeAreaView>
  );
}

function Row({ pitch }: { pitch: Pitch }) {
  // Subscribed rather than read once: a rep who turns text up in Settings and comes back finds the row already
  // stacked, instead of a layout cached at launch.
  const stacked = useLargeText();
  const outcome = pitchOutcomeLabel(pitch.outcome);
  const when = `${shortDate(pitch.recordedAt)}, ${clockTime(pitch.recordedAt)}`;
  // Whether an analysis is still coming, or was never going to. The route
  // left-joins it, so an absent summary is expected on a fresh pitch and means
  // something entirely different on an old one.
  const processing = !pitch.summary && pitch.status !== 'analyzed' && pitch.status !== 'failed';

  return (
    <Pressable
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${pitch.name || 'Unnamed pitch'}, ${when}, ${outcome}.${
        pitch.summary ? ` ${pitch.summary}` : processing ? ' Still being analysed.' : ''
      }`}
      accessibilityHint="Opens the full pitch, with its scores and transcript."
      onPress={() => router.push({ pathname: '/(app)/pitch/[pitchId]', params: { pitchId: pitch.id } })}
      // The whole row is the target, so it clears 44pt on its own without hitSlop.
      className="py-4 active:opacity-70"
    >
      {/* At an accessibility text size the name and the outcome cannot share a line: the name is capped at ONE
          line, so it does not wrap — it TRUNCATES, and a rep reads "Door on 4 S…" beside "SOLD". Stacking is the
          same treatment the Scoreboard rows already use, and the cap is lifted when stacked because a name on its
          own line has room to finish. */}
      <View className={stacked ? 'gap-1' : 'flex-row items-baseline justify-between gap-3'}>
        <Text
          numberOfLines={stacked ? 2 : 1}
          className={`font-strong text-base text-foreground ${stacked ? '' : 'flex-1'}`}
        >
          {pitch.name?.trim() || 'Unnamed pitch'}
        </Text>
        <Text className="font-emphasis text-xs text-muted-foreground">{outcome}</Text>
      </View>
      <Text className="mt-1 font-body text-sm text-muted-foreground">{when}</Text>

      {pitch.summary ? (
        <Text className="mt-2 font-body text-base leading-relaxed text-foreground">
          {pitch.summary}
        </Text>
      ) : processing ? (
        <Text className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
          Still being analysed. The summary appears here when it is done.
        </Text>
      ) : (
        <Text className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
          No summary for this pitch.
        </Text>
      )}
    </Pressable>
  );
}
