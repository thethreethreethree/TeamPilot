/**
 * One chat topic — read it, and reply if you are in it.
 *
 * THE COMPOSER IS OFFERED ONLY TO A LIVE PARTICIPANT, and that is checked before
 * the box is drawn rather than after the send fails. The insert policy would
 * refuse a non-participant anyway, but a rep who types a paragraph and watches
 * it bounce has lost what they wrote. Asking first costs one query.
 *
 * MESSAGES CANNOT BE EDITED OR DELETED, and there is deliberately no control
 * offering either. Migration 0010 installs database rules that make UPDATE and
 * DELETE do nothing at all — "the conversation history is the source of truth
 * for the diagnostic record". A delete button here would be a control that
 * silently does nothing, which is worse than its absence.
 *
 * AN EMPTY THREAD IS AMBIGUOUS AND IS NEVER SHOWN AS ONE. The messages policy is
 * stricter than the topics policy, so a rep can legitimately see a topic listed
 * and read nothing in it. "No messages" and "not your topic" look identical and
 * mean opposite things, so the screen distinguishes them.
 *
 * A FAILED SEND KEEPS THE MESSAGE AND RETRIES ITSELF — but only while this
 * screen is open. That is a deliberate departure from the rest of the app, which
 * queues writes durably across restarts. An outcome or a knocked door is a FACT:
 * arriving an hour late is still correct. A chat message is a TURN in a
 * conversation, and one that lands forty minutes later, after the thread has
 * moved on, is worse than one that never sent — the rep would be answering a
 * question nobody remembers asking. So it retries for as long as they are
 * plausibly still in the conversation, and otherwise stays in the box where they
 * can see it and decide.
 *
 * NEW MESSAGES ARRIVE BY POLLING, NOT A SUBSCRIPTION. No migration in this
 * project adds any table to the `supabase_realtime` publication — checked, not
 * assumed — so a realtime subscription would connect and never fire. This app
 * has already been bitten by exactly that on the session screen. An open thread
 * is a screen somebody is watching, which justifies a short poll; it stops the
 * moment they leave.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/lib/auth-context';
import {
  MESSAGE_LIMIT,
  participantIds,
  fetchTopicDebrief,
  closeTopic,
  myTopicRole,
  fetchTopicById,
  type ChatTopic,
  fetchTopicDecision,
  amParticipant,
  listMessages,
  namesFor,
  sendMessage,
  type ChatMessage,
  listPins,
  setPinned,
} from '@/lib/chat/chat-api';
import { indexParents, previewOf, replyContext } from '@/lib/chat/reply-context';
import { isPinned, pinLine, pinSummary, unpinPrompt, withPin } from '@/lib/chat/pins';
import { bodyView, editedMark } from '@/lib/chat/message-body';
import { durabilityIsWarning, durabilityLine } from '@/lib/chat/durability';
import { canSeeAiAssisted } from '@/lib/chat/ai-assisted';
import { readMyProfile } from '@/lib/profile';
import { markRead } from '@/lib/chat/read-marks';
import { draftAction, restoreMessage, type HeldDraft } from '@/lib/chat/draft';
import { readDebrief, type Debrief } from '@/lib/chat/debrief';
import { hasChanged, needsNames } from '@/lib/chat/poll';
import { buildRoster, rosterLine } from '@/lib/chat/roster';
import { clearDraft, holdDraft, readDraft } from '@/lib/chat/draft-store';
import {
  canCloseTopic,
  closeSummaryProblem,
  MIN_SUMMARY,
  summaryCount,
  type TopicRole,
} from '@/lib/chat/close-topic';
import {
  pathLabel,
  phaseLabel,
  phaseStep,
  readTopicDecision,
  type TopicDecision,
} from '@/lib/chat/topic-decision';
import { webTopicUrl } from '@/lib/web-links';
import { WebsiteLink } from '@/components/website-link';
import { ENV } from '@/lib/env';
import { humanError } from '@/lib/error-message';
import { clockTime, shortDate } from '@/lib/format';
import { useOnline, isOffline } from '@/lib/use-online';
import { C } from '@/lib/theme';

/** The database column is text with no cap; this is a sane one for a phone. */
const MAX_MESSAGE_CHARS = 4000;

/**
 * How often an open thread looks for new messages.
 *
 * Ten seconds is a conversation's pace, not a chat app's — and this is a screen
 * a rep has deliberately open, so the cost is bounded by their attention rather
 * than running all day in a pocket. It stops on blur.
 */
const POLL_MS = 10_000;

export default function TopicScreen() {
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [participant, setParticipant] = useState<boolean | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [pins, setPins] = useState<ReadonlySet<string>>(new Set());
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [decision, setDecision] = useState<TopicDecision>({ kind: 'none' });
  const [topic, setTopic] = useState<ChatTopic | null>(null);
  const [debrief, setDebrief] = useState<Debrief | null>(null);
  const [roster, setRoster] = useState<string | null>(null);
  const [topicRole, setTopicRole] = useState<TopicRole | null>(null);
  const [companyRole, setCompanyRole] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [closeSummary, setCloseSummary] = useState('');
  const [closeBusy, setCloseBusy] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const scroller = useRef<ScrollView | null>(null);
  /** Whose names we already hold, so a poll can tell without a round trip. */
  const namesRef = useRef<Set<string>>(new Set());
  /**
   * A message that would not send, kept with the moment it was written.
   *
   * Held in a ref rather than state: the retry timer closes over it, and a state
   * value would be the one captured when the timer was created.
   */
  const pending = useRef<HeldDraft | null>(null);
  const online = useOnline();

  const load = useCallback(async () => {
    if (!topicId || !userId) return;
    // Asked before the composer is drawn — see the header.
    setParticipant(await amParticipant(topicId, userId));
    const me = await readMyProfile(userId);
    setCompanyId(me.companyId);
    setCompanyRole(me.companyRole);
    setTopicRole(await myTopicRole(topicId, userId));
    // Context on top of the conversation, never a precondition for it: a failed
    // read leaves the card off and the messages untouched.
    setDecision(readTopicDecision(await fetchTopicDecision(topicId)));
    // The topic's OWN row. Without it the header read "Topic" for every
    // conversation and a closed topic looked exactly like an open one.
    setTopic(await fetchTopicById(topicId));
    // Read back only — the phone never generates one. See debrief.ts.
    setDebrief(readDebrief(await fetchTopicDebrief(topicId, userId)));

    // Who can read what gets said here. A rep about to be frank about a
    // customer or a deal is entitled to know the audience first.
    const ids = await participantIds(topicId);
    setRoster(ids.length ? rosterLine(buildRoster(ids, await namesFor(ids), userId)) : null);

    // Words that did not send last time. Restored BEFORE anything else touches
    // the box, because the screen promised the rep they were safe.
    const heldDraft = await readDraft(userId, topicId);
    if (heldDraft) {
      pending.current = heldDraft;
      setDraft((d) => (d.trim() ? d : heldDraft.body));
      // The target comes back WITH the words. Without it the restored reply
      // would post flat, landing under a question as a verdict on the topic.
      setReplyTo((r) => r ?? heldDraft.replyToId ?? null);
    }
    try {
      const rows = await listMessages(topicId);
      setMessages(rows);
      // Read separately and never allowed to fail the screen: a pin is an
      // annotation on a conversation the rep can already read.
      setPins(await listPins(topicId));
      const loaded = await namesFor(rows.map((m) => m.authorId ?? ''));
      namesRef.current = new Set(loaded.keys());
      setNames(loaded);
      // Marked to the newest message ACTUALLY on screen, not to "now" — see
      // read-marks.ts. Marking to now would swallow anything that lands while
      // the rep is reading.
      await markRead(userId, topicId, rows.length ? rows[rows.length - 1].createdAt : null);
      setNotice(null);
    } catch (e) {
      setMessages((prev) => prev ?? []);
      setNotice(humanError(e, 'Could not load this topic. Pull down to try again.'));
    }
  }, [topicId, userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /**
   * Look for new messages while the thread is open.
   *
   * Only the MESSAGES are re-read — not the participant check or the profile,
   * which cannot change while somebody is reading. And the notice is left alone
   * on failure: a poll that fails is not news, and replacing a real error with a
   * poll's error would hide what the rep was actually told.
   */
  useFocusEffect(
    useCallback(() => {
      if (!topicId) return;
      const timer = setInterval(async () => {
        try {
          const rows = await listMessages(topicId);
          // Identity, not COUNT. A message removed and another arriving between
          // two polls leaves the count identical, and a length check would throw
          // the new one away while the rep sat looking at the thread.
          setMessages((prev) => (hasChanged(prev, rows) ? rows : prev));
          // Only when somebody not already on screen has spoken. This ran on
          // every single poll before — a request every ten seconds, all shift,
          // for an answer that almost never changes.
          if (needsNames(rows, namesRef.current)) {
            const fresh = await namesFor(rows.map((m) => m.authorId ?? ''));
            namesRef.current = new Set(fresh.keys());
            setNames(fresh);
          }
          // The thread is open and being read, so a message arriving now IS seen.
          if (userId) {
            await markRead(userId, topicId, rows.length ? rows[rows.length - 1].createdAt : null);
          }
        } catch {
          /* a failed poll is not news; the screen keeps what it has */
        }
      }, POLL_MS);
      return () => clearInterval(timer);
    }, [topicId, userId]),
  );

  const send = useCallback(async () => {
    const body = draft.trim();
    if (!body || sending || !topicId || !userId || !companyId) return;
    setSending(true);
    setNotice(null);
    try {
      const posted = await sendMessage({ topicId, userId, companyId, body, replyToId: replyTo });
      setMessages((prev) => [...(prev ?? []), posted]);
      setDraft('');
      setReplyTo(null);
      requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: true }));
      pending.current = null;
      await clearDraft(userId, topicId);
    } catch (e) {
      // The draft STAYS, and the message is remembered with the moment it was
      // written so the retry can stop being useful.
      pending.current = { body, at: Date.now(), replyToId: replyTo };
      // On DISK, not just in this component. The sentence below promises the
      // message is safe; before this it died the moment the rep backed out.
      await holdDraft(userId, topicId, body, Date.now(), replyTo);
      setNotice(
        humanError(
          e,
          isOffline(online)
            ? 'No signal. Your message is still here and will send itself when you have one.'
            : 'That did not send. Your message is still here — try again.',
        ),
      );
    } finally {
      setSending(false);
    }
    // `replyTo` is load-bearing here, not incidental: without it this callback
    // captures the target as it was when `send` was last built, so a rep who
    // taps Reply and then sends posts against a stale target — or flat.
  }, [draft, sending, topicId, userId, companyId, online, replyTo]);

  /**
   * Send a failed message when the connection comes back.
   *
   * Bounded by the window in draft.ts rather than running forever: past that the thread
   * has moved on, and a reply landing into a conversation nobody remembers is
   * worse than one that never arrived. After the window the message simply stays
   * in the box, which is where the rep can see it and decide.
   */
  useEffect(() => {
    if (sending) return;
    const action = draftAction(pending.current, {
      online: !isOffline(online),
      now: Date.now(),
    });
    if (action.kind === 'none') return;
    if (action.kind === 'restore') {
      // The words go back in the box — never discarded. Only the AUTOMATIC
      // send is given up on; see draft.ts.
      setDraft((d) => (d.trim() ? d : action.body));
      setReplyTo((r) => r ?? action.replyToId);
      if (action.because === 'stale') pending.current = null;
      setNotice(restoreMessage(action.because));
      return;
    }
    if (draft.trim() === action.body) void send();
  }, [online, sending, draft, send]);

  // Indexed once per render rather than scanned per message: a topic can hold
  // hundreds of messages and every one would otherwise search the whole list.
  // Declared ABOVE the early returns — a hook after one runs conditionally.
  const parentsById = useMemo(() => indexParents(messages ?? []), [messages]);
  const [pinBusy, setPinBusy] = useState<string | null>(null);

  /**
   * Pin or unpin, applied only AFTER the server confirms.
   *
   * Never optimistic: a pin is a claim about what the team agreed matters, and
   * showing it as done before the server agreed would let a rep walk away
   * believing they had marked something for everyone when they had not.
   * Removing one asks first — it takes a mark away from the whole team, from a
   * phone, one-handed.
   */
  const togglePin = useCallback(
    async (messageId: string, currentlyPinned: boolean) => {
      if (!topicId || !userId || !companyId || pinBusy) return;
      const run = async () => {
        setPinBusy(messageId);
        setNotice(null);
        const failure = await setPinned({
          topicId,
          messageId,
          companyId,
          userId,
          pinned: !currentlyPinned,
        });
        setPinBusy(null);
        if (failure) {
          setNotice(failure);
          return;
        }
        setPins((prev) => withPin(prev, messageId, !currentlyPinned));
      };
      if (!currentlyPinned) {
        void run();
        return;
      }
      const prompt = unpinPrompt();
      Alert.alert(prompt.title, prompt.body, [
        { text: 'Keep it pinned', style: 'cancel' },
        { text: 'Remove pin', style: 'destructive', onPress: () => void run() },
      ]);
    },
    [topicId, userId, companyId, pinBusy],
  );
  const pinNote = useMemo(
    () => pinLine(pinSummary(messages ?? [], pins)),
    [messages, pins],
  );

  if (messages === null) {
    return (
      <SafeAreaView
        className="flex-1 items-center justify-center bg-background"
        edges={['bottom']}
      >
        <ActivityIndicator color={C.primary} accessibilityLabel="Loading this topic" />
      </SafeAreaView>
    );
  }

  const empty = messages.length === 0;

  return (
    <>
      {/* Falls back to the route's static title rather than an empty header
          while the row loads. Without this every topic read "Topic". */}
      <Stack.Screen options={{ title: topic?.title?.trim() || 'Topic' }} />
      <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
        <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scroller}
          contentContainerClassName="grow px-5 pb-6 pt-4"
          keyboardShouldPersistTaps="handled"
        >
          {notice ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="mb-4 rounded-md border border-destructive px-3 py-3"
            >
              <Text className="font-body text-sm leading-relaxed text-destructive">{notice}</Text>
            </View>
          ) : null}

          {/*
            * A LOCKED TOPIC IS A DISCLOSURE, not a permission.
            *
            * Row-level security already hides a locked topic from anyone who is
            * not in it, so nothing here enforces anything. What the website does
            * — and this app did not — is TELL the person inside it two things:
            * that their teammates and admins cannot see it, and that the coach
            * still reads it. A rep who believes a chat is private, and is not
            * told the system reads it, has been misled by omission. The website
            * calls that a shadow read and refuses to do it; so does this.
            */}
          {topic?.locked ? (
            <View
              accessible
              accessibilityLabel="This is a locked chat. Only its members can see or join it — not your teammates and not admins. The coach still reads it, for coaching and diagnosis."
              className="mb-4 gap-1 rounded-lg border border-border-control px-4 py-3"
            >
              <Text className="font-strong text-base text-foreground">Locked chat</Text>
              <Text className="font-body text-sm leading-relaxed text-muted-foreground">
                Only its members can see or join this chat — not your teammates, not admins. The
                coach still reads it, for coaching and diagnosis.
              </Text>
            </View>
          ) : null}

          {/* The room's own state, above the messages rather than inside them. */}
          {topic && topic.status !== 'open' ? (
            <View className="mb-4 gap-1 rounded-lg border border-border-control px-4 py-3">
              <Text className="font-strong text-base text-foreground">
                {topic.status === 'closed' ? 'This topic is closed' : 'This topic is archived'}
              </Text>
              <Text className="font-body text-sm leading-relaxed text-muted-foreground">
                {/* The web is explicit that a closed topic can still be replied
                    to, so the phone must not imply the conversation is sealed. */}
                It has been wrapped up, and what was concluded is in the thread. You can still
                reply if there is more to say.
              </Text>
              {/* Whether the decision actually HELD. A rep who reads a conclusion
                  and acts on it needs to know if it was later reopened — that
                  changes what the whole topic means. Silent when nobody has
                  reviewed it: "unknown" is not a verdict and must not read as one. */}
              {durabilityLine(topic.closeDurability) ? (
                <Text
                  className={`font-body text-sm leading-relaxed ${
                    durabilityIsWarning(topic.closeDurability)
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  }`}
                >
                  {durabilityLine(topic.closeDurability)}
                </Text>
              ) : null}
            </View>
          ) : null}

          {roster ? (
            <Text className="mb-4 font-body text-sm leading-relaxed text-muted-foreground">
              {roster}
            </Text>
          ) : null}

          {/* Above the messages because it is the state of the room, not a
              message in it. Read-only on the phone — see topic-decision.ts. */}
          <DecisionCard decision={decision} topicId={topicId} />

          {/* A full page means there are older messages this screen is not
              showing. Said, because a rep scrolling up and finding the
              conversation starts mid-sentence would assume something was lost. */}
          {messages.length >= MESSAGE_LIMIT ? (
            <Text className="mb-4 font-body text-sm leading-relaxed text-muted-foreground">
              Showing the {MESSAGE_LIMIT} most recent messages. Anything older is on the
              website.
            </Text>
          ) : null}

          {/* Only ever present on a closed topic, and absent is the normal case
              rather than a failure — so there is no error state here. */}
          {debrief ? (
            <View className="mb-4 gap-3 rounded-lg border border-border-control px-4 py-4">
              <Text
                accessibilityRole="header"
                className="font-emphasis text-xs uppercase tracking-wide text-muted-foreground"
              >
                What the coach took from this
              </Text>
              {debrief.learned.length > 0 ? (
                <View className="gap-1">
                  <Text className="font-strong text-base text-foreground">What you did well</Text>
                  {debrief.learned.map((l, i) => (
                    <Text key={i} className="font-body text-base leading-relaxed text-foreground">
                      {'•'} {l}
                    </Text>
                  ))}
                </View>
              ) : null}
              {debrief.workOn.length > 0 ? (
                <View className="gap-1">
                  <Text className="font-strong text-base text-foreground">What to work on</Text>
                  {debrief.workOn.map((l, i) => (
                    <Text key={i} className="font-body text-base leading-relaxed text-foreground">
                      {'•'} {l}
                    </Text>
                  ))}
                </View>
              ) : null}
              {debrief.closing ? (
                <Text className="font-body text-base leading-relaxed text-muted-foreground">
                  {debrief.closing}
                </Text>
              ) : null}
            </View>
          ) : null}

          {/* Only for somebody the close_topic function will actually accept —
              see close-topic.ts. The website shows this to two roles the
              database then refuses. */}
          {topic?.status === 'open' && canCloseTopic({ topicRole, companyRole }) ? (
            <View className="mb-4 gap-2 rounded-lg border border-border-control px-4 py-3">
              {closing ? (
                <>
                  <Text accessibilityRole="header" className="font-strong text-base text-foreground">
                    What was decided?
                  </Text>
                  <Text className="font-body text-sm leading-relaxed text-muted-foreground">
                    This is what your team reads months later to remember why. It is kept with
                    the topic.
                  </Text>
                  <TextInput
                    value={closeSummary}
                    onChangeText={setCloseSummary}
                    multiline
                    editable={!closeBusy}
                    placeholder="We agreed to…"
                    placeholderTextColor={C['muted-foreground']}
                    accessibilityLabel="What was decided"
                    className="min-h-9 rounded-md border border-border-control px-3 py-2 font-body text-base text-foreground"
                  />
                  <Text className="font-body text-xs text-muted-foreground">
                    {summaryCount(closeSummary).count} / {MIN_SUMMARY}+ characters
                  </Text>
                  {closeError ? (
                    <Text
                      accessibilityRole="alert"
                      accessibilityLiveRegion="polite"
                      className="font-body text-sm leading-relaxed text-destructive"
                    >
                      {closeError}
                    </Text>
                  ) : closeSummary.length > 0 && closeSummaryProblem(closeSummary) ? (
                    <Text className="font-body text-sm leading-relaxed text-muted-foreground">
                      {closeSummaryProblem(closeSummary)}
                    </Text>
                  ) : null}
                  <View className="flex-row gap-3">
                    <Pressable
                      onPress={async () => {
                        const problem = closeSummaryProblem(closeSummary);
                        if (problem) {
                          setCloseError(problem);
                          return;
                        }
                        setCloseBusy(true);
                        setCloseError(null);
                        const failed = await closeTopic(topicId, closeSummary);
                        setCloseBusy(false);
                        if (failed) {
                          setCloseError(failed);
                          return;
                        }
                        setClosing(false);
                        setCloseSummary('');
                        await load();
                      }}
                      disabled={closeBusy}
                      accessibilityRole="button"
                      accessibilityState={{ disabled: closeBusy }}
                      accessibilityLabel="Close this topic"
                      className={`min-h-7 flex-1 items-center justify-center rounded-md px-4 py-3 ${
                        closeBusy ? 'bg-surface' : 'bg-primary active:opacity-80'
                      }`}
                    >
                      <Text
                        className={`font-emphasis text-base ${
                          closeBusy ? 'text-muted-foreground' : 'text-primary-foreground'
                        }`}
                      >
                        {closeBusy ? 'Closing…' : 'Close topic'}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setClosing(false);
                        setCloseError(null);
                      }}
                      disabled={closeBusy}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel closing this topic"
                      accessibilityState={{ disabled: closeBusy }}
                      className="min-h-7 items-center justify-center rounded-md border border-border-control px-4 py-3 active:bg-surface disabled:opacity-50"
                    >
                      <Text className="font-emphasis text-base text-foreground">Cancel</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <Pressable
                  onPress={() => setClosing(true)}
                  accessibilityRole="button"
                  accessibilityLabel="Close this topic and record what was decided"
                  className="min-h-7 justify-center active:opacity-70"
                >
                  <Text className="font-emphasis text-base text-primary">
                    Close this topic
                  </Text>
                </Pressable>
              )}
            </View>
          ) : null}

          {empty ? (
            <View className="grow items-start justify-center gap-3">
              {/* The two cases look identical and mean opposite things. */}
              <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
                {participant === false ? 'You are not in this topic' : 'Nothing said yet'}
              </Text>
              <Text className="font-body text-base leading-relaxed text-muted-foreground">
                {participant === false
                  ? 'Topics are visible to everyone at your company, but the messages inside one are only readable by the people in it. Ask to be added on the website.'
                  : 'Be the first to say something.'}
              </Text>
            </View>
          ) : (
            <View className="gap-4">
              {/* Pins the rep cannot see are the point of this line: the app
                  loads the newest page, so a pin from last week exists and is
                  off screen. Silence there reads as "nothing is pinned". */}
              {pinNote ? (
                <Text className="font-body text-sm text-muted-foreground">{pinNote}</Text>
              ) : null}
              {messages.map((m) => (
                <Message
                  key={m.id}
                  message={m}
                  mine={m.authorId === userId}
                  name={m.authorId ? (names.get(m.authorId) ?? null) : null}
                  pinned={isPinned(m.id, pins)}
                  onTogglePin={
                    participant && m.kind !== 'system'
                      ? () => void togglePin(m.id, isPinned(m.id, pins))
                      : undefined
                  }
                  pinBusy={pinBusy === m.id}
                  showAiMark={canSeeAiAssisted(m, { userId, topicRole, companyRole })}
                  onReply={participant ? () => setReplyTo(m.id) : undefined}
                  reply={replyContext(m, parentsById, (id) =>
                    id === userId
                      ? 'You'
                      : id
                        ? (names.get(id) ?? 'Someone at your company')
                        : 'System',
                  )}
                />
              ))}
            </View>
          )}
        </ScrollView>

        {participant ? (
          <View className="gap-3 border-t border-border px-5 pb-2 pt-3">
            {/* What this message will answer, shown BEFORE it is sent. Without
                it a rep who tapped Reply minutes ago has no way to know their
                words are about to land under a particular message. */}
            {replyTo ? (
              <View className="flex-row items-center justify-between gap-3 rounded-md border border-border-control px-3 py-2">
                <Text
                  numberOfLines={1}
                  className="flex-1 font-body text-sm text-muted-foreground"
                >
                  {(() => {
                    const parent = parentsById.get(replyTo);
                    if (!parent) return '↩ Replying to an earlier message';
                    const who =
                      parent.authorId === userId
                        ? 'you'
                        : parent.authorId
                          ? (names.get(parent.authorId) ?? 'someone at your company')
                          : 'the system';
                    return `↩ Replying to ${who}: ${previewOf(parent.body)}`;
                  })()}
                </Text>
                <Pressable
                  onPress={() => setReplyTo(null)}
                  accessibilityRole="button"
                  accessibilityLabel="Stop replying to that message and send this on its own"
                  className="min-h-7 justify-center active:opacity-70"
                >
                  <Text className="font-emphasis text-sm text-primary">Cancel</Text>
                </Pressable>
              </View>
            ) : null}
            <TextInput
              value={draft}
              onChangeText={setDraft}
              editable={!sending}
              multiline
              maxLength={MAX_MESSAGE_CHARS}
              accessibilityLabel="Your message"
              placeholder="Write a message"
              placeholderTextColor={C['muted-foreground']}
              className="min-h-7 rounded-md border border-border-control px-3 py-3 font-body text-base text-foreground"
            />
            <Pressable
              onPress={send}
              disabled={sending || !draft.trim()}
              accessibilityRole="button"
              accessibilityLabel="Send this message"
              accessibilityState={{ disabled: sending || !draft.trim(), busy: sending }}
              className="min-h-7 items-center justify-center rounded-md bg-primary px-5 py-3 active:bg-primary-pressed disabled:opacity-50"
            >
              <Text className="font-strong text-base text-primary-foreground">
                {sending ? 'Sending…' : 'Send'}
              </Text>
            </Pressable>
          </View>
        ) : participant === false && !empty ? (
          // Readable but not writable is a real state: they left the topic, or
          // were removed. Said, rather than shown as a missing box.
          <View className="border-t border-border px-5 pb-3 pt-3">
            <Text className="font-body text-sm leading-relaxed text-muted-foreground">
              You can read this topic but not reply to it. Ask to be added on the website.
            </Text>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
    </>
  );
}

function Message({
  message,
  mine,
  name,
  reply,
  pinned,
  onTogglePin,
  pinBusy,
  showAiMark,
  onReply,
}: {
  message: ChatMessage;
  mine: boolean;
  name: string | null;
  reply: ReturnType<typeof replyContext>;
  pinned: boolean;
  /** Undefined for a reader, and for system messages — the room's own narration
   *  is not something a rep marks. */
  onTogglePin?: () => void;
  pinBusy?: boolean;
  /** Decided by `canSeeAiAssisted` — a peer must never be passed true. */
  showAiMark: boolean;
  /** Undefined for a rep who can read but not post — no control is offered. */
  onReply?: () => void;
}) {
  // A 'system' message is the room narrating itself — someone joined, the topic
  // closed. It is not a person speaking and must not be dressed as one.
  const system = message.kind === 'system';
  const who = system ? null : mine ? 'You' : (name ?? 'Someone at your company');

  if (system) {
    return (
      <Text className="text-center font-body text-sm leading-relaxed text-muted-foreground">
        {message.body}
      </Text>
    );
  }

  return (
    <View>
      <Text className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground">
        {who} · {shortDate(message.createdAt)}, {clockTime(message.createdAt)}
        {/* Somebody deliberately marked this one as the message to come back
            to. Spoken as well as shown — a screen reader must not miss it. */}
        {pinned ? <Text className="text-primary"> · Pinned</Text> : null}
        {/* A message changed after the rep read it otherwise just differs from
            what they remember — and they conclude they misread it. */}
        {editedMark(message.editedAt) ? ' · edited' : ''}
        {/* Shown to the author and to leaders only — never to a peer. The rule
            and its reasoning live in ai-assisted.ts; this only renders it. */}
        {showAiMark ? (
          <Text className="text-muted-foreground"> · {mine ? 'you used the coach' : 'coach-assisted'}</Text>
        ) : null}
      </Text>
      {/* The rep's own lines carry the rule, the same way a transcript and a
          roleplay do — one reading pattern across the whole app. */}
      <View className={mine ? 'mt-1 border-l-2 border-border-control pl-3' : 'mt-1 pl-3'}>
        {/* What this answers. Without it a threaded reply reads as a statement
            about the whole topic — a different sentence entirely. */}
        {reply.kind === 'parent' ? (
          <Text
            numberOfLines={1}
            className="mb-1 font-body text-sm text-muted-foreground"
            accessibilityLabel={`Replying to ${reply.author}, who said: ${reply.preview}`}
          >
            ↩ {reply.author}: {reply.preview}
          </Text>
        ) : reply.kind === 'unloaded' ? (
          <Text
            className="mb-1 font-body text-sm text-muted-foreground"
            accessibilityLabel="Replying to an earlier message, further back in this topic"
          >
            ↩ Replying to an earlier message
          </Text>
        ) : null}
        {/* Not `message.body` — an attachment carries a NULL body, so drawing
            it alone rendered a shared photo as a blank gap in the thread. */}
        {(() => {
          const view = bodyView(message);
          if (view.kind === 'text') {
            return (
              <Text className="font-body text-base leading-relaxed text-foreground">
                {view.text}
              </Text>
            );
          }
          if (view.kind === 'attachment') {
            return (
              <View className="gap-1">
                {view.caption ? (
                  <Text className="font-body text-base leading-relaxed text-foreground">
                    {view.caption}
                  </Text>
                ) : null}
                <Text className="font-body text-sm leading-relaxed text-muted-foreground">
                  {view.label}
                </Text>
              </View>
            );
          }
          return (
            <Text className="font-body text-base italic leading-relaxed text-muted-foreground">
              No message content
            </Text>
          );
        })()}
        {/* Answering a specific message rather than the room. Offered only to a
            rep who can actually post — a control that cannot work is worse than
            none. The label names WHO is being answered, because a screen reader
            hears these out of context. */}
        {onReply || onTogglePin ? (
          <View className="mt-1 flex-row gap-4">
            {onReply ? (
              <Pressable
                onPress={onReply}
                accessibilityRole="button"
                accessibilityLabel={`Reply to ${who}`}
                className="min-h-7 justify-center active:opacity-70"
              >
                <Text className="font-emphasis text-sm text-primary">Reply</Text>
              </Pressable>
            ) : null}
            {onTogglePin ? (
              <Pressable
                onPress={onTogglePin}
                disabled={pinBusy}
                accessibilityRole="button"
                accessibilityState={{ disabled: pinBusy, busy: pinBusy, selected: pinned }}
                // Names the effect on the TEAM, because that is what a rep
                // cannot see from this screen and is the whole weight of it.
                accessibilityLabel={
                  pinned
                    ? `Remove the pin from ${who}'s message — your team stops seeing it marked`
                    : `Pin ${who}'s message so your team sees it marked`
                }
                className="min-h-7 justify-center active:opacity-70 disabled:opacity-50"
              >
                <Text
                  className={`font-emphasis text-sm ${pinned ? 'text-muted-foreground' : 'text-primary'}`}
                >
                  {pinBusy ? 'Saving…' : pinned ? 'Unpin' : 'Pin'}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/**
 * The decision on this topic, if there is one.
 *
 * Read-only, and it SAYS so. The website drives the dialogue; offering a rep a
 * control here that cannot work would be worse than offering none.
 */
function DecisionCard({ decision, topicId }: { decision: TopicDecision; topicId: string }) {
  if (decision.kind === 'none') return null;

  if (decision.kind === 'open') {
    const { step, total } = phaseStep(decision.phase);
    return (
      <View
        accessible
        accessibilityLabel={`A decision is open on this topic.${
          decision.situation ? ` ${decision.situation}.` : ''
        } ${phaseLabel(decision.phase)}, step ${step} of ${total}. It is worked through on the website.`}
        className="mb-4 gap-1 rounded-lg border border-border-control px-4 py-3"
      >
        <Text className="font-emphasis text-xs uppercase tracking-wide text-muted-foreground">
          Decision open · {step} of {total}
        </Text>
        {/* The question itself. A progress line with no subject tells a rep
            nothing about whether this concerns them. */}
        {decision.situation ? (
          <Text className="font-strong text-base leading-relaxed text-foreground">
            {decision.situation}
          </Text>
        ) : null}
        <Text
          className={`font-body text-sm text-muted-foreground${
            decision.situation ? '' : ' font-strong text-base text-foreground'
          }`}
        >
          {phaseLabel(decision.phase)}
        </Text>
        <Text className="font-body text-sm leading-relaxed text-muted-foreground">
          Your team is working this through with the coach on the website. It appears here once
          it is decided.
        </Text>
        {/*
          THE WAY THERE, not only the name of the place.

          This card used to end at the sentence above. Naming somewhere a rep
          cannot reach from here is the same shape as an empty state that
          explains what would fill it and offers no way to start — it teaches
          and leaves the person exactly where they were.

          It matters more than it looks: a rep is NOT barred from taking part.
          The website's `respond` route is gated on being a participant of this
          topic, not on being an admin — checked against that repository on
          4 September, and see the note at the top of lib/chat/topic-decision.ts,
          which used to claim the opposite. So this is a real invitation the
          card was quietly turning into a shrug.

          ONLY ON AN OPEN DECISION. A decided one is frozen; sending someone to
          the website to look at a conclusion they can already read here would
          be motion without a purpose.
        */}
        <WebsiteLink
          url={webTopicUrl(ENV.API_BASE, topicId)}
          label="Take part on the website"
          spoken="Take part in this decision on the Elostate website"
          whereInstead="The decision is on elostate.com, under Chats."
        />
      </View>
    );
  }

  return (
    <View
      accessible
      accessibilityLabel={`Decided.${decision.situation ? ` ${decision.situation}.` : ''} ${pathLabel(
        decision.path,
      )}.${decision.note ? ` ${decision.note}` : ''}`}
      className="mb-4 gap-1 rounded-lg border border-primary px-4 py-3"
    >
      <Text className="font-emphasis text-xs uppercase tracking-wide text-muted-foreground">
        Decided{decision.decidedAt ? ` · ${shortDate(decision.decidedAt)}` : ''}
      </Text>
      {/* What was decided is unreadable without what was being decided:
          "Hybrid" on its own tells a rep nothing. */}
      {decision.situation ? (
        <Text className="font-strong text-base leading-relaxed text-foreground">
          {decision.situation}
        </Text>
      ) : null}
      <Text
        className={
          decision.situation
            ? 'font-emphasis text-sm text-primary'
            : 'font-strong text-base text-foreground'
        }
      >
        {pathLabel(decision.path)}
      </Text>
      {decision.note ? (
        <Text className="font-body text-base leading-relaxed text-foreground">
          {decision.note}
        </Text>
      ) : null}
    </View>
  );
}
