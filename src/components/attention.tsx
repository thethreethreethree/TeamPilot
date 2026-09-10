/**
 * The things that need the rep, in the order they need them.
 *
 * THE PROBLEM THIS SOLVES, and it is a design failure rather than a bug. The
 * sessions screen grew a banner each time the app learned to notice something:
 * recordings still on the phone, changes not yet sent, calls with no voice
 * picked, calls with no outcome. Each was written carefully and each was right on
 * its own. Stacked, they were four bordered rectangles of identical weight, with
 * identical type, above the list a rep opened the app to read.
 *
 * The design law says why that fails, in one line: *distinctiveness is
 * relational — five emphasised elements means none are*. A rep between doors,
 * glancing at a phone for three seconds, does not triage four boxes. They scroll
 * past all four.
 *
 * WHAT THIS DOES INSTEAD. The most urgent thing is stated in full, at full
 * weight, exactly as it was. Everything else becomes one compact line each,
 * still visible, still tappable, still saying what it is and how many — just no
 * longer competing with the thing that matters most.
 *
 * NOTHING IS HIDDEN. There is no "show more" and no collapsed state. A disclosure
 * a rep has to find is how you lose the recording that never sent, and this
 * module exists to make things findable rather than tidy. What changes is the
 * WEIGHT, not the presence.
 *
 * THE ORDER IS AN ARGUMENT, not an accident, and the caller states it. Each
 * screen knows what its own most-urgent thing is; this component only knows that
 * the first one is it.
 */
import { Pressable, Text, View } from 'react-native';

import { useLargeText } from '@/lib/use-large-text';

export type AttentionItem = {
  /** Stable key for the list. */
  key: string;
  /** The headline, already pluralised by the caller — it knows the count. */
  title: string;
  /** The full explanation. Shown for the lead item only. */
  body: string;
  /** One short clause for the compact form, when this is not the lead item. */
  short: string;
  /** What a screen reader says. The whole row is one control, one sentence. */
  spoken: string;
  onPress: () => void;
  /**
   * `urgent` marks the one kind of item where doing nothing costs something that
   * cannot be recovered — a transcript nobody can read, a recording only this
   * phone holds. It is the brand accent, and it is spent on almost nothing else,
   * which is what keeps it meaning anything.
   */
  tone?: 'urgent' | 'plain';
};

export function Attention({ items }: { items: AttentionItem[] }) {
  const stacked = useLargeText();
  if (items.length === 0) return null;
  const [lead, ...rest] = items;

  return (
    <View className="mt-4">
      <Pressable
        onPress={lead.onPress}
        accessibilityRole="button"
        accessibilityLabel={lead.spoken}
        className={`min-h-7 justify-center rounded-md border px-3 py-3 active:bg-surface ${
          lead.tone === 'urgent' ? 'border-primary' : 'border-border-control'
        }`}
      >
        <Text className="font-strong text-base text-foreground">{lead.title}</Text>
        <Text className="mt-1 font-body text-sm leading-relaxed text-muted-foreground">
          {lead.body}
        </Text>
      </Pressable>

      {/* The rest: present, reachable, and quiet. One line each, sharing a single
          border with the lead above rather than each drawing its own box — four
          boxes is the thing this component exists to stop. */}
      {rest.length > 0 ? (
        <View className="mt-1 rounded-md border border-border px-3">
          {rest.map((item, i) => (
            <Pressable
              key={item.key}
              onPress={item.onPress}
              accessibilityRole="button"
              accessibilityLabel={item.spoken}
              // "Open" sits beside the text until the reader's text size makes
              // that a squeeze; then it goes underneath, still a word rather
              // than a glyph.
              className={`min-h-7 gap-3 py-3 active:bg-surface ${
                stacked ? '' : 'flex-row items-center justify-between'
              } ${i > 0 ? 'border-t border-border' : ''}`}
            >
              <Text
                // Two lines at the default size keeps the row compact; at large
                // text a cap would clip the only sentence explaining what needs
                // doing, so it is lifted.
                numberOfLines={stacked ? undefined : 2}
                className="flex-1 font-body text-sm text-muted-foreground"
              >
                {item.short}
              </Text>
              {/* A word, not a chevron. An unlabelled glyph is the hidden
                  affordance the design law bans, and "Open" survives being read
                  aloud where an arrow does not. */}
              <Text className="font-emphasis text-sm text-primary">Open</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
