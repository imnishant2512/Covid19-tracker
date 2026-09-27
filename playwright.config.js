import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // CI also writes the HTML report, which carries the traces and screenshots
  // from any failure or retry. With the GitHub reporter alone there was nothing
  // for ci.yml to upload, so a flaky failure left no evidence behind.
  reporter: process.env.CI
    ? [["github"], ["html", { open: "never" }]]
    : "list",

  use: {
    baseURL: `http://localhost:${PORT}`,
    // Local runs never retry, so "on-first-retry" alone meant a local failure
    // left no trace behind — which is how a one-off failure went undiagnosed.
    trace: process.env.CI ? "on-first-retry" : "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],

  // Runs against the real production bundle, not the dev server.
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
  },
});
