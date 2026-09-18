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
    // .tsx included so component-RENDER tests run (a `// @vitest-environment jsdom` file comment opts those
    // individual files into a DOM; the default stays node, so the node-only suite is untouched).
    include: [
      "src/**/__tests__/**/*.test.{ts,tsx}",
      "scripts/**/__tests__/**/*.test.{ts,tsx}",
    ],
  },
});
