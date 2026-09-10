// babel-preset-expo with NativeWind's jsxImportSource, plus the css-interop
// babel plugin that rewrites className into styles.
//
// THERE IS NO WORKLETS PLUGIN LISTED HERE AND THAT IS CORRECT — checked, not
// assumed. `babel-preset-expo` adds `react-native-worklets/plugin` by itself
// whenever the package is installed (configs/expo.js:96-101), and it is,
// alongside reanimated. Adding it by hand would apply it twice.
//
// WHAT WOULD BREAK IT: passing `worklets: false` or `reanimated: false` in the
// preset options below. Every Reanimated worklet in the app would then stop
// being compiled, and the failure would be a runtime crash on a device with a
// clean typecheck, a clean lint and a full green test run — which is exactly
// how the swipe pager's two defects reached a phone on 4 September. There is a
// test pinning this: tests/gesture-root.test.ts.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
