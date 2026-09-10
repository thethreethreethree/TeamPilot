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
import { colors, space, fontSize, radius } from "./tokens";

export type ColorToken = keyof typeof colors;

export const C = colors as Record<ColorToken, string>;
export { space, fontSize, radius };

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
