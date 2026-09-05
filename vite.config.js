// From vitest/config rather than vite: Vite 8's own defineConfig type
// does not include the `test` key.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // firebase.json serves from "build", so keep Vite's output there.
    outDir: "build",
    sourcemap: true,
    rollupOptions: {
      output: {
        // Vite 8 bundles with Rolldown, which accepts only the function form
        // of manualChunks; the object form fails the build outright.
        manualChunks: (id) =>
          id.includes("@mui/") || id.includes("@emotion/") ? "mui" : undefined,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,

    // Vitest's default glob also matches e2e/*.spec.js, which are Playwright
    // tests and must not run here.
    include: ["src/**/*.{test,spec}.{js,jsx}"],
    setupFiles: "./src/setupTests.js",
    restoreMocks: true,

    // The heaviest DOM spec measures ~850ms in isolation; this is headroom for
    // contention under coverage instrumentation, not for a slow test. Re-checked
    // on Vitest 5: at the 5s default the suite still fails roughly one run in
    // three, so the headroom is still earned. Checked and rejected as fixes:
    // capping workers (slower), reverting jsdom (no effect), and pool:
    // 'vmThreads' (~30% faster but it runs specs in node:vm, and this suite
    // already hit one module-identity problem with Leaflet).
    testTimeout: 15000,
    hookTimeout: 15000,

    // No spec asserts on computed styles, and processing every stylesheet
    // (including Leaflet's) per file is pure overhead.
    css: false,

    // Without this, each worker re-resolves and transforms MUI's many small ESM
    // modules from source. Prebundling them cut collection from ~75s to ~26s.
    deps: {
      optimizer: {
        // Renamed from `web` in Vitest 4. The old key is silently ignored
        // rather than reported, which tripled test import time unnoticed.
        client: {
          enabled: true,
          // Leaflet is deliberately absent. Prebundling it hands the app a
          // different module instance than the test imports, so spying on
          // L.Map.prototype no longer intercepts the call react-leaflet makes.
          // MUI is the bulk of the transform cost anyway.
          include: [
            "@mui/material",
            "@emotion/react",
            "@emotion/styled",
            "chart.js",
          ],
        },
      },
    },

    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/main.jsx", "src/setupTests.js", "src/__tests__/**"],
      // Ratchet these up rather than down.
      thresholds: {
        statements: 85,
        branches: 85,
        functions: 85,
        lines: 85,
      },
    },
  },
});
