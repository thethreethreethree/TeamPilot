/**
 * "Which voice is you?"
 *
 * The server can hear that two people spoke; it cannot know which one is the
 * rep. Until it is told, every line in the transcript reads as unattributed —
 * the session screen shows a wall of speech with no sides, and the coach reasons
 * about a conversation it cannot tell apart.
 *
 * IT SHOWS WHAT EACH VOICE SAID. A rep cannot answer "is it Speaker A or
 * Speaker B" — that is the machine's question, not theirs. They CAN answer it
 * instantly on hearing their own opening line. So each option leads with a real
 * sentence from the call and treats the speaker id as bookkeeping.
 *
 * THERE IS NO DEFAULT AND NO GUESS. Picking the first speaker as "probably the
 * rep" would be right about half the time and wrong invisibly — every line
 * attributed backwards, the coach told the customer's objections were the rep's.
 * A wrong attribution is worse than none, because none is visible.
 */
import { Pressable, Text, View } from 'react-native';

import type { PendingSpeaker } from '@/lib/audio/attribution-store';

/**
 * The answer meaning "the only voice on this call was NOT mine".
 *
 * It is deliberately a value no diarizer will ever produce. `label-transcript`
 * labels a segment 'agent' when its speaker id matches the one sent and
 * 'customer' otherwise - so sending an id that matches nothing marks the whole
 * call as the customer speaking, which is exactly what one-sided capture means.
 * No server change was needed for that; the route already had the behaviour.
 */
export const NOT_THE_REP = '__not-the-rep__';

/**
 * THE ANSWER IS ONCE ONLY, AND NOTHING SAID SO.
 *
 * This component was already careful in every other way - no default, no guess, each option
 * leading with a real line from the call, and a comment stating that a wrong attribution is worse
 * than none. What it never said is that there is no second go.
 *
 * `label-transcript` writes an APPEND-ONLY canonical transcript. Once it holds agent turns it is
 * never clobbered: a second attempt is refused with 409 and the words
 * "This session already has a transcript - start a new session to log a different call", which is
 * useless advice about a call that has already happened.
 *
 * SO A WRONG TAP IS PERMANENT AND SILENT. Every line is attributed backwards, the coach reads the
 * customer's objections as the rep's, and talk ratio, questions and listening are all measured on
 * the wrong person - on a transcript that looks completely normal. Nothing in the app would ever
 * show them it was the tap that did it.
 *
 * WHY IT IS ONE PLAIN SENTENCE AND NOT A CONFIRMATION STEP. The rep can answer correctly in a
 * second by reading the quoted line, and an "are you sure?" on top of a question they can already
 * see the answer to teaches them to dismiss the next one. What they need is a reason to READ the
 * line rather than tap the first option - which is what naming the permanence does.
 *
 * A CORRECTION, 11 September. This was first written to skip the one-voice case, on the reasoning
 * that its "not me" answer writes zero agent turns and so could be replaced by a later recovery.
 * That reasoning came from `/label-transcript`, and the one-voice answer does not go there. It goes
 * to `/attribute-unlabelled`, which stamps the rows `source: "manual"` and then refuses any
 * transcript already carrying that - three separate 409s. BOTH one-voice answers are final, and the
 * skip left the more damaging of the two unwarned.
 *
 * It stopped being hypothetical the same day. A recovered call of the founder's came back with 317
 * segments and 6,861 words - a real two-person conversation - and every row labelled `unknown`,
 * because the diarizer never separated the voices. That is presented as the one-voice question. So
 * the tap is offered on a call where BOTH answers are wrong and the wrong one sticks.
 */
export const ATTRIBUTION_IS_FINAL =
  'Read the line before you tap - this is a one-time answer. It cannot be changed afterwards, and '
  + 'picking the wrong voice labels the whole call backwards.';

/**
 * The same fact for a one-voice call, where the risk has a different shape.
 *
 * Not the sentence above. There is no "wrong voice" to pick here and no second option to compare
 * against - the danger is that the answer applies to EVERY line at once. On a call the system could
 * not split, that can mean a whole conversation filed as one person talking.
 */
export const SOLO_ATTRIBUTION_IS_FINAL =
  'This is a one-time answer and cannot be changed afterwards. It applies to every line in the '
  + 'call, so listen back first if you are not sure.';

export function SpeakerPicker({
  speakers,
  onPick,
  busySpeakerId,
  disabled = false,
}: {
  speakers: PendingSpeaker[];
  /** The chosen voice, or NOT_THE_REP when the only voice was the customer's. */
  onPick: (speakerId: string) => void;
  /** The one being submitted, if any. */
  busySpeakerId?: string | null;
  disabled?: boolean;
}) {
  // One voice asks a different question, and gets an extra answer below.
  const solo = speakers.length === 1;

  return (
    <View className="mt-4">
      <Text accessibilityRole="header" className="font-strong text-base text-foreground">
        {solo ? 'Is this your voice?' : 'Which voice is you?'}
      </Text>
      <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
        {solo
          ? // ONE VOICE IS STILL A QUESTION. The app cannot tell whether it
            // caught the rep or only the customer, and answering either way is
            // what saves the transcript at all.
            'Only one voice came through on this call. Say whose it is and the transcript is saved either way — without an answer there is nothing for the coach to read.'
          : 'Two people spoke on this call. Until you say which is you, the transcript cannot tell you apart — and neither can the coach.'}
      </Text>

      {/* Both answers are final, on both paths — see the correction in ATTRIBUTION_IS_FINAL. */}
      <Text className="mt-2 font-emphasis text-sm leading-relaxed text-foreground">
        {solo ? SOLO_ATTRIBUTION_IS_FINAL : ATTRIBUTION_IS_FINAL}
      </Text>

      <View className="mt-3 gap-2">
        {speakers.map((speaker, index) => {
          const busy = busySpeakerId === speaker.speakerId;
          const sample = speaker.sample?.trim();
          return (
            <Pressable
              key={speaker.speakerId}
              onPress={() => onPick(speaker.speakerId)}
              disabled={disabled || Boolean(busySpeakerId)}
              accessibilityRole="button"
              accessibilityState={{ disabled: disabled || Boolean(busySpeakerId), busy }}
              // The spoken label leads with the words, exactly as the visible one
              // does — a screen-reader user is answering the same question.
              accessibilityLabel={
                sample
                  ? `This is me. They said: ${sample}`
                  : `This is me. Voice ${index + 1}, which said nothing readable.`
              }
              className={`min-h-7 justify-center rounded-md border px-4 py-3 active:opacity-70 ${
                busy ? 'border-primary bg-raised' : 'border-border-control'
              } ${disabled ? 'opacity-50' : ''}`}
            >
              <Text className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground">
                {busy ? 'Saving' : solo ? 'The only voice' : `Voice ${index + 1}`}
              </Text>
              <Text className="mt-1 font-body text-base leading-relaxed text-foreground">
                {sample
                  ? `“${sample}”`
                  : solo
                    ? 'This voice has no readable line.'
                    : 'This voice has no readable line — pick the other one if it sounds like you.'}
              </Text>
              <Text className="mt-2 font-strong text-base text-primary">
                {solo ? 'That is me' : 'This is me'}
              </Text>
            </Pressable>
          );
        })}

        {/*
          THE SECOND ANSWER, and the reason this whole screen now appears for a
          solo recording at all. One voice does not mean it is the rep's: a call
          where only the prospect was picked up is exactly what doc 08's
          one-sided status is for. Both answers save the transcript, which is the
          point - without one, nothing is written and the coach has nothing to
          read.
        */}
        {solo ? (
          <Pressable
            onPress={() => onPick(NOT_THE_REP)}
            disabled={disabled || Boolean(busySpeakerId)}
            accessibilityRole="button"
            accessibilityState={{ disabled: disabled || Boolean(busySpeakerId) }}
            accessibilityLabel="That is not me, it is the customer. The transcript is saved as the customer speaking."
            className={`min-h-7 justify-center rounded-md border border-border-control px-4 py-3 active:opacity-70 ${
              disabled ? 'opacity-50' : ''
            }`}
          >
            <Text className="font-emphasis text-xs uppercase tracking-widest text-muted-foreground">
              Not me
            </Text>
            <Text className="mt-1 font-body text-base leading-relaxed text-foreground">
              Only the customer came through. Your side was not picked up.
            </Text>
            <Text className="mt-2 font-strong text-base text-primary">That is the customer</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
