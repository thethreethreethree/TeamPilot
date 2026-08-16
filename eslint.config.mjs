import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

/**
 * ESLint 9 flat config (migrated from .eslintrc.json, 2026-08-16, audit finding #8).
 *
 * eslint-config-next 16 requires ESLint 9 + flat config and ships NATIVE flat-config arrays at
 * `eslint-config-next/core-web-vitals` and `.../typescript` (the flat successors of the legacy
 * `extends: ["next/core-web-vitals", "next/typescript"]`). We spread them and re-apply the SAME three
 * rule overrides + ignores the old .eslintrc.json had — so the linted set + ruleset are unchanged;
 * only the config format and toolchain version moved.
 */
const eslintConfig = [
  // ESLint 9 changed the default of reportUnusedDisableDirectives from off (ESLint 8) to "warn".
  // The legacy `eslint . --ext` invocation did NOT report unused disables, so restore off to keep
  // the migration behaviour-identical (the codebase carries pre-emptive eslint-disable comments).
  {
    linterOptions: { reportUnusedDisableDirectives: "off" },
  },
  // Global ignores (was .eslintrc.json ignorePatterns). A config with ONLY `ignores` is global.
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "supabase/**",
      "scripts/**",
      "__mocks__/**",
      "docs/**",
    ],
  },
  ...coreWebVitals,
  ...typescript,
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "react/no-danger": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // TOOLCHAIN MIGRATION (2026-08-16, finding #8): eslint-config-next 16 ships NEW opinionated
      // react-hooks rules (React-Compiler-adjacent) that the previous ESLint-8 config never enforced.
      // This bump's goal is the toolchain (off EOL ESLint 8 + align to Next 16), NOT adopting a
      // stricter ruleset — so these new rules are turned off to keep the linted behaviour IDENTICAL.
      // Adopting them (they flag real React patterns worth revisiting: ~159 set-state-in-effect, etc.)
      // is a separate, deliberate follow-up, not a silent side effect of a version bump.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react-hooks/immutability": "off",
      "react-hooks/static-components": "off",
      "react-hooks/purity": "off",
      "react-hooks/exhaustive-deps": "warn",
      "@next/next/no-location-assign-relative-destination": "off",
    },
  },
];

export default eslintConfig;
