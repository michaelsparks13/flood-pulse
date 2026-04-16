import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02 },
  },
  projects: [
    {
      name: "desktop",
      testIgnore: "**/mobile/**",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-iphone-se",
      testMatch: "**/mobile/*.spec.ts",
      use: { ...devices["iPhone SE"] },
    },
    {
      name: "mobile-iphone-14",
      testMatch: "**/mobile/*.spec.ts",
      use: { ...devices["iPhone 14"] },
    },
    {
      name: "mobile-pixel-7",
      testMatch: "**/mobile/*.spec.ts",
      use: { ...devices["Pixel 7"] },
    },
  ],
});
