import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

for (const f of [".env.local", ".env.e2e.local"]) {
  if (existsSync(f)) process.loadEnvFile(f);
}

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { baseURL, trace: "retain-on-failure", extraHTTPHeaders: process.env.E2E_BYPASS ? { "x-vercel-protection-bypass": process.env.E2E_BYPASS } : {} },
  projects: [
    { name: "iphone", use: { ...devices["iPhone 15"] } },
    { name: "pixel", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "pnpm start",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
