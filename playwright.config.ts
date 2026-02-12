import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 45_000,
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3001",
    headless: true,
    trace: "retain-on-failure"
  },
  webServer: {
    command: "npm run build && PORT=3001 npm run start",
    port: 3001,
    timeout: 180_000,
    reuseExistingServer: false
  },
  reporter: "list"
});
