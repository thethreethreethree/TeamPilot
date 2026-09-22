/**
 * Day · Week · Month · All time — the toggle both Pitch Score boards share.
 *
 * ONE SELECTION ACROSS BOTH BOARDS, which the guide states plainly: *"The period selection carries
 * across Progress and Breakdown."* They are two views of one period, so the state belongs to
 * whatever holds them both, and this component is controlled rather than stateful.
 *
 * THE LABELS AND THE WIRE VALUES ARE NOT THE SAME STRINGS, and that is the whole reason
 * `PERIOD_LABELS` exists rather than a `.toUpperCase()` in here. "All time" travels as `all`. This
 * app already exports a different period vocabulary from `lib/doors/metrics-view.ts` whose fourth
 * key is `all_time`, and the breakdown route does not reject an unknown value — it silently returns
 * this week. A label-derived key would caption seven days of work "All time" with nothing on screen
 * wrong.
 */
import { Pressable, Text, View } from 'react-native';

import { PERIODS, PERIOD_LABELS, type Period } from '@/lib/pitch-score/period';

export function PitchPeriodToggle({
  period,
  onChange,
  disabled = false,
}: {
  period: Period;
  onChange: (next: Period) => void;
  /** While a read is in flight. The current selection stays legible; the others stop responding. */
  disabled?: boolean;
}) {
  return (
    <View
      accessibilityRole="tablist"
      className="mt-4 flex-row rounded-lg border border-border-control p-1"
    >
      {PERIODS.map((p) => {
        const active = p === period;
        return (
          <Pressable
            key={p}
            onPress={() => onChange(p)}
            disabled={disabled || active}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled }}
            // The whole segment is the target, and four of them still clear the 48dp floor on a
            // narrow phone because the row divides the width rather than sizing to the text.
            className={`min-h-7 flex-1 items-center justify-center rounded-md px-2 ${
              active ? 'bg-primary' : 'active:opacity-70'
            } ${disabled && !active ? 'opacity-50' : ''}`}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              className={`font-emphasis text-sm ${
                active ? 'text-primary-foreground' : 'text-muted-foreground'
              }`}
            >
              {PERIOD_LABELS[p]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
