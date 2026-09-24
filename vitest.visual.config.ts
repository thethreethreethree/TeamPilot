import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * The visual pass — SEPARATE FROM THE GATE, on purpose.
 *
 * `vitest.config.ts` includes `src/**\/__tests__/**\/*.test.{ts,tsx}`. Capture files are named
 * `*.capture.tsx` and live beside the component, so they match NOTHING in that pattern and
 * `npm run check` never sees them. That is deliberate:
 *
 *   · they write files, and a gate step with side effects is a gate people learn to distrust
 *   · they need a browser and a compiled stylesheet, neither of which CI is guaranteed to have
 *   · they cannot fail, because there is nothing to compare against — see scripts/visual/shoot.mjs
 *     on why baseline diffing is the wrong tool here
 *
 * Run them with `npm run visual`, which compiles the real Tailwind bundle, executes this config,
 * and screenshots the result in both themes.
 */
export default defineConfig({
  resolve: {
    alias: { "server-only": path.resolve(__dirname, "__mocks__/server-only.ts") },
    tsconfigPaths: true,
  },
  test: {
    environment: "jsdom",
    globals: true,
    // A capture renders a real surface with real fetches mocked; some are slower than a unit test
    // and none of them is a timing assertion.
    testTimeout: 30_000,
    include: ["src/**/*.capture.tsx"],
  },
});
