/**
 * Team Chat — the last of the web's five mobile tabs.
 *
 * WHY THIS ONE WAS HELD BACK UNTIL NOW. The web page is a one-line mount of
 * Elostate's whole chat subsystem, so "port Team Chat" really meant porting a
 * messaging product: 29 migrations, edit guards, no-delete rules, event
 * triggers, full-text search. A chat that reads but cannot send, or that loses
 * messages, is worse than no chat — so it waited until the schema had actually
 * been read rather than guessed at.
 *
 * WHAT READING IT CHANGED. Every rule lives in RLS, not in a route:
 *
 *   - topics are visible to the whole company;
 *   - MESSAGES are visible only to a live participant of that topic — the
 *     policy is deliberately stricter than the one on topics;
 *   - an insert must carry `author_id = auth.uid()`, so nobody can post as
 *     anyone else even with a hand-written request.
 *
 * That is why this ships with no backend change: the database, not this app,
 * decides what a rep may see and say.
 *
 * THE LIST SHOWS TOPICS A REP CANNOT READ, on purpose. They are company-wide by
 * policy. Hiding them would be a second, invented rule; showing them silently
 * would end in an empty thread that reads as "nobody has said anything". So a
 * topic they are not in is listed and labelled as such.
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
import { useFocusEffect, useRouter } from 'expo-router';

import { useAuth } from '@/lib/auth-context';
import { createTopic, listTopics, TOPIC_LIMIT, type ChatTopic } from '@/lib/chat/chat-api';
import { readMyProfile } from '@/lib/profile';
import { topicLine } from '@/lib/chat/topic-line';
import { isUnread, readMarks, type ReadMarks } from '@/lib/chat/read-marks';
import { ENV } from '@/lib/env';
import { humanError } from '@/lib/error-message';
import { webTopicUrl } from '@/lib/web-links';
import { WebsiteLink } from '@/components/website-link';
import { clockTime, shortDate } from '@/lib/format';
import {
  DEFAULT_FILTER,
  emptyFilterMessage,
  filterLabel,
  filterTopics,
  FILTERS,
  hasUncountedTopics,
  topicCounts,
  type TopicFilter,
} from '@/lib/chat/topic-filter';
import { TOPIC_SEARCH_THRESHOLD, searchTopics } from '@/lib/chat/topic-search';
import { SearchField } from '@/components/search-field';
import { C } from '@/lib/theme';
import { useLargeText } from '@/lib/use-large-text';

export default function ChatScreen() {
  // Subscribed, not read once: a rep who turns text up in Settings and comes back finds the list already stacked
  // rather than a layout cached at launch.
  const stacked = useLargeText();
  const router = useRouter();
  const { user } = useAuth();
  // Hoisted, as every other screen here does it. Depending on `user?.id`
  // directly makes the React Compiler bail out of optimising this component —
  // it infers `user` and the source says `user?.id`, so it cannot prove the
  // memoisation is safe and skips the whole file. On a list screen that costs
  // real scroll performance.
  const userId = user?.id ?? null;
  const [topics, setTopics] = useState<ChatTopic[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * The topic that was created but did not add the rep.
   *
   * Held separately from the error sentence because it is what makes the link
   * able to open THAT topic rather than the chat list. A rep in this state has
   * just watched their own topic appear to vanish, and "go and find it" is not
   * a great deal better than saying nothing.
   */
  const [strandedTopicId, setStrandedTopicId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [marks, setMarks] = useState<ReadMarks>({});
  const [filter, setFilter] = useState<TopicFilter>(DEFAULT_FILTER);
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      setTopics(await listTopics(userId));
      setCompanyId((await readMyProfile(userId)).companyId);
      setMarks(await readMarks(userId));
      setError(null);
    } catch (e) {
      // Reads go straight to Supabase under RLS, so there is no "not switched on
      // yet" state here — this needs no shim. A failure is a real failure.
      setError(humanError(e, 'Could not load your team chat. Pull down to try again.'));
      setTopics((prev) => prev ?? []);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const start = useCallback(async () => {
    const t = title.trim();
    if (!t || busy || !userId || !companyId) return;
    setBusy(true);
    setError(null);
    try {
      const { topic, joined } = await createTopic({
        userId,
        companyId,
        title: t,
      });
      setTopics((prev) => [topic, ...(prev ?? [])]);
      setTitle('');
      setStarting(false);
      setStrandedTopicId(null);
      if (!joined) {
        // The topic exists and the whole company can see it; only the roster
        // row failed. Said plainly, because otherwise opening it would look
        // like the app losing the rep's own topic.
        // The id is kept, not just the sentence: it is what makes the link
        // below able to open THIS topic rather than the chat list, and the rep
        // has just watched their own topic appear to go missing.
        setError('The topic was created, but you were not added to it. Join it on the website.');
        setStrandedTopicId(topic.id);
        return;
      }
      router.push({ pathname: '/(app)/topic/[topicId]', params: { topicId: topic.id } });
    } catch (e) {
      // The title STAYS in the box — losing what somebody typed to report a
      // failure is the worse of the two outcomes.
      setError(humanError(e, 'Could not start that topic. Your title is still here.'));
    } finally {
      setBusy(false);
    }
  }, [title, busy, userId, companyId, router]);

  if (topics === null) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-background"
        edges={['top', 'bottom']}
      >
        <ActivityIndicator color={C.primary} accessibilityLabel="Loading team chat" />
      </SafeAreaView>
    );
  }

  const counts = topicCounts(topics);
  // Filter first, then search — the counts on the control describe the whole
  // list, and a search must never appear to change them.
  const inFilter = filterTopics(topics, filter);
  const shown = searchTopics(inFilter, query);
  // Only when the FILTER is what emptied it. With a search running, the empty
  // state below explains the search instead — telling a rep "nothing is open"
  // when they simply mistyped would be a lie about their team.
  const filterNote = inFilter.length === 0 ? emptyFilterMessage(filter) : null;
  const searching = query.trim().length > 0;
  const searchable = topics.length >= TOPIC_SEARCH_THRESHOLD;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top', 'bottom']}>
      <FlatList
        data={shown}
        keyExtractor={(t) => t.id}
        contentContainerClassName="grow px-5 pb-10 pt-4"
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
          <View>
            {/* All is first and is the default: a filter that hides things by
                default is how somebody concludes a topic was deleted. */}
            {topics.length > 0 ? (
              <View className="mb-4 gap-2">
                <View className="flex-row gap-2">
                  {FILTERS.map((f) => {
                    const on = filter === f;
                    const n = counts[f];
                    return (
                      <Pressable
                        key={f}
                        onPress={() => setFilter(f)}
                        accessibilityRole="button"
                        accessibilityState={{ selected: on }}
                        accessibilityLabel={`${filterLabel(f)}, ${n} ${
                          n === 1 ? 'topic' : 'topics'
                        }${on ? ', showing' : ''}`}
                        className={`min-h-7 flex-1 items-center justify-center rounded-md border px-3 py-2 active:bg-surface ${
                          on ? 'border-primary' : 'border-border-control'
                        }`}
                      >
                        <Text
                          className={`font-emphasis text-sm ${
                            on ? 'text-primary' : 'text-foreground'
                          }`}
                        >
                          {filterLabel(f)} {n}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                {/* Open + Closed need not equal All: a topic can be archived.
                    Said once, rather than left as a gap a rep has to notice. */}
                {/* The list is bounded server-side. Without this the counts
                    above read as the whole company's conversations. */}
                {searchable ? (
                  <SearchField
                    label="Find a topic"
                    accessibilityLabel="Find a topic by title, description, or tag"
                    placeholder="A title, a word, or a tag"
                    noun="topic"
                    value={query}
                    onChangeText={setQuery}
                    resultCount={searching ? shown.length : null}
                  />
                ) : null}
                {searching && shown.length === 0 ? (
                  <Text className="font-body text-base leading-relaxed text-muted-foreground">
                    Nothing matches &ldquo;{query.trim()}&rdquo;
                    {filter === 'all' ? '' : ` under ${filterLabel(filter)}`}. Your topics are
                    still here.
                  </Text>
                ) : null}
                {topics.length >= TOPIC_LIMIT ? (
                  <Text className="font-body text-sm leading-relaxed text-muted-foreground">
                    These are your {TOPIC_LIMIT} most recent topics, so the counts cover those
                    rather than everything your company has ever opened.
                  </Text>
                ) : null}
                {hasUncountedTopics(counts) ? (
                  <Text className="font-body text-sm leading-relaxed text-muted-foreground">
                    Some topics are archived, so they show under All only.
                  </Text>
                ) : null}
                {filterNote ? (
                  <Text className="font-body text-base leading-relaxed text-muted-foreground">
                    {filterNote}
                  </Text>
                ) : null}
              </View>
            ) : null}

            {starting ? (
              <View className="mb-4 gap-3">
                <Text className="font-emphasis text-sm text-muted-foreground">
                  What is it about?
                </Text>
                <TextInput
                  value={title}
                  onChangeText={setTitle}
                  editable={!busy}
                  autoFocus
                  maxLength={200}
                  accessibilityLabel="Topic title"
                  placeholder="The objection nobody has a good answer for"
                  placeholderTextColor={C['muted-foreground']}
                  className="min-h-7 rounded-md border border-border-control px-3 py-3 font-body text-base text-foreground"
                />
                <View className="flex-row gap-3">
                  <Pressable
                    onPress={start}
                    disabled={busy || !title.trim()}
                    accessibilityRole="button"
                    accessibilityLabel="Start this topic"
                    accessibilityState={{ disabled: busy || !title.trim(), busy }}
                    className="min-h-7 flex-1 items-center justify-center rounded-md bg-primary px-5 py-3 active:bg-primary-pressed disabled:opacity-50"
                  >
                    <Text className="font-strong text-base text-primary-foreground">
                      {busy ? 'Starting…' : 'Start it'}
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setStarting(false);
                      setTitle('');
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel"
                    className="min-h-7 flex-1 items-center justify-center rounded-md border border-border-control px-5 py-3 active:opacity-70"
                  >
                    <Text className="font-emphasis text-base text-foreground">Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setStarting(true)}
                disabled={!companyId}
                accessibilityRole="button"
                accessibilityLabel="Start a new topic"
                accessibilityState={{ disabled: !companyId }}
                className="mb-4 min-h-7 items-center justify-center rounded-md border border-border-control px-5 py-3 active:bg-surface disabled:opacity-50"
              >
                <Text className="font-emphasis text-base text-foreground">Start a topic</Text>
              </Pressable>
            )}
            {error ? (
              <View
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                className="mb-4 rounded-md border border-destructive px-3 py-3"
              >
                <Text className="font-body text-sm leading-relaxed text-destructive">{error}</Text>
                {/* Only when a topic id came with the failure. Every other error
                    on this screen is about the request, not about a topic that
                    exists somewhere the rep cannot reach. */}
                {strandedTopicId ? (
                  <WebsiteLink
                    url={webTopicUrl(ENV.API_BASE, strandedTopicId)}
                    label="Join it on the website"
                    spoken="Join this topic on the Elostate website"
                    whereInstead="The topic is on elostate.com, under Chats."
                  />
                ) : null}
              </View>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          error ? null : (
            <View className="grow items-start justify-center gap-3">
              <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
                No topics yet
              </Text>
              <Text className="font-body text-base leading-relaxed text-muted-foreground">
                {/* NAMES THE CONTROL, DOES NOT POINT AT IT — copy.md. This read
                    "Start one above", which is meaningless to a screen-reader
                    user swiping through controls and wrong the moment the layout
                    changes. "Start a topic" is the button's own label, so the
                    sentence works whether you can see the screen or not. */}
                Use <Text className="font-emphasis text-foreground">Start a topic</Text> to begin
                one, or open a topic your team has already begun. Everyone at your company can
                see a topic; only the people in it can read what is said inside.
              </Text>
            </View>
          )
        }
        ItemSeparatorComponent={() => <View className="h-px bg-border" />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() =>
              router.push({ pathname: '/(app)/topic/[topicId]', params: { topicId: item.id } })
            }
            accessibilityRole="button"
            accessibilityLabel={`${item.title}.${isUnread(item, marks, item.id) ? ' New messages.' : ''} ${topicLine(item, { date: shortDate, time: clockTime })}.`}
            className="min-h-7 justify-center py-4 active:bg-surface"
          >
            {/* At an accessibility text size the title is capped at ONE line, so it does not wrap — it
                TRUNCATES, and a topic called "The objection nobody has a good answer for" reads as "The objection
                nobo…" beside "New". Stacked, the title gets its own line and its markers sit under it. Same
                treatment as the Scoreboard rows and Pitch Performance. */}
            <View className={stacked ? 'gap-1' : 'flex-row items-baseline justify-between gap-3'}>
              <Text
                numberOfLines={stacked ? 3 : 1}
                className={`font-strong text-base text-foreground ${stacked ? '' : 'flex-1'}`}
              >
                {item.title}
              </Text>
              {/* A WORD, not a coloured dot. Never colour alone (WCAG 1.4.1),
                  and a dot is unreadable to a screen reader — which is also why
                  it is inside the row's accessible name below. */}
              {isUnread(item, marks, item.id) ? (
                <Text className="font-emphasis text-xs text-primary">New</Text>
              ) : null}
              {/* Only a CLOSED topic is marked. Labelling every open one would
                  repeat the same word down the whole list and carry nothing. */}
              {item.status !== 'open' ? (
                <Text className="font-emphasis text-xs text-muted-foreground">
                  {item.status === 'closed' ? 'Closed' : 'Archived'}
                </Text>
              ) : null}
            </View>
            {item.description ? (
              <Text
                numberOfLines={2}
                className="mt-1 font-body text-sm leading-relaxed text-muted-foreground"
              >
                {item.description}
              </Text>
            ) : null}
            {/* Activity, so a rep can tell which topic is worth opening — a list
                of creation dates cannot. The message count is NULL rather than
                zero for a topic they are not in, because the policy hides the
                messages; showing "0 messages" would report a busy topic as
                dead. */}
            <Text className="mt-1 font-body text-sm text-muted-foreground">
              {topicLine(item, { date: shortDate, time: clockTime })}
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}
