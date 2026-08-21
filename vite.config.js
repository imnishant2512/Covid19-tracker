import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // firebase.json serves from "build", so keep Vite's output there.
    outDir: "build",
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          mui: ["@mui/material", "@emotion/react", "@emotion/styled"],
        },
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

    // No spec asserts on computed styles, and processing every stylesheet
    // (including Leaflet's) per file is pure overhead.
    css: false,

    // Without this, each worker re-resolves and transforms MUI's many small ESM
    // modules from source. Prebundling them cut collection from ~75s to ~26s.
    deps: {
      optimizer: {
        web: {
          enabled: true,
          include: [
            "@mui/material",
            "@emotion/react",
            "@emotion/styled",
            "leaflet",
            "react-leaflet",
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
