/**
 * Is the reader using large text?
 *
 * WHY THIS EXISTS. The design law requires this app to honour Dynamic Type, and
 * up to now nothing in it did — every layout was written at the default text
 * size and assumed. That assumption breaks in one specific, predictable way: a
 * row with a LABEL beside a VALUE. At the default size "Deal value  £4,500"
 * reads fine. At an accessibility text size the label needs the whole width on
 * its own, so the two columns squeeze each other into a stack of one-and-two-word
 * fragments — the exact layout failure that is invisible until someone who needs
 * large text opens the app, which is to say invisible to everyone who built it.
 *
 * A rep working outdoors in the sun, or one who simply cannot read 14pt, is not
 * an edge case in a field-sales tool. They are a normal user having a bad time.
 *
 * WHAT IT DOES. Reports when the reader's text scale has passed the point where
 * side-by-side text stops working, so a layout can stack instead. It is a layout
 * decision, never a content one: nothing is hidden, shortened or dropped at large
 * sizes — the same words are simply arranged down the screen rather than across.
 *
 * WHERE THE THRESHOLD CAME FROM. iOS ships seven standard sizes and five larger
 * accessibility sizes; the accessibility range begins at roughly 1.35× the
 * default. Android's font-size slider tops out around 1.3× before its own
 * accessibility scaling. 1.3 is therefore the point at which BOTH platforms have
 * left the range a two-column row was designed for, and it is measured in the
 * same units the OS reports rather than converted through a guess.
 *
 * IT IS SUBSCRIBED, NOT READ ONCE. `useWindowDimensions` re-renders when the
 * scale changes, so a rep who turns text up in Settings and comes back finds the
 * layout already right. A value cached at launch would be stale exactly when
 * someone has just told the phone they need it larger.
 */
import { useWindowDimensions } from 'react-native';

/** Past this, a label-beside-value row has stopped fitting on both platforms. */
export const LARGE_TEXT_SCALE = 1.3;

export function useLargeText(): boolean {
  const { fontScale } = useWindowDimensions();
  // A missing or nonsensical scale reads as normal. Stacking a layout because a
  // platform returned undefined would make the app worse for everyone else.
  return Number.isFinite(fontScale) && fontScale >= LARGE_TEXT_SCALE;
}
