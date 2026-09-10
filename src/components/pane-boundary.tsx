/**
 * A failure surface for ONE pane of the pager.
 *
 * WHY IT EXISTS, and it is a regression I introduced. Before Today's Metrics
 * became two swipeable pages, the Arena and the door figures were separate
 * screens: a crash in one replaced only that one, and a door rep's field
 * numbers were untouched by anything going wrong in the gauge.
 *
 * Putting both pages in one tab screen quietly undid that. The nearest boundary
 * is now the tab shell, so a throw anywhere inside the Arena replaces the WHOLE
 * tab — and a rep standing at a door loses their doors, conversations and sales
 * because a milestone badge could not render. That is a worse trade than the one
 * the pager was built to make.
 *
 * So each pane gets its own boundary. A failing page shows a short message in
 * its own half of the track, the toggle keeps working, and the other page is
 * untouched.
 *
 * IT HAS TO BE A CLASS. React only calls `getDerivedStateFromError` and
 * `componentDidCatch` on class components; there is no hook equivalent. This is
 * the one place in the app where that is the right tool rather than a hangover.
 *
 * IT IS NOT THE APP-WIDE BOUNDARY. `components/error-boundary.tsx` is the
 * expo-router surface for a whole screen and takes the router's own props. This
 * is deliberately smaller and quieter: a pane failing is not the app failing,
 * and it should not look like it is.
 */

import { Component, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';

import { reportCaughtError } from '@/lib/crash-init';

type Props = {
  /** Named in the report, so a crash says WHICH pane rather than "the pager". */
  name: string;
  /** What the rep was looking at, in their words — "your progress". */
  subject: string;
  children: ReactNode;
};

type State = { failed: boolean };

export class PaneBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Reported, not just rendered. A boundary that shows a message and tells
    // nobody means the rep knows something broke and we never do.
    reportCaughtError(error, `pane:${this.props.name}`);
  }

  /**
   * Try again by remounting the pane's subtree.
   *
   * Not a reload: the other page keeps its state, its scroll position and
   * anything it had already fetched. A rep who was reading their door figures
   * should not lose them because they tapped "Try again" on the other page.
   */
  private retry = () => this.setState({ failed: false });

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <View className="flex-1 justify-center gap-3 px-5" accessibilityRole="alert">
        <Text accessibilityRole="header" className="font-heading text-xl text-foreground">
          {this.props.subject} could not be shown
        </Text>
        <Text className="font-body text-base leading-relaxed text-muted-foreground">
          {/* NAMED BY ROLE, NOT BY POSITION.
              This said "the toggle above", which is invisible to a screen reader
              and wrong the moment the layout reflows. My first correction said
              "the tabs at the top of this screen" — which is the same mistake
              with more words, and is written down here because I made it while
              fixing it. "The tabs" is what the control announces itself as, so
              the sentence works whether or not you can see the screen. The swipe
              comes second: it is the enhancement, not the primary control. */}
          Something went wrong on this page. Nothing you recorded is affected, and the other page still works —
          use the tabs, or swipe across.
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Try showing ${this.props.subject} again`}
          onPress={this.retry}
          className="min-h-7 justify-center self-start rounded-lg border border-primary px-4 active:opacity-70"
        >
          <Text className="font-emphasis text-base text-primary">Try again</Text>
        </Pressable>
      </View>
    );
  }
}
