/**
 * NativeWind (Tailwind for React Native) configuration.
 *
 * It CONSUMES src/lib/tokens.js and never redeclares a value — one source of
 * truth (DS-019). The same module is imported by components for the imperative
 * colours a className cannot reach (a StatusBar style, an ActivityIndicator
 * colour, a navigator theme).
 *
 * Dark-only: the app is locked to dark in app.json, so there is a single palette
 * and no `dark:` variants to keep in step.
 */
const { colors, space, fontSize, radius, fontFamily } = require("./src/lib/tokens");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors,
      spacing: space,
      fontSize,
      borderRadius: radius,
      fontFamily,
    },
  },
  plugins: [],
};
