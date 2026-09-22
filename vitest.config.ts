import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // Make `import "server-only"` a no-op in tests.
      "server-only": path.resolve(__dirname, "__mocks__/server-only.ts"),
    },
    // tsconfig "@/*" -> src/*, resolved NATIVELY by Vite. The vite-tsconfig-paths plugin this replaces had
    // stopped covering modules Vitest externalises for SSR, so 352 of 647 test FILES failed to import with
    // ERR_MODULE_NOT_FOUND ("Cannot find package '@/lib/...'"), taking 2222 tests with them (2110 ran, 4332 do
    // now). The suite DID exit 1 — this was never a silently-green gate — but it failed as a toolchain error,
    // and the per-test line read "2110 passed | 0 failed", so the failure invited "env problem, not my diff"
    // rather than "a third of the suite is not running". Measured both ways before/after, not assumed.
    // Vite's own deprecation notice recommends exactly this option.
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    globals: true,
    /**
     * 20s, not vitest's default 5s. A MEASUREMENT, not a comfort margin.
     *
     * Three tests failed on a time budget in one day (2026-09-22), all three passing standalone
     * and all three killed inside the full gate:
     *
     *   · the writer:audit and enum:audit suites — each spawns a node process; 0.31-0.42s alone
     *   · RecordingsTab's "offers to ASK" case — 1061ms against Testing Library's 1000ms wait
     *   · envDocsComplete — 7404ms against this 5000ms, walking the source tree with regexes
     *
     * None of them is slow. They are measured on a quiet machine and then run on one with 706
     * files in flight — the whole suite takes ~102s wall with `transform 160s` and `import 530s`
     * across the pool, so an individual test's wall clock has little to do with its own work. A
     * budget that only holds when nothing else is running is not a budget; it is a flake
     * generator, and a flaky gate is one people learn to re-run instead of read.
     *
     * The cost is that a genuinely hung test now takes 20s to fail instead of 5s. That is the
     * right trade: CI still goes red, fifteen seconds later, and nobody is taught to ignore it.
     */
    testTimeout: 20_000,
    // .tsx included so component-RENDER tests run (a `// @vitest-environment jsdom` file comment opts those
    // individual files into a DOM; the default stays node, so the node-only suite is untouched).
    include: [
      "src/**/__tests__/**/*.test.{ts,tsx}",
      "scripts/**/__tests__/**/*.test.{ts,tsx}",
    ],
  },
});
