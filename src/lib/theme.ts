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

/** Minimum touch target. iOS HIG is 44pt; the design law forbids anything below. */
export const TOUCH_TARGET = 44;
