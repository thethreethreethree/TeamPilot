/**
 * The sentence under the Macro Mode switch. Founder REV 1 (applied in the app 2026-09-11, ON = short form
 * confirmed in a picker), brought to the website on 2026-10-01 when the founder chose the REV 1 wording here
 * too. The website showed "Door-to-door: fast Door Log + a macro Report Card. Feedback processes in the
 * background." in both positions until then.
 *
 * MIRRORS THE APP'S `src/lib/doors/macro-mode-copy.ts` WORD FOR WORD (Elostate-Sales-coach). The two products
 * share a rep, so they must say the same thing; `macroModeCopy.test.ts` pins the exact strings, and the app's
 * own test pins its copy, so a change to one without the other fails a test on the side that changed.
 */

/** Macro Mode ON — the door-to-door surfaces. */
export const MACRO_ON_BODY = "This mode is for short form sales, under 15 minutes. Fiber internet, Pest Control.";

/** Macro Mode OFF — the standard coach. */
export const MACRO_OFF_BODY = "Long form sales, over 20 minutes, ex: Solar Sales.";

/** Takes the position rather than reading it, so the wording is a pure rule a test can hold. */
export function macroModeBody(enabled: boolean): string {
  return enabled ? MACRO_ON_BODY : MACRO_OFF_BODY;
}
