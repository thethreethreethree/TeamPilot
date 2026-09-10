/**
 * How a call ended.
 *
 * A row of buttons rather than a dropdown: five options fit on a phone, and a
 * dropdown costs two taps and hides the choices until you commit to opening it.
 * Selection is carried by border weight AND by the accessible selected state,
 * never by colour alone — a rep checking their numbers in bright sun should be
 * able to see which one is set.
 *
 * THE LABELS ARE FACTUAL AND THAT IS DELIBERATE. They are the server's own
 * values, and A11 governs the wording: "No sale" is a fact; "Missed" or "Lost"
 * would be a judgement the app is not entitled to make about someone's
 * afternoon. A rep who feels graded by a picker stops using it honestly, and a
 * dishonestly-filled outcome poisons every number downstream.
 *
 * Shared by the recordings screen (before a call is sent) and the session screen
 * (after), because it is the same question and must not drift into two
 * differently-worded versions of itself.
 */
import { Pressable, Text, View } from 'react-native';

import { OUTCOMES, OUTCOME_LABEL } from '@/lib/format';
import type { SessionOutcome } from '@/types/backend';

export function OutcomePicker({
  value,
  onChange,
  disabled = false,
  label = 'How did it end?',
  hint,
}: {
  value: SessionOutcome | null;
  onChange: (next: SessionOutcome) => void;
  disabled?: boolean;
  label?: string;
  hint?: string;
}) {
  return (
    <View className="mt-4">
      <Text className="font-emphasis text-sm text-muted-foreground">{label}</Text>
      {hint ? <Text className="mt-1 font-body text-xs text-muted-foreground">{hint}</Text> : null}
      <View className="mt-2 flex-row flex-wrap gap-2">
        {OUTCOMES.map((outcome) => {
          const selected = value === outcome;
          return (
            <Pressable
              key={outcome}
              onPress={() => onChange(outcome)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={OUTCOME_LABEL[outcome]}
              className={`min-h-7 justify-center rounded-md border px-4 py-3 active:opacity-70 ${
                selected ? 'border-primary bg-raised' : 'border-border-control'
              } ${disabled ? 'opacity-50' : ''}`}
            >
              <Text
                className={`text-base ${
                  selected ? 'font-strong text-foreground' : 'font-body text-muted-foreground'
                }`}
              >
                {OUTCOME_LABEL[outcome]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
