import { expect, test } from "@playwright/test";

test("unauthenticated visit to the deals list redirects to sign-in", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "Sign in", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
});

test("web app manifest and offline page are served", async ({ page, request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBeTruthy();
  const json = (await manifest.json()) as { name: string; display: string; icons: unknown[] };
  expect(json.name).toBe("BYRSADVCT");
  expect(json.display).toBe("standalone");
  expect(json.icons.length).toBeGreaterThanOrEqual(2);
  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: "You are offline" })).toBeVisible();
});

test("sign-in form rejects an address that is not on the allowlist", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("stranger@example.com");
  await page.getByLabel("Password").fill("whatever-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("#login-error")).toContainText("not on the allowlist");
});
