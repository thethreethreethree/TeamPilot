/**
 * One Liners — lines that worked, from the rep's own calls.
 *
 * Mirrors `dashboard/sales-coach/strategy`, which the web nav labels "One
 * Liners" and which reads `/api/coach/sales-session/strategy-library`. Each
 * entry is a line the coach identified as having worked, with why it worked and
 * the call it came from.
 *
 * WHY IT EARNS A PHONE SCREEN. This is the one surface here that is genuinely
 * REFERENCE — something a rep opens for fifteen seconds on a doorstep before
 * knocking, to remember how they handled this objection last time. It is
 * read-only, it is short, and it is theirs.
 *
 * THE SOURCE CALL IS SHOWN, and that is the point rather than decoration. A line
 * with no provenance is advice; a line attached to the call where it worked is
 * evidence. The route carries the session label and outcome precisely so the rep
 * can tell which is which.
 */
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect , router } from 'expo-router';

import { coachGet } from '@/lib/coach-api';
import { useOnline } from '@/lib/use-online';
import { reachError } from '@/lib/reach-failure';
import { outcomeLabel, shortDate } from '@/lib/format';
import type { SessionOutcome } from '@/types/backend';
import { C } from '@/lib/theme';
import { authFailureMessage } from '@/lib/auth-failure';
import { SearchField } from '@/components/search-field';
import { blockedState } from '@/lib/blocked-state';

import {
  ONELINER_SEARCH_THRESHOLD,
  filterLines,
} from '@/lib/oneliner-search';

/** One paragraph, written once. See blocked-state.ts for why it is not written here. */
const BLOCKED = blockedState('route', 'your one-liners');

type CorrectLine = {
  correctLine: string;
  whyItWorks: string | null;
  context: string | null;
  sessionLabel: string | null;
  outcome: string | null;
  at: string;
};

/** The route's own bound, named here so the note cannot drift from the number. */
const SERVER_LIMIT = 200;

/**
 * The company's own playbook, which the same route already returns.
 *
 * The web shows this beneath the lines and the app was dropping it — a rep on a
 * phone could not read the methodology their reviews are graded against, or the
 * product details, both of which are exactly what somebody wants to skim
 * standing outside a door.
 */
type Playbook = {
  methodology: string | null;
  product: string | null;
  /** True when the coach falls back to published sales method with no corpus. */
  booksGrounded: boolean;
};

type Phase = 'loading' | 'ready' | 'needs-shim' | 'error';

export default function OneLinersScreen() {
  // Read here so the failure notice can name a cause it has actually checked.
  // These screens all said "check your connection" for every failure, 5xx
  // included — reported 4 September from a phone with full bars.
  const online = useOnline();

  const [lines, setLines] = useState<CorrectLine[]>([]);
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await coachGet<{ correctLines: CorrectLine[] } & Partial<Playbook>>(
        '/api/coach/sales-session/strategy-library',
      );
      setLines(data.correctLines ?? []);
      setPlaybook({
        methodology: data.methodology ?? null,
        product: data.product ?? null,
        booksGrounded: data.booksGrounded === true,
      });
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
      setMessage(reachError(e, online, 'your one-liners'));
      setPhase('error');
    }
  }, [online]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (phase === 'loading') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background" edges={['bottom']}>
        <ActivityIndicator color={C.primary} accessibilityLabel="Loading your one liners" />
      </SafeAreaView>
    );
  }

  if (phase === 'needs-shim') {
    return (
      <SafeAreaView className="flex-1 bg-background px-5" edges={['bottom']}>
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

  // The server ranks; this only narrows. A rep at a door is answering one
  // objection, not browsing.
  const visible = filterLines(lines, query);
  const searchable = lines.length >= ONELINER_SEARCH_THRESHOLD;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <FlatList
        data={visible}
        keyExtractor={(l, i) => `${l.at}-${i}`}
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
        ListHeaderComponent={
          <>
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
            {/* Only once there are enough lines to hunt through — below that a
                search box is furniture, and the same threshold the call list
                uses. */}
            {searchable ? (
              <SearchField
                label="Find a line"
                accessibilityLabel="Find a line by the objection, why it works, or the call it came from"
                placeholder="An objection, or a word you remember"
                noun="line"
                value={query}
                onChangeText={setQuery}
                resultCount={query.trim() ? visible.length : null}
              />
            ) : null}
          </>
        }
        ListEmptyComponent={
          phase === 'error' ? null : query.trim() ? (
            // NOT the "no lines yet" copy: a rep who has 40 lines and mistypes
            // must not be told their playbook is empty.
            <View className="grow items-start justify-center gap-3">
              <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
                Nothing matches &ldquo;{query.trim()}&rdquo;
              </Text>
              <Text className="font-body text-base leading-relaxed text-muted-foreground">
                Your lines are still here. Try one word rather than several, or a word from the
                objection itself.
              </Text>
              <Pressable
                onPress={() => setQuery('')}
                accessibilityRole="button"
                accessibilityLabel="Show all your lines"
                className="min-h-7 justify-center rounded-md border border-primary px-4 py-3 active:opacity-70"
              >
                <Text className="font-emphasis text-base text-primary">Show all lines</Text>
              </Pressable>
            </View>
          ) : (
            <View className="grow items-start justify-center gap-3">
              <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
                No lines yet
              </Text>
              <Text className="font-body text-base leading-relaxed text-muted-foreground">
                A line appears here when the coach spots one of yours that worked, and says why.
                They come from your own calls, so there is nothing generic to show in the
                meantime.
              </Text>
              {/* The action, not just the explanation — copy.md. Lines come from
                  recorded calls, so recording one is how a rep fills this. */}
              <Pressable
                onPress={() => router.push('/(app)/record')}
                accessibilityRole="button"
                accessibilityLabel="Record a call"
                className="min-h-7 justify-center rounded-md border border-primary px-4 py-3 active:opacity-70"
              >
                <Text className="font-emphasis text-base text-primary">Record a call</Text>
              </Pressable>
            </View>
          )
        }
        ItemSeparatorComponent={() => <View className="h-px bg-border" />}
        ListFooterComponent={
          <>
            {/* The route is bounded at 200 and this screen does not paginate.
                Said rather than left as a silent cut: a rep scrolling to the end
                and not finding a line they remember would conclude the coach had
                dropped it. */}
            {lines.length >= SERVER_LIMIT ? (
              <Text className="mt-4 font-body text-sm leading-relaxed text-muted-foreground">
                Showing your {SERVER_LIMIT} most recent lines. Older ones are on the website.
              </Text>
            ) : null}

            {/* The team playbook, as the web shows it beneath the lines. Skimmed
                before a hard call, and it is the same text the coach grades a
                rep against — which is the reason it belongs in their pocket. */}
            {playbook ? (
              <View className="mt-8 gap-3">
                <Text
                  accessibilityRole="header"
                  className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground"
                >
                  Your team&apos;s playbook
                </Text>
                {playbook.methodology ? (
                  <Text className="font-body text-base leading-relaxed text-foreground">
                    {playbook.methodology}
                  </Text>
                ) : (
                  <Text className="font-body text-base leading-relaxed text-muted-foreground">
                    {/* Absent is a real state with a real cause, so it names the
                        cause rather than leaving a blank panel. */}
                    Nobody has written your company&apos;s methodology yet — an admin adds it in
                    Sales Coach settings on the website.
                    {playbook.booksGrounded
                      ? ' Until then the coach reviews against published sales method.'
                      : ''}
                  </Text>
                )}

                {playbook.product ? (
                  <View className="mt-4 gap-2">
                    <Text
                      accessibilityRole="header"
                      className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground"
                    >
                      Product knowledge
                    </Text>
                    <Text className="font-body text-base leading-relaxed text-foreground">
                      {playbook.product}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </>
        }
        renderItem={({ item }) => <Line line={item} />}
      />
    </SafeAreaView>
  );
}

function Line({ line }: { line: CorrectLine }) {
  const outcome = line.outcome
    ? outcomeLabel(line.outcome as SessionOutcome)
    : null;
  // Provenance, built from whatever the route actually carried. Absent parts are
  // omitted rather than filled with a placeholder — "Unknown call" would be
  // worse than nothing, because the point of this line is where it came from.
  const from = [line.sessionLabel?.trim(), outcome, shortDate(line.at)]
    .filter(Boolean)
    .join(' · ');

  return (
    <View
      accessible
      accessibilityLabel={`${line.correctLine}. ${line.whyItWorks ?? ''} ${from}`}
      className="py-5"
    >
      {line.context ? (
        <Text className="mb-1 font-emphasis text-xs uppercase tracking-widest text-primary">
          {line.context}
        </Text>
      ) : null}

      <Text className="font-strong text-base leading-relaxed text-foreground">
        {line.correctLine}
      </Text>

      {line.whyItWorks ? (
        <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
          {line.whyItWorks}
        </Text>
      ) : null}

      {from ? <Text className="mt-2 font-body text-sm text-muted-foreground">{from}</Text> : null}
    </View>
  );
}
