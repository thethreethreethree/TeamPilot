/**
 * theme.ts — the typed bridge over src/lib/tokens.js.
 *
 * Anything styled with a NativeWind className already has the tokens. This exists
 * for the OTHER case: an imperative colour handed to a native API that takes no
 * class — a StatusBar style, an ActivityIndicator colour, a navigator theme, a
 * RefreshControl tint. Those need a real string at call time.
 *
 * The rule from the design law still holds: a raw colour literal belongs in the
 * token definition file and nowhere else. Import from here; never type a colour
 * into a screen.
 *
 * There is no useColors() hook and no scheme switch: the app is locked to dark
 * (app.json userInterfaceStyle: "dark"), so the palette is a constant.
 */
import { colors, space, fontSize, radius, fontFamily } from "./tokens";

export type ColorToken = keyof typeof colors;

export const C = colors as Record<ColorToken, string>;
export { space, fontSize, radius, fontFamily };

/**
 * Minimum touch target, in dp.
 *
 * 48, NOT 44, and the four extra pixels are the whole point. The design law is "44pt (iOS) /
 * 48dp (Android)", and a single number serving both platforms has to be the larger one - 44
 * satisfies iOS and leaves every Android control four short. This constant said 44 while 141
 * controls in the app used the 48 token and the tab bar's own comment called 48 "the same floor
 * as everything else", so it was the one place still quoting the smaller number.
 *
 * Nothing rendered differently for this change: its only user is the door dial, which is 132dp
 * square and was never near either floor. It is corrected because the next control sized from it
 * would have been 44, and that is a defect nothing here can see - the static gate accepts 44,
 * since 44 is legal on one of the two platforms.
 */
export const TOUCH_TARGET = 48;

/**
 * Tabular figures, for any number that lines up or counts.
 *
 * THE NATIVEWIND CLASS `tabular-nums` COMPILES TO NOTHING HERE, and it was used nineteen times
 * before anyone checked. Tailwind emits `font-variant-numeric`, and
 * `react-native-css-interop/dist/css-to-rn/parseDeclaration.js` handles only
 * `font-variant-caps` - there is no `font-variant-numeric` case and no `fontVariant` mapping in
 * the package at all [VERIFIED 2026-09-22 by grepping the installed copy]. The class is inert.
 *
 * React Native supports it natively through the style prop, which is what this is. It matters
 * most on the Arena gauge, whose count-up steps a number every 26ms in a proportional face -
 * the digits jitter and the whole number changes width as it counts - and on the Breakdown
 * board's right-aligned point and percentage columns, whose `w-16` + `text-right` layout assumes
 * figures of equal width.
 */
export const TABULAR = { fontVariant: ['tabular-nums' as const] };

