import { defineConfig } from "@playwright/test";

const host = process.env.PLAYWRIGHT_HOST ?? "127.0.0.1";
const port = Number(process.env.PLAYWRIGHT_PORT ?? "3191");
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://${host}:${port}`;
const remoteBackendUrl =
  process.env.PLAYWRIGHT_REMOTE_BACKEND_URL ?? "http://127.0.0.1:8787";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "output/playwright/report" }],
  ],
  outputDir: "output/playwright/test-results",
  use: {
    baseURL,
    viewport: { width: 1440, height: 960 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "local-chromium",
      grepInvert: /@remote/,
    },
    {
      name: "remote-chromium",
      grep: /@remote/,
    },
  ],
  webServer: [
    {
      command: "node scripts/serve-static.mjs",
      url: baseURL,
      reuseExistingServer: false,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        STATIC_SERVER_HOST: host,
        STATIC_SERVER_PORT: String(port),
      },
    },
    {
      command: "pnpm backend:dev",
      url: `${remoteBackendUrl}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      stdout: "pipe",
      stderr: "pipe",
    },
  ],
});
