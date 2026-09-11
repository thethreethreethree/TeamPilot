/**
 * What the Macro Mode switch says about itself, in each position.
 *
 * IT USED TO SAY ONE THING IN BOTH. The single line was "Door-to-door: fast Door Log and a macro
 * Report Card, with the door surfaces in the tab bar" - a description of what the app DOES when the
 * switch is on, which told a rep nothing about whether it is the right switch for the way they sell.
 * A rep selling solar and a rep selling pest control need opposite answers, and the old sentence was
 * addressed to neither of them.
 *
 * The founder's wording, REV 1 (2026-09-11), is kept close to verbatim because it is the sales
 * vocabulary their reps already use - "short form" and "long form" are theirs, not mine, and the
 * named industries are what makes the distinction land in one read.
 *
 * ── ONE AMBIGUITY, AND WHICH WAY I READ IT ──────────────────────────────────────────────────────
 *
 * The instruction says both "when it is toggled on ... change the explanation to [short form]" and
 * "then when it's ON write [long form]". Those cannot both be true, so one of the two says ON where
 * it means OFF.
 *
 * I took ON = SHORT form, for a reason from the product rather than from the sentence: Macro Mode is
 * what turns on the Door Log, the door counts and the door tab bar. Door knocking IS the short-form
 * motion, and fiber internet and pest control - the two industries named for it - are door-knocking
 * industries. Solar, named for the other position, is the long in-home appointment. Reading it the
 * other way would put the door-to-door explanation on the setting that hides the door surfaces.
 *
 * If that is backwards, the fix is to swap the two strings below and the test that names them, and
 * nothing else in the app moves.
 */

/** Macro Mode ON — the door-to-door surfaces. */
export const MACRO_ON_BODY =
  'This mode is for short form sales, under 15 minutes. Fiber internet, Pest Control.';

/** Macro Mode OFF — the standard coach. */
export const MACRO_OFF_BODY = 'Long form sales, over 20 minutes, ex: Solar Sales.';

/**
 * The sentence under the switch.
 *
 * Takes the position rather than reading it, so the choice of words is a pure rule a test can hold
 * and the component keeps no copy of its own.
 */
export function macroModeBody(enabled: boolean): string {
  return enabled ? MACRO_ON_BODY : MACRO_OFF_BODY;
}

/**
 * The extra sentence when the phone has the setting and the server does not yet.
 *
 * SEPARATE FROM THE DESCRIPTION, because it is about the SAVE and not about the mode. Appending it
 * to whichever sentence happens to be showing - which is what the old code did - made a fact about
 * syncing read as part of the explanation of what the mode is for.
 */
export const MACRO_UNSYNCED =
  'Saved on this phone — it has not reached the server, so the website still shows the old setting.';
