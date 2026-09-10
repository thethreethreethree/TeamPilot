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

export function SpeakerPicker({
  speakers,
  onPick,
  busySpeakerId,
  disabled = false,
}: {
  speakers: PendingSpeaker[];
  onPick: (speakerId: string) => void;
  /** The one being submitted, if any. */
  busySpeakerId?: string | null;
  disabled?: boolean;
}) {
  return (
    <View className="mt-4">
      <Text accessibilityRole="header" className="font-strong text-base text-foreground">
        Which voice is you?
      </Text>
      <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
        Two people spoke on this call. Until you say which is you, the transcript
        cannot tell you apart — and neither can the coach.
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
                {busy ? 'Saving' : `Voice ${index + 1}`}
              </Text>
              <Text className="mt-1 font-body text-base leading-relaxed text-foreground">
                {sample
                  ? `“${sample}”`
                  : 'This voice has no readable line — pick the other one if it sounds like you.'}
              </Text>
              <Text className="mt-2 font-strong text-base text-primary">This is me</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
