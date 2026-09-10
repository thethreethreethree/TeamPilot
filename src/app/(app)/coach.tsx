/**
 * Ask the coach — Phase 2 of the build plan, and zero backend change.
 *
 * The /api/coach/extension/** routes already accept a mobile Bearer token today,
 * which is why this ships without touching TeamPilot. It is the same endpoint the
 * browser extension calls; the app is a second client of it, not a fork.
 *
 * THE EXPENSIVE LESSON THIS SCREEN ENCODES: the plan records that the extension
 * learned "the expensive way" that a stream left running bills the model after
 * the user has gone. Every request here is tied to an AbortController that fires
 * on unmount and on an explicit Stop, so leaving the screen stops generation
 * rather than merely hiding it.
 *
 * WHY THERE IS A NON-STREAM FALLBACK: server-sent events need a connection held
 * open. This app is used at a door, between calls, on whatever signal exists —
 * the exact conditions where a held connection dies first. When the stream fails
 * before producing anything, the screen retries once as a single request
 * (suggestOnce) rather than handing the rep an error they can do nothing about.
 * If the stream already produced text, the partial answer is kept: half a
 * suggestion beats none.
 *
 * A11 governs the framing: the coach surfaces a suggestion and its reasoning; the
 * rep decides. Nothing here grades the rep or tells them they were wrong.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import { coachPost, streamSuggest, suggestOnce } from '@/lib/coach-api';
import { getTranscript } from '@/lib/sync/sessions';
import { readCachedDetail } from '@/lib/sync/session-detail-cache';
import { conversationForRequest, transcriptForCoach } from '@/lib/coach-prefill';
import { useOnline, isOffline } from '@/lib/use-online';
import { reachError } from '@/lib/reach-failure';
import { useAuth } from '@/lib/auth-context';
import { readAnswer, writeAnswer, SCRATCH_SLOT } from '@/lib/sync/coach-answers';
import { clockTime, shortDate } from '@/lib/format';
import { C } from '@/lib/theme';
import { authFailureMessage } from '@/lib/auth-failure';
import {
  NO_SIGNAL_TEXT,
  UNREADABLE_TEXT,
  dissectView,
  isPlanBlocked,
  planBlockedMessage,
} from '@/lib/chat/dissect-view';

type Phase = 'idle' | 'streaming' | 'done' | 'error';
type Mode = 'suggest' | 'dissect';

/**
 * THE DISSECT SHAPE IS NOW VERIFIED, and this type is gone rather than kept.
 *
 * It used to be `Record<string, unknown>`, with the note "reads it defensively
 * rather than asserting a shape nobody verified". The instinct was right and the
 * defence was the defect: reading defensively meant probing for `reply`,
 * `summary` and `text`, and falling through to `JSON.stringify` — which is what
 * a rep saw on TestFlight on 4 September.
 *
 * The shape was checked against the web repository that day:
 * `SalesTextDissect` in `src/lib/coach/extension/salesTextDissect.ts`, returned
 * as `{ dissect }` by the route. `lib/chat/dissect-view.ts` holds it, validates
 * it, and never guesses — an unrecognised shape gets a sentence, not a dump.
 */

export default function CoachScreen() {
  // Arriving from a session carries its id, not its text: a transcript can be
  // thousands of words and a navigation param is the wrong place for it. The
  // screen fetches it under the same RLS that let the session screen show it.
  const { sessionId } = useLocalSearchParams<{ sessionId?: string }>();

  const [conversation, setConversation] = useState('');
  const [loadingTranscript, setLoadingTranscript] = useState(Boolean(sessionId));
  const [guidance, setGuidance] = useState('');
  const [reply, setReply] = useState('');
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [intel, setIntel] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [mode, setMode] = useState<Mode>('suggest');
  const [error, setError] = useState<string | null>(null);
  const [fellBack, setFellBack] = useState(false);
  /** How many lines were left out of the request because it was too long. The
   *  rep's own text is never edited — this is only what was SENT. */
  const [droppedLines, setDroppedLines] = useState(0);
  /** Set when the answer on screen was restored from disk rather than just asked
   *  for. The screen must say so — a suggestion from this morning presented as a
   *  live reply is the kind of quiet lie the cache rules exist to prevent. */
  const [restoredAt, setRestoredAt] = useState<Date | null>(null);

  const { user } = useAuth();
  const userId = user?.id ?? null;
  /** One slot per session, plus a scratch slot for pasted text with no session. */
  const slot = sessionId ?? SCRATCH_SLOT;

  const abortRef = useRef<AbortController | null>(null);
  const alive = useRef(true);
  /** Set the moment the rep asks for anything. A restore that lands after that
   *  must not overwrite their live work — read from a ref rather than `phase`,
   *  which an async callback would only see as it was when it started. */
  const asked = useRef(false);

  // Read BEFORE the callbacks below, because they report on it. It used to be
  // declared a hundred lines further down, and both error paths blamed the
  // signal without ever consulting it — the 4 September full-bars report.
  const online = useOnline();
  const offline = isOffline(online);

  // Leaving the screen must stop generation, not just stop showing it. Without
  // this the model keeps producing — and billing — for a rep who has already
  // walked to the next door.
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      abortRef.current?.abort();
    };
  }, []);

  // A16: the transcript and the coach act on the same conversation, so the coach
  // reads what the session already holds instead of asking the rep to retype it.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      try {
        const segments = await getTranscript(sessionId);
        if (cancelled || !alive.current) return;
        setConversation(transcriptForCoach(segments));
      } catch {
        // Offline, or the read failed. The session screen keeps a copy of this
        // transcript on the device, so the rep can still edit it and ask the
        // moment signal returns — rather than facing an empty box with the
        // conversation they wanted to discuss sitting one screen away.
        try {
          const cached = userId ? await readCachedDetail(userId, sessionId) : null;
          if (!cancelled && alive.current && cached) setConversation(transcriptForCoach(cached.segments));
        } catch {
          // The rep can still paste. A failed prefill is not worth an error
          // banner on a screen whose whole point is the text box below it.
        }
      } finally {
        if (!cancelled && alive.current) setLoadingTranscript(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, userId]);

  // Bring back the last answer for this session, so backing out to re-read the
  // transcript does not cost the rep a second model call and a second wait.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const stored = await readAnswer(userId, slot);
      // Only restore into an untouched screen. If the rep has already started
      // asking, their live work outranks anything on disk.
      if (cancelled || !alive.current || !stored || asked.current) return;

      setReply(stored.reply);
      setReasoning(stored.reasoning);
      setIntel(stored.intel);
      setMode(stored.mode);
      setGuidance((g) => g || stored.guidance);
      // And the text it was answering. Without this the scratch slot restores an
      // answer above an empty box — a reply with its question missing. Only into
      // an EMPTY box: a session prefills from its own transcript, which is the
      // fresher source and must not be overwritten.
      setConversation((c) => c || stored.conversation);
      setRestoredAt(new Date(stored.at));
      setPhase('done');
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, slot]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setPhase((p) => (p === 'streaming' ? 'done' : p));
  }, []);

  const ask = useCallback(async () => {
    if (phase === 'streaming') return;
    const text = conversation.trim();
    if (!text) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    asked.current = true;
    setPhase('streaming');
    setMode('suggest');
    setReply('');
    setReasoning(null);
    setIntel(null);
    setError(null);
    setFellBack(false);
    setRestoredAt(null);

    // Bounded at the moment of asking. A conversation grown by several rounds of
    // "Used it — what next?" can outrun what the model accepts, and a request
    // that is refused for length is a worse answer than one that covers the last
    // part of the exchange and says so.
    const bounded = conversationForRequest(text);
    setDroppedLines(bounded.droppedLines);

    const input = { conversation: bounded.text, guidance: guidance.trim() || undefined };
    let produced = false;
    let streamFailed = false;

    try {
      for await (const event of streamSuggest(input, controller.signal)) {
        if (!alive.current || controller.signal.aborted) return;

        if (event.type === 'delta') {
          produced = true;
          setReply((prev) => prev + event.text);
        } else if (event.type === 'done') {
          produced = true;
          setReply(event.reply);
          setReasoning(event.reasoning ?? null);
          setPhase('done');
        } else {
          streamFailed = true;
          setError(event.error || null);
        }
      }
    } catch {
      streamFailed = true;
    }

    if (!alive.current || controller.signal.aborted) return;

    // The stream gave us nothing usable. Try once as a plain request — a single
    // round trip survives a connection that cannot be held open.
    if (streamFailed && !produced) {
      setFellBack(true);
      try {
        const result = await suggestOnce(input);
        if (!alive.current || controller.signal.aborted) return;
        setReply(result.reply ?? '');
        setReasoning(result.reasoning ?? null);
        setError(null);
        setPhase(result.reply ? 'done' : 'error');
        if (!result.reply) setError('The coach returned an empty answer. Try rephrasing.');
      } catch (e) {
        if (!alive.current) return;
        setError(
          (e as { authFailure?: string })?.authFailure === 'signed-out'
            ? authFailureMessage('signed-out')
            : // Same three-way split as the dissect path below. A locked plan is
              // not a signal problem, and the shared route's own sentence names
              // the browser extension — see planBlockedMessage.
              isPlanBlocked(e)
              ? planBlockedMessage((e as { message?: string })?.message)
              : // The draft-is-safe half is unconditional; only the CAUSE is now
                // established rather than assumed.
                `${reachError(e, online, 'the coach')} Your draft is still here.`,
        );
        setPhase('error');
      }
    } else if (streamFailed && produced) {
      // Partial answer in hand. Keep it and say plainly that it is incomplete.
      setPhase('done');
      setError('The connection dropped part-way. What is below is incomplete.');
    } else {
      setPhase((p) => (p === 'streaming' ? 'done' : p));
    }

    if (abortRef.current === controller) abortRef.current = null;
  }, [conversation, guidance, phase, online]);

  /**
   * Prospect intel. A separate, non-streaming call on the same conversation.
   * The route's response shape is not in the app's type contract, so this
   * renders whatever readable text it finds rather than asserting a field that
   * may not exist.
   */
  const askDissect = useCallback(async () => {
    if (phase === 'streaming') return;
    const text = conversation.trim();
    if (!text) return;

    asked.current = true;
    setPhase('streaming');
    setMode('dissect');
    setDroppedLines(0);
    setError(null);
    setIntel(null);
    setFellBack(false);
    setRestoredAt(null);

    try {
      const result = await coachPost<unknown>('/api/coach/extension/dissect', {
        conversation: text,
      });
      if (!alive.current) return;
      /**
       * NEVER `JSON.stringify` AT A REP.
       *
       * This used to look for `reply`, `summary` or `text` at the top level and,
       * finding none — the route returns `{ dissect }` — print the whole object.
       * A rep on TestFlight saw `{ "dissect": { "hasSignal": false, ... } }`
       * under the heading "What the coach reads in this", on a screen they open
       * between houses.
       *
       * The worse half was `hasSignal: false`. That is the server saying the
       * conversation was too thin to read — its own route comment is "never a
       * fabricated read" — and the app rendered the empty structure instead of
       * the sentence. `dissect-view.ts` now owns the whole rule.
       */
      const view = dissectView(result);
      setIntel(
        view.kind === 'read'
          ? view.text
          : view.kind === 'no-signal'
            ? NO_SIGNAL_TEXT
            : UNREADABLE_TEXT,
      );
      setPhase('done');
    } catch (e) {
      if (!alive.current) return;
      setError(
        (e as { authFailure?: string })?.authFailure === 'signed-out'
          ? authFailureMessage('signed-out')
          : // A locked plan is not a signal problem and not a fault. Said in the
            // app's own words rather than the shared route's, which names the
            // browser extension — see planBlockedMessage.
            isPlanBlocked(e)
            ? planBlockedMessage((e as { message?: string })?.message)
            : reachError(e, online, 'the prospect intel'),
      );
      setPhase('error');
    }
  }, [conversation, phase, online]);

  // Persist once the answer settles. Written from the rendered state rather
  // than inside each branch, so a stream, a one-shot fallback, a partial answer
  // and the dissect call are all kept by the same rule instead of three that
  // drift apart. A restored answer is not written back — that would refresh its
  // timestamp and make an old suggestion look new.
  useEffect(() => {
    if (phase !== 'done' || !userId || restoredAt) return;
    writeAnswer(userId, slot, {
      conversation,
      guidance,
      reply,
      reasoning,
      intel,
      mode,
    });
  }, [phase, userId, slot, restoredAt, conversation, guidance, reply, reasoning, intel, mode]);

  /**
   * Copying is the point of this screen. A rep standing at a door is going to put
   * these words into a message, and pinch-selecting streamed text one-handed is
   * not a realistic way to do that.
   *
   * The confirmation is a state on the control itself rather than a toast: it
   * says "Copied" where the finger already is, and reverts. No library, no
   * overlay, and it reads correctly to a screen reader because the button's own
   * accessible name changes with it.
   */
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  /**
   * Carry on from here.
   *
   * A conversation does not stop when the coach answers. The customer says
   * something back, and the rep needs advice on THAT — but until now asking
   * again simply replaced the answer, and continuing meant retyping the whole
   * exchange while standing at a door.
   *
   * This folds the suggestion into the conversation as the rep's own line and
   * clears the answer, so the box is ready for what the customer said next. The
   * suggestion is added as spoken by "Me" because that is the premise: the rep
   * is asking what happens IF they use it.
   *
   * The saved answer for this slot is deliberately left alone. It is still the
   * last thing the coach said, and the rep may want it back if they abandon the
   * follow-up.
   */
  const continueFrom = useCallback(() => {
    const suggestion = reply.trim();
    if (!suggestion) return;
    asked.current = true;
    setConversation((c) => `${c.trimEnd()}\nMe: ${suggestion}\nCustomer: `.trimStart());
    setReply('');
    setReasoning(null);
    setIntel(null);
    setRestoredAt(null);
    setPhase('idle');
  }, [reply]);

  const copyReply = useCallback(async () => {
    if (!reply) return;
    await Clipboard.setStringAsync(reply);
    setCopied(true);
  }, [reply]);


  const busy = phase === 'streaming';
  // The coach runs on the server. There is nothing useful to attempt offline, so
  // the control says why rather than spending thirty seconds reaching a timeout.
  const canAsk = conversation.trim().length > 0 && !busy && !offline;

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerClassName="px-5 pb-8" keyboardShouldPersistTaps="handled">
          <Text className="mt-4 font-body text-base leading-relaxed text-muted-foreground">
            {sessionId
              ? 'This is what was said in that session. Edit it if you want, then ask — the coach suggests how you might answer, and you decide whether to use it.'
              : 'Paste what was said. The coach reads it and suggests how you might answer — you decide whether to use it.'}
          </Text>

          <Field
            label="The conversation"
            hint="What the customer said, and what you said back."
            value={loadingTranscript ? 'Loading the transcript…' : conversation}
            onChangeText={setConversation}
            multiline
            editable={!busy && !loadingTranscript}
            placeholder="They said the price is too high and they need to talk to their partner…"
          />

          <Field
            label="Anything to steer it (optional)"
            hint="Leave blank and the coach works from the conversation alone."
            value={guidance}
            onChangeText={setGuidance}
            editable={!busy}
            placeholder="Keep it short, they are in a hurry"
          />

          {offline ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="mt-5 rounded-md border border-border-control px-3 py-3"
            >
              <Text className="font-strong text-base text-foreground">No connection</Text>
              <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
                The coach reads your conversation on the server, so it needs signal.
                Your draft stays here — ask again when you have a bar.
              </Text>
            </View>
          ) : null}

          {busy ? (
            <Pressable
              onPress={stop}
              accessibilityRole="button"
              accessibilityLabel="Stop the coach"
              className="mt-6 min-h-7 flex-row items-center justify-center gap-2 rounded-md border border-border-control px-5 active:opacity-70"
            >
              <ActivityIndicator color={C['muted-foreground']} />
              <Text className="font-strong text-base text-muted-foreground">Stop</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={ask}
              disabled={!canAsk}
              accessibilityRole="button"
              accessibilityLabel="Ask the coach"
              accessibilityState={{ disabled: !canAsk }}
              className="mt-6 min-h-7 items-center justify-center rounded-md bg-primary px-5 active:bg-primary-pressed disabled:opacity-50"
            >
              <Text className="font-strong text-base text-primary-foreground">Ask the coach</Text>
            </Pressable>
          )}

          {/* Secondary, so it never competes with the one primary action. */}
          <Pressable
            onPress={askDissect}
            disabled={!canAsk}
            accessibilityRole="button"
            accessibilityLabel="Read the prospect"
            accessibilityState={{ disabled: !canAsk }}
            className="mt-2 min-h-7 items-center justify-center rounded-md border border-border-control px-5 disabled:opacity-50 active:opacity-70"
          >
            <Text className="font-emphasis text-base text-foreground">Read the prospect</Text>
          </Pressable>

          {/* One live region for status, so a screen reader hears "writing" and
              "ready" rather than every token as it lands. */}
          <Text
            accessibilityLiveRegion="polite"
            className="mt-3 font-body text-sm text-muted-foreground"
          >
            {busy
              ? mode === 'dissect'
                ? 'Reading the conversation…'
                : 'The coach is writing…'
              : phase === 'done'
                ? restoredAt
                  ? `Saved from ${shortDate(restoredAt.toISOString())}, ${clockTime(restoredAt.toISOString())}. Ask again for a fresh answer.`
                  : fellBack
                    ? 'Answered in one go — the live connection would not hold.'
                    : 'Ready. Yours to use or ignore.'
                : ''}
          </Text>

          {/* Said next to the answer, because it changes what the answer means.
              The rep's text is untouched — this is only what reached the coach. */}
          {droppedLines > 0 && phase === 'done' ? (
            <Text
              accessibilityLiveRegion="polite"
              className="mt-3 font-body text-sm leading-relaxed text-muted-foreground"
            >
              This was getting long, so the coach read the last part of it — the
              first {droppedLines} {droppedLines === 1 ? 'line' : 'lines'} were not
              sent. Everything you typed is still here.
            </Text>
          ) : null}

          {error ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="assertive"
              className="mt-4 flex-row items-start gap-2 rounded-md border border-destructive px-3 py-3"
            >
              <Text
                className="font-strong text-base text-destructive"
                accessibilityElementsHidden
                importantForAccessibility="no"
              >
                !
              </Text>
              <Text className="flex-1 font-body text-sm leading-relaxed text-destructive">
                {error}
              </Text>
            </View>
          ) : null}

          {reply ? (
            <View className="mt-5 rounded-md border border-border-control p-4">
              <Text className="font-emphasis text-xs uppercase tracking-widest text-primary">
                Suggested response
              </Text>
              {/* still selectable, for a rep who wants only part of it */}
              <Text selectable className="mt-2 font-body text-base leading-relaxed text-foreground">
                {reply}
              </Text>

              {/* Only once the answer is complete: copying half a suggestion
                  mid-stream would hand the rep something that stops mid-sentence. */}
              {!busy ? (
                <View className="mt-4 flex-row gap-2">
                  <Pressable
                    onPress={copyReply}
                    accessibilityRole="button"
                    accessibilityLabel={
                      copied ? 'Copied to the clipboard' : 'Copy the suggested response'
                    }
                    className="min-h-7 flex-1 items-center justify-center rounded-md border border-border-control px-5 py-3 active:opacity-70"
                  >
                    <Text className="font-emphasis text-base text-foreground">
                      {copied ? 'Copied' : 'Copy'}
                    </Text>
                  </Pressable>

                  {/* Only for a suggested reply. "Read the prospect" produces an
                      observation about the customer, not words to say, so
                      folding it in as something the rep said would be nonsense. */}
                  {mode === 'suggest' ? (
                    <Pressable
                      onPress={continueFrom}
                      accessibilityRole="button"
                      accessibilityLabel="Use this and add what they said next"
                      className="min-h-7 flex-1 items-center justify-center rounded-md border border-border-control px-5 py-3 active:opacity-70"
                    >
                      <Text className="font-emphasis text-base text-foreground">
                        Used it — what next?
                      </Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {reasoning ? (
            <View className="mt-3 border-l-2 border-border-control pl-3">
              <Text className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground">
                Why
              </Text>
              <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
                {reasoning}
              </Text>
            </View>
          ) : null}

          {intel ? (
            <View className="mt-5 rounded-md border border-border-control p-4">
              <Text className="font-emphasis text-xs uppercase tracking-widest text-primary">
                What the coach reads in this
              </Text>
              <Text selectable className="mt-2 font-body text-base leading-relaxed text-foreground">
                {intel}
              </Text>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * Every input gets a VISIBLE label and the same words as its accessibilityLabel.
 * A placeholder is never a label — it disappears the moment typing starts. The
 * placeholders here carry an example of the shape of answer, nothing more.
 *
 * React Native has no :focus-visible, so the focus ring is driven from the
 * control's own callbacks.
 */
type FieldProps = React.ComponentProps<typeof TextInput> & {
  label: string;
  hint?: string;
};

function Field({ label, hint, ...input }: FieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View className="mt-5">
      <Text className="font-emphasis text-sm text-muted-foreground">{label}</Text>
      {hint ? <Text className="mt-1 font-body text-xs text-muted-foreground">{hint}</Text> : null}
      <TextInput
        {...input}
        accessibilityLabel={label}
        accessibilityHint={hint}
        placeholderTextColor={C['muted-foreground']}
        textAlignVertical={input.multiline ? 'top' : 'center'}
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        className={`mt-2 min-h-7 rounded-md border px-3 py-3 font-body text-base text-foreground ${
          focused ? 'border-ring' : 'border-border-control'
        } ${input.multiline ? 'min-h-9' : ''}`}
      />
    </View>
  );
}
