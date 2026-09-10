// Metro + NativeWind. `input` points at the CSS file that carries the Tailwind
// directives; NativeWind compiles it and injects the resulting styles.
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

module.exports = withNativeWind(config, { input: "./src/global.css" });
