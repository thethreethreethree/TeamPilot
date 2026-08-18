import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "node:path";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      // Make `import "server-only"` a no-op in tests.
      "server-only": path.resolve(__dirname, "__mocks__/server-only.ts"),
    },
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
