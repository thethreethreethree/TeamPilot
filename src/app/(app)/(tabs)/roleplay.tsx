/**
 * Roleplay — practise a pitch, then read the review.
 *
 * Mirrors `dashboard/sales-coach/roleplay`: pick a persona, type your opener,
 * the coach answers as the prospect, and at the end you get a review. Same four
 * personas, same words.
 *
 * THE RUN LIVES ONLY HERE, and the screen is built around that fact. The route
 * is stateless by design — its own comment says a roleplay "must NOT pollute the
 * rep's session history or metrics" — so nothing is persisted server-side. That
 * makes leaving mid-run destructive in a way no other screen in this app is, so:
 *
 *   - the review is offered as soon as there is enough to review, rather than
 *     only at some end the rep has to find;
 *   - "Start over" asks first, because it throws away the only copy;
 *   - the turn limit is warned about BEFORE it is hit, since the route refuses
 *     an 81st message with a 400 rather than truncating, and a rep who discovers
 *     that mid-flow has lost the run.
 *
 * WHY IT IS NOT SAVED TO THE PHONE EITHER. It could be, and the app already has
 * the machinery. But practice that is quietly filed reads as practice that
 * counts, and the whole point of this surface is that it does not — it is the
 * one place a rep can be bad at something without it going on their record.
 */
import { useCallback, useEffect, useRef, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";

import { focusSeed } from "@/lib/roleplay-seed";
import {
  CONTEXTS,
  PERSONAS,
  MAX_MESSAGE_CHARS,
  canReview,
  nextProspectLine,
  reviewRoleplay,
  scenarioFromPitch,
  turnsRemaining,
  type RoleplayMessage,
  type RoleplayReview,
} from "@/lib/roleplay";
import { roleplaySeed, type RoleplaySeed } from "@/lib/roleplay-seed";
import { C } from "@/lib/theme";
import { authFailureMessage } from "@/lib/auth-failure";
import { blockedState } from "@/lib/blocked-state";
import {
  NEXT_REP_HEADING,
  NOT_ATTEMPTED_BODY,
  SCORE_HEADING,
  type PracticeScoreView,
} from "@/lib/practice-scorecard";

/** One paragraph, written once. See blocked-state.ts for why it is not written here. */
const BLOCKED = blockedState("route", "role play");

/** Warn with this many turns left, not at zero. */
const WARN_AT_TURNS = 5;

export default function RoleplayScreen() {
  // Arriving from a pitch's "practise this pitch" button. Absent for a plain
  // practice, which is the ordinary case.
  const { pitchId, focus: focusParam } = useLocalSearchParams<{
    pitchId?: string;
    /** Arriving from Training's "Practise this" on a growth area. */
    focus?: string;
  }>();
  const [persona, setPersona] = useState(PERSONAS[0].label);
  // Defaults to at-the-door, exactly as the website does, so a door rep never
  // has to touch it. It is not cosmetic: the route feeds this into the prompt
  // for both the prospect and the reviewer.
  const [context, setContext] = useState<(typeof CONTEXTS)[number]["value"]>(
    CONTEXTS[0].value,
  );
  /** null while a pitch is still being rebuilt; set once the answer is known. */
  const [seed, setSeed] = useState<RoleplaySeed | null>(null);
  const [started, setStarted] = useState(false);
  const [messages, setMessages] = useState<RoleplayMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [review, setReview] = useState<RoleplayReview | null>(null);
  const [skill, setSkill] = useState<PracticeScoreView>({ kind: "none" });
  const scroller = useRef<ScrollView | null>(null);

  const remaining = turnsRemaining(messages);

  // Rebuild the customer from the real pitch. Runs once per pitch, and never
  // over a run already in progress — a rep who has started talking must not
  // have their prospect swapped underneath them.
  useEffect(() => {
    if (!pitchId || seed || started) return;
    let live = true;
    void scenarioFromPitch(pitchId).then((res) => {
      if (!live) return;
      const built = roleplaySeed(res);
      setSeed(built);
      if (built.kind === "replay") setPersona(built.persona);
    });
    return () => {
      live = false;
    };
  }, [pitchId, seed, started]);

  /**
   * A practice seeded by a SKILL, from Training's "Practise this".
   *
   * There is no pitch to rebuild, so the prospect stays a preset and only the
   * REVIEW changes: the route scores whether the rep actually applied the skill
   * they came to drill. Held in state rather than derived so that clearing the
   * screen for a fresh run also clears what it is scoring.
   */
  const [skillFocus, setSkillFocus] = useState<string | null>(() =>
    focusSeed(focusParam),
  );

  const replay = seed?.kind === "replay" ? seed : null;
  /** What the route is told to score. A rebuilt pitch's own focus wins. */
  const activeFocus = replay?.focus ?? skillFocus;
  // Derived rather than a second piece of state: it is true exactly while a
  // pitch was asked for and its answer has not arrived.
  const seeding = !!pitchId && !seed && !started;

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || busy) return;
    const mine: RoleplayMessage = { role: "rep", text };
    const next = [...messages, mine];
    setMessages(next);
    setDraft("");
    setBusy(true);
    setNotice(null);

    const result = await nextProspectLine({
      persona,
      context,
      messages: next,
      customPrompt: replay?.situation,
      focus: activeFocus,
    });
    setBusy(false);

    if (result.ok) {
      setMessages((m) => [...m, { role: "prospect", text: result.reply }]);
      // Scrolled after the reply lands, so the rep reads the answer rather than
      // watching their own line scroll away.
      requestAnimationFrame(() =>
        scroller.current?.scrollToEnd({ animated: true }),
      );
      return;
    }
    if (result.reason === "needs-shim") {
      // A signed-out rep gets the message that names the fix they can perform, not the route-refusal paragraph
      // that tells them nothing will help. The verdict comes from coach-api, after its own refresh attempt.
      if (result.why === "signed-out") {
        setNotice(authFailureMessage("signed-out"));
        return;
      }
      setBlocked(true);
      return;
    }
    // The rep's line STAYS in the conversation and their draft is not restored —
    // it is already on screen. Losing what they typed to report a network
    // failure would be the worse of the two.
    setNotice(result.message);
  }, [draft, busy, messages, persona, context, replay, activeFocus]);

  const askForReview = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    const result = await reviewRoleplay({
      persona,
      context,
      messages,
      customPrompt: replay?.situation,
      focus: activeFocus,
    });
    setBusy(false);
    if (result.ok) {
      setReview(result.review);
      setSkill(result.skill);
      requestAnimationFrame(() =>
        scroller.current?.scrollToEnd({ animated: true }),
      );
      return;
    }
    if (result.reason === "needs-shim") {
      // A signed-out rep gets the message that names the fix they can perform, not the route-refusal paragraph
      // that tells them nothing will help. The verdict comes from coach-api, after its own refresh attempt.
      if (result.why === "signed-out") {
        setNotice(authFailureMessage("signed-out"));
        return;
      }
      setBlocked(true);
      return;
    }
    setNotice(result.message);
  }, [busy, messages, persona, context, replay, activeFocus]);

  const startOver = useCallback(() => {
    // Asked, because this is the only copy of the run.
    //
    // "NOTHING IS SAVED" IS TRUE TODAY AND IS LOAD-BEARING. The backend defines
    // a `coach.practice_scored` event and two routes read it to build a rep's
    // practice trend — but nothing in the whole repository WRITES it, so a
    // roleplay really does leave no trace. If a producer is ever added, this
    // sentence becomes a lie and has to change with it, and the Training
    // screen's practice section will start filling from the same event.
    Alert.alert(
      "Start over?",
      "This practice run is only on this phone — nothing is saved. Starting over throws it away.",
      [
        { text: "Keep going", style: "cancel" },
        {
          text: "Start over",
          style: "destructive",
          onPress: () => {
            setMessages([]);
            setReview(null);
            setSkill({ kind: "none" });
            setDraft("");
            setNotice(null);
            setStarted(false);
            // The next run is a plain practice unless the rep asks for a skill
            // again — otherwise the banner keeps promising a score for a drill
            // they have just thrown away.
            setSkillFocus(null);
          },
        },
      ],
    );
  }, []);

  if (blocked) {
    return (
      <SafeAreaView
        className="flex-1 bg-background px-5"
        edges={["top", "bottom"]}
      >
        <View className="mt-6">
          <Text
            accessibilityRole="header"
            className="font-heading text-xl text-foreground"
          >
            {BLOCKED.title}
          </Text>
          <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
            {BLOCKED.body}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!started) {
    return (
      <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
        <ScrollView contentContainerClassName="px-5 pb-10">
          <Text className="mt-4 font-body text-base leading-relaxed text-muted-foreground">
            Practise a pitch against a prospect who pushes back. Nothing here is
            saved and none of it touches your numbers — it is the one place you
            can get it wrong for free.
          </Text>

          {/* WHICH PRACTICE THIS ACTUALLY IS. A rep who tapped "practise this
              pitch" was promised that exact customer; if the rebuild failed they
              are told so here rather than left rehearsing an invented objection
              in the belief they rehearsed the real one. */}
          {seeding ? (
            <View className="mt-5 flex-row items-center gap-3">
              <ActivityIndicator color={C["muted-foreground"]} />
              <Text className="font-body text-base text-muted-foreground">
                Rebuilding that customer from your pitch…
              </Text>
            </View>
          ) : replay ? (
            <View className="mt-5 gap-1 rounded-lg border border-primary px-4 py-3">
              <Text className="font-strong text-base text-foreground">
                Replaying your pitch
              </Text>
              <Text className="font-body text-sm leading-relaxed text-muted-foreground">
                The coach is playing the customer from that call and the
                objections they raised.
                {replay.focus ? ` You will be scored on: ${replay.focus}.` : ""}
              </Text>
            </View>
          ) : skillFocus ? (
            /* Seeded from Training's "Practise this". The prospect is a preset —
               only the REVIEW changes — so the banner must say what is actually
               different rather than implying a rebuilt customer. */
            <View className="mt-5 gap-1 rounded-lg border border-primary px-4 py-3">
              <Text className="font-strong text-base text-foreground">
                Practicing one skill
              </Text>
              <Text className="font-body text-sm leading-relaxed text-muted-foreground">
                Pick a prospect and start. The review at the end scores whether
                you actually applied it: {skillFocus}
              </Text>
            </View>
          ) : seed?.kind === "plain" ? (
            <View className="mt-5 rounded-md border border-border-control px-4 py-3">
              <Text className="font-body text-sm leading-relaxed text-muted-foreground">
                {seed.reason}
              </Text>
            </View>
          ) : null}

          <Text
            accessibilityRole="header"
            className="mb-2 mt-6 font-emphasis text-xs uppercase tracking-widest text-muted-foreground"
          >
            {replay
              ? "Or practise someone else instead"
              : "Who are you talking to?"}
          </Text>

          <View className="gap-3">
            {replay ? (
              <View className="rounded-lg border border-primary px-4 py-4">
                <Text className="font-strong text-base text-primary">
                  {replay.persona}
                </Text>
                <Text className="mt-1 font-body text-sm text-muted-foreground">
                  Rebuilt from your recorded pitch
                </Text>
              </View>
            ) : null}
            {PERSONAS.map((p) => {
              const on = p.label === persona;
              return (
                <Pressable
                  key={p.label}
                  onPress={() => setPersona(p.label)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${p.label}. ${p.hint}`}
                  className={`min-h-7 justify-center rounded-lg border px-4 py-4 active:bg-surface ${
                    on ? "border-primary" : "border-border-control"
                  }`}
                >
                  <Text
                    className={`font-strong text-base ${on ? "text-primary" : "text-foreground"}`}
                  >
                    {p.label}
                  </Text>
                  <Text className="mt-1 font-body text-sm text-muted-foreground">
                    {p.hint}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/*
           * Where the conversation is happening. Not decoration: the route
           * feeds this into the prompt for BOTH the prospect and the reviewer,
           * so a rep practising a video call was previously being coached on
           * doorstep timing. At-the-door is first and is the default, as it is
           * on the website, so a door rep never has to think about it.
           */}
          <Text
            accessibilityRole="header"
            className="mt-6 font-emphasis text-xs uppercase tracking-widest text-muted-foreground"
          >
            Where is this happening
          </Text>
          <View className="mt-3 gap-3">
            {CONTEXTS.map((c) => {
              const on = c.value === context;
              return (
                <Pressable
                  key={c.value}
                  onPress={() => setContext(c.value)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${c.label}. ${c.hint}`}
                  className={`min-h-7 justify-center rounded-lg border px-4 py-4 active:bg-surface ${
                    on ? "border-primary" : "border-border-control"
                  }`}
                >
                  <Text
                    className={`font-strong text-base ${on ? "text-primary" : "text-foreground"}`}
                  >
                    {c.label}
                  </Text>
                  <Text className="mt-1 font-body text-sm text-muted-foreground">
                    {c.hint}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => setStarted(true)}
            accessibilityRole="button"
            accessibilityLabel={
              replay
                ? `Start replaying your pitch against ${replay.persona}`
                : `Start practicing with a ${persona} prospect`
            }
            className="mt-6 min-h-7 items-center justify-center rounded-lg bg-primary px-5 py-4 active:bg-primary-pressed"
          >
            <Text className="font-strong text-base text-primary-foreground">
              Start practicing
            </Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scroller}
          contentContainerClassName="px-5 pb-6"
          keyboardShouldPersistTaps="handled"
        >
          <Text className="mt-4 font-body text-sm text-muted-foreground">
            Practicing with a {persona.toLowerCase()} prospect. Nothing is
            saved.
          </Text>

          {messages.length === 0 ? (
            <Text className="mt-6 font-body text-base leading-relaxed text-muted-foreground">
              Open the way you would at a door. They will answer in character.
            </Text>
          ) : null}

          <View className="mt-4 gap-4">
            {messages.map((m, i) => (
              <View key={`${i}-${m.role}`}>
                <Text className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground">
                  {m.role === "rep" ? "You" : "Prospect"}
                </Text>
                {/* The rep's own lines carry the rule, exactly as in a real
                    transcript — the same reading pattern in both places. */}
                <View
                  className={
                    m.role === "rep"
                      ? "mt-1 border-l-2 border-border-control pl-3"
                      : "mt-1 pl-3"
                  }
                >
                  <Text className="font-body text-base leading-relaxed text-foreground">
                    {m.text}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {busy ? (
            <View className="mt-4 flex-row items-center gap-2">
              <ActivityIndicator color={C.primary} />
              <Text
                accessibilityLiveRegion="polite"
                className="font-body text-sm text-muted-foreground"
              >
                Thinking…
              </Text>
            </View>
          ) : null}

          {notice ? (
            <View
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
              className="mt-4 rounded-md border border-destructive px-3 py-3"
            >
              <Text className="font-body text-sm leading-relaxed text-destructive">
                {notice}
              </Text>
            </View>
          ) : null}

          {/* Warned BEFORE the wall, not at it. The route refuses an over-long
              conversation outright rather than trimming it. */}
          {remaining <= WARN_AT_TURNS && !review ? (
            <Text className="mt-4 font-body text-sm leading-relaxed text-muted-foreground">
              {remaining === 0
                ? "This run is as long as it can get. Take the review now."
                : `${remaining} more ${remaining === 1 ? "turn" : "turns"} before this run is full. Take the review before then.`}
            </Text>
          ) : null}

          {review ? <Review review={review} skill={skill} /> : null}
        </ScrollView>

        <View className="gap-3 border-t border-border px-5 pb-2 pt-3">
          {!review ? (
            <>
              <Text className="font-emphasis text-sm text-muted-foreground">
                Your line
              </Text>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                editable={!busy && remaining > 0}
                multiline
                maxLength={MAX_MESSAGE_CHARS}
                accessibilityLabel="Your line"
                placeholder="Hi, I'm with Elostate — do you have a minute?"
                placeholderTextColor={C["muted-foreground"]}
                className="min-h-7 rounded-md border border-border-control px-3 py-3 font-body text-base text-foreground"
              />
              <View className="flex-row gap-3">
                <Pressable
                  onPress={send}
                  disabled={busy || !draft.trim() || remaining === 0}
                  accessibilityRole="button"
                  accessibilityLabel="Say this to the prospect"
                  accessibilityState={{
                    disabled: busy || !draft.trim() || remaining === 0,
                  }}
                  className="min-h-7 flex-1 items-center justify-center rounded-md bg-primary px-5 py-3 active:bg-primary-pressed disabled:opacity-50"
                >
                  <Text className="font-strong text-base text-primary-foreground">
                    Say it
                  </Text>
                </Pressable>
                <Pressable
                  onPress={askForReview}
                  disabled={busy || !canReview(messages)}
                  accessibilityRole="button"
                  accessibilityLabel="End the practice and get the review"
                  accessibilityState={{
                    disabled: busy || !canReview(messages),
                  }}
                  className="min-h-7 flex-1 items-center justify-center rounded-md border border-border-control px-5 py-3 disabled:opacity-50 active:opacity-70"
                >
                  <Text className="font-emphasis text-base text-foreground">
                    Get the review
                  </Text>
                </Pressable>
              </View>
            </>
          ) : null}

          <Pressable
            onPress={startOver}
            accessibilityRole="button"
            accessibilityLabel="Start a new practice run"
            className="min-h-7 justify-center active:opacity-70"
          >
            <Text className="font-emphasis text-sm text-muted-foreground">
              Start over
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/**
 * The review.
 *
 * A11 governs the framing: it surfaces what happened and what to try; it does
 * not grade the rep. Every list is rendered only when it has something in it —
 * an empty "What worked" heading reads as a verdict nobody wrote.
 */
function Review({
  review,
  skill,
}: {
  review: RoleplayReview;
  skill: PracticeScoreView;
}) {
  return (
    <View className="mt-6 border-t border-border pt-5">
      <Text
        accessibilityRole="header"
        className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground"
      >
        The review
      </Text>

      <SkillScore skill={skill} />

      {review.summary ? (
        <Text className="mt-2 font-body text-base leading-relaxed text-foreground">
          {review.summary}
        </Text>
      ) : null}

      {review.whatWorked.length > 0 ? (
        <>
          <Text className="mt-5 font-strong text-base text-foreground">
            What worked
          </Text>
          <View className="mt-1 gap-1">
            {review.whatWorked.map((w) => (
              <Text
                key={w}
                className="font-body text-base leading-relaxed text-muted-foreground"
              >
                {w}
              </Text>
            ))}
          </View>
        </>
      ) : null}

      {review.toImprove.length > 0 ? (
        <>
          <Text className="mt-5 font-strong text-base text-foreground">
            Worth trying next
          </Text>
          <View className="mt-1 gap-1">
            {review.toImprove.map((w) => (
              <Text
                key={w}
                className="font-body text-base leading-relaxed text-muted-foreground"
              >
                {w}
              </Text>
            ))}
          </View>
        </>
      ) : null}

      {review.correctLine ? (
        <View className="mt-5 rounded-md border border-primary px-3 py-3">
          <Text className="font-emphasis text-xs uppercase tracking-widest text-primary">
            One line to try
          </Text>
          <Text className="mt-2 font-body text-base leading-relaxed text-foreground">
            {review.correctLine.line}
          </Text>
          <Text className="mt-2 font-body text-sm leading-relaxed text-muted-foreground">
            {review.correctLine.why}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/**
 * The score for the skill the rep set out to practise.
 *
 * FIRST IN THE REVIEW, above the general summary, because it is the reason this
 * run happened. A rep who chose "objection handling" came for that answer; the
 * broader read is context around it, not the headline.
 *
 * STACKED, NEVER A ROW. A skill name beside a number in a justified row is the
 * shape that pushed figures off the screen at large text sizes elsewhere in this
 * app — the name grows, the number leaves. Nothing here shares a line with
 * anything that can grow.
 */
function SkillScore({ skill }: { skill: PracticeScoreView }) {
  if (skill.kind === "none") return null;

  return (
    <View className="mt-3 rounded-md border border-primary px-3 py-3">
      <Text className="font-emphasis text-xs uppercase tracking-widest text-primary">
        {SCORE_HEADING}
      </Text>
      <Text className="mt-2 font-emphasis text-base leading-relaxed text-foreground">
        {skill.focus}
      </Text>

      {skill.kind === "scored" ? (
        <Text
          className="mt-1 font-display text-3xl text-foreground"
          // Spoken as a sentence: a screen reader announcing "74 Solid" gives a
          // number with no unit and a word with no subject.
          accessibilityLabel={`${skill.score} out of 100 on ${skill.focus}. ${skill.band}.`}
        >
          {skill.score}
          <Text className="font-body text-base text-muted-foreground">{`  ${skill.band}`}</Text>
        </Text>
      ) : (
        <Text className="mt-2 font-body text-base leading-relaxed text-muted-foreground">
          {NOT_ATTEMPTED_BODY}
        </Text>
      )}

      {skill.nextRep ? (
        <>
          <Text className="mt-4 font-emphasis text-xs uppercase tracking-widest text-muted-foreground">
            {NEXT_REP_HEADING}
          </Text>
          <Text className="mt-1 font-body text-base leading-relaxed text-foreground">
            {skill.nextRep}
          </Text>
        </>
      ) : null}
    </View>
  );
}
