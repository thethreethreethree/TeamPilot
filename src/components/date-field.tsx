/**
 * A labelled date field with an inline month calendar.
 *
 * WHY IT IS NOT `@react-native-community/datetimepicker`. That is a native
 * module: a new pod, a new config plugin, and a rebuild of a binary that a native
 * plugin has already broken once on this project. Two date inputs on a KPI screen
 * are not worth spending a build failure on. What the platform widget buys is its
 * look; what it costs here is a build, and the look is reachable through the
 * app's own tokens.
 *
 * THE ARITHMETIC IS NOT HERE. Leap Februaries, months that start on a Sunday,
 * and the UTC-noon anchor that stops a negative-offset phone rendering 31 August
 * as September's first cell all live in `lib/doors/calendar.ts`, where a test can
 * ask for them. This file draws what that returns.
 *
 * A PLACEHOLDER IS NOT A LABEL, so the field carries a visible label, and the
 * control announces both the label and the chosen day rather than "button".
 *
 * EVERY DAY CELL IS A REAL TARGET. 44pt minimum, and the blanks that pad the
 * grid are not pressable at all — a rep who taps a dimmed "1" in a trailing row
 * and lands in the next month has moved their window without meaning to, and on
 * a from/to pair that mistake is invisible afterwards.
 */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  WEEKDAYS,
  dayLabel,
  dayNumber,
  daySpoken,
  monthGrid,
  monthLabel,
  monthOf,
  shiftMonth,
} from '@/lib/doors/calendar';

export function DateField({
  label,
  value,
  today,
  onChange,
}: {
  /** The visible label, e.g. "From". Also what the control announces. */
  label: string;
  /** The chosen day as `YYYY-MM-DD`, or null while nothing is chosen. */
  value: string | null;
  /** The device's local day, used to open the calendar somewhere useful. */
  today: string;
  onChange: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // The month on screen starts at the chosen day, else this month. Held in state
  // so paging back does not fight the value the rep already picked.
  const start = monthOf(value) ?? monthOf(today) ?? { year: 2026, month: 1 };
  const [cursor, setCursor] = useState(start);

  const chosen = value ? dayLabel(value) : null;

  return (
    <View className="mt-4">
      <Text className="font-strong text-sm text-foreground">{label}</Text>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        // NOT "expand". The name says what the control is FOR, and the state says
        // whether the calendar is showing.
        accessibilityLabel={`${label} date${chosen ? `, ${chosen}` : ', not chosen yet'}`}
        accessibilityState={{ expanded: open }}
        className="mt-1 min-h-11 justify-center rounded-lg border border-border-control bg-surface px-3 active:opacity-70"
      >
        <Text
          className={`font-body text-base ${chosen ? 'text-foreground' : 'text-muted-foreground'}`}
        >
          {chosen ?? 'Choose a date'}
        </Text>
      </Pressable>

      {open ? (
        <View className="mt-2 rounded-lg border border-border-control px-2 py-2">
          <View className="flex-row items-center justify-between">
            <MonthStep
              label="Previous month"
              glyph="‹"
              onPress={() => setCursor((c) => shiftMonth(c.year, c.month, -1))}
            />
            <Text
              accessibilityRole="header"
              className="font-emphasis text-base text-foreground"
              // Announced by the stepper buttons' own labels as well; read here
              // so a rep who lands on the header knows which month they are in.
            >
              {monthLabel(cursor.year, cursor.month)}
            </Text>
            <MonthStep
              label="Next month"
              glyph="›"
              onPress={() => setCursor((c) => shiftMonth(c.year, c.month, 1))}
            />
          </View>

          {/* The weekday headings are decoration for assistive tech: each day
              cell already announces its own weekday. */}
          <View
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
            className="mt-2 flex-row"
          >
            {WEEKDAYS.map((w) => (
              <Text
                key={w}
                className="flex-1 text-center font-emphasis text-xs text-muted-foreground"
              >
                {w}
              </Text>
            ))}
          </View>

          {monthGrid(cursor.year, cursor.month).map((week, i) => (
            <View key={`w${i}`} className="mt-1 flex-row">
              {week.map((iso, j) =>
                iso === null ? (
                  <View key={`b${j}`} className="min-h-11 flex-1" />
                ) : (
                  <Pressable
                    key={iso}
                    onPress={() => {
                      onChange(iso);
                      setOpen(false);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel={daySpoken(iso)}
                    accessibilityState={{ selected: iso === value }}
                    className={`min-h-11 flex-1 items-center justify-center rounded-md active:opacity-70 ${
                      iso === value ? 'bg-primary' : ''
                    }`}
                  >
                    <Text
                      className={`font-body text-base tabular-nums ${
                        iso === value ? 'text-primary-foreground' : 'text-foreground'
                      }`}
                    >
                      {dayNumber(iso)}
                    </Text>
                  </Pressable>
                ),
              )}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * One month step.
 *
 * The glyph is decorative and hidden: the control's NAME is "Previous month",
 * which is what a screen reader should say. An unlabelled chevron is the exact
 * thing the design law bans as navigation.
 */
function MonthStep({
  label,
  glyph,
  onPress,
}: {
  label: string;
  glyph: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className="min-h-11 min-w-11 items-center justify-center rounded-md active:opacity-70"
    >
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no"
        className="font-heading text-2xl text-primary"
      >
        {glyph}
      </Text>
    </Pressable>
  );
}
