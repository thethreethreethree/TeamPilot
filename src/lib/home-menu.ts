/**
 * What the menu at the top of Home offers.
 *
 * PURE, AND SEPARATE FROM THE SCREEN, for one reason: Account is the only route
 * to SIGN OUT, and sign-out is this app's security boundary on a shared phone —
 * it is what stops one rep's calls, transcripts and figures reaching the next
 * person to hold it.
 *
 * That invariant has already been broken once. Account used to be hidden in
 * Macro Mode to mirror the website's four tabs; on the website the sidebar
 * still reaches Settings, but on a phone it meant a door rep could not sign out
 * at all. It was fixed by putting Account in both tab sets, and now it has left
 * the tab bar again — because five tabs truncated the labels on a real device.
 *
 * Twice in two weeks, the same destination has moved for good reasons. So the
 * rule stops being prose and becomes a test: whatever else this list holds, and
 * in whichever mode, it holds Account. A screen cannot be unit-tested here (it
 * needs the native runtime); a list of items can.
 */

export type HomeMenuItemKey = 'account' | 'report-problem';

export type HomeMenuItem = {
  key: HomeMenuItemKey;
  /** The word a person reads and a screen reader announces. Never an icon alone. */
  label: string;
  /** One line saying what it is for, so the label never carries it alone. */
  hint: string;
  /** Where it goes. A string, so this module stays free of the router. */
  route: string;
};

/**
 * `macro` is taken even though it changes nothing today.
 *
 * It is here deliberately: the last two times this list changed, it changed
 * PER MODE, and both times that is what broke it. A caller must pass the mode,
 * which makes "does Account survive in Macro Mode?" a question the tests can
 * ask directly rather than one somebody has to remember to think about.
 */
export function homeMenuItems(macro: boolean): HomeMenuItem[] {
  void macro;
  return [
    {
      key: 'account',
      label: 'Account',
      hint: 'Your details, how the coach talks to you, and signing out',
      route: '/(app)/(tabs)/account',
    },
    /**
     * WHY REPORTING A PROBLEM IS IN THE MENU AND NOT A TAB.
     *
     * It is the one destination whose value is that it is FINDABLE WHEN THE APP
     * IS MISBEHAVING, and it is also something a rep should open roughly never.
     * A tab spends one of four slots on it and pushes something a rep opens
     * daily out of the bar; a menu row next to Account is where a person already
     * looks for "the app itself" rather than "my selling".
     *
     * It is in BOTH modes, deliberately. A door rep hits the same bugs a
     * standard rep does, and the whole point of this screen is that the person
     * who watched the failure is the one who can describe it.
     */
    {
      key: 'report-problem',
      label: 'Report a problem',
      hint: 'See what the app recorded going wrong, and send it',
      route: '/(app)/report-problem',
    },
  ];
}
