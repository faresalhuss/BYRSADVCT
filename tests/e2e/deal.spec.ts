import { expect, test } from "@playwright/test";
import { cleanup, e2eCreds, signIn } from "./auth";

const creds = e2eCreds();
const PREFIX = "E2E ";

test.describe("deal flow (signed in)", () => {
  test.skip(!creds, "E2E_EMAIL / E2E_PASSWORD not set; skipping signed-in flows");

  let token = "";
  const created: string[] = [];
  test.beforeEach(async ({ context, baseURL }) => {
    token = await signIn(context, baseURL!, creds!);
  });
  test.afterEach(async () => {
    if (token && created.length) await cleanup(creds!, token, created.splice(0));
  });

  test("create a deal from the worksheet, see the audited verdict, compare and archive", async ({ page }) => {
    const name = `${PREFIX}${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    created.push(name);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Deals", exact: true, level: 1 })).toBeVisible();
    await page.getByRole("link", { name: "New deal" }).first().click();
    await expect(page.getByRole("heading", { name: "New deal", exact: true, level: 1 })).toBeVisible();

    await page.getByLabel("Dealership name").fill(name);
    await page.getByLabel("Total SRP (bottom line)").fill("$62,360.00");
    await page.getByLabel("Selling price", { exact: true }).fill("58714");
    await page.getByLabel("Trade allowance", { exact: true }).fill("21.5k");
    await page.getByLabel("Dealer's stated balance").fill("56,545.91");

    // Fees as printed on the worksheet.
    await page.getByRole("button", { name: "+ Doc fee" }).click();
    await page.getByLabel("Doc fee amount").fill("699");
    await page.getByRole("button", { name: "+ ELT" }).click();
    await page.getByLabel("ELT amount").fill("257");
    await page.getByRole("button", { name: "+ Georgia lemon law fee" }).click();
    await page.getByLabel("Georgia lemon law fee amount").fill("3");
    await page.getByRole("button", { name: "+ Add-on" }).click();
    await page.getByLabel("Add-on amount").fill("200");
    await page.getByRole("button", { name: "+ State taxes and fees" }).click();
    await page.getByLabel("State taxes and fees amount").fill("4172.91");
    await page.getByLabel("State taxes and fees amount").blur();

    // Live recalculation in the sticky summary: all-in 59,870 / 62,360 = 96.01%.
    await expect(page.getByLabel("All-in as percent of total SRP").first()).toHaveText("96.01%");
    await expect(page.getByText("Tax computed without the trade credit").first()).toBeVisible();

    await page.getByRole("button", { name: "Create deal" }).first().click();
    await expect(page).toHaveURL(/\/deals\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: name, exact: true, level: 1 })).toBeVisible();
    const dealUrl = page.url();
    await expect(page.getByText("Keep negotiating").first()).toBeVisible();
    await expect(page.getByText("Tax computed without the trade credit").first()).toBeVisible();
    await expect(page.getByText("+$1,505.00").first()).toBeVisible();

    // Tap-to-derive: the all-in number opens its derivation.
    await page.getByRole("button", { name: /All-in dealer price: \$59,870\.00/ }).first().click();
    await expect(page.getByText("selling price + dealer fees + dealer add-ons").first()).toBeVisible();

    // Revisions page lists revision 1.
    await page.getByRole("link", { name: /Revisions \(1\)/ }).click();
    await expect(page.getByRole("heading", { name: "Revision 1" })).toBeVisible();

    // Compare page renders with this deal selectable.
    await page.goto("/compare");
    await expect(page.getByRole("heading", { name: "Compare", exact: true, level: 1 })).toBeVisible();
    await expect(page.getByText(name).first()).toBeVisible();

    // Archive from the deal page.
    await page.goto(dealUrl);
    await page.getByRole("button", { name: "Archive", exact: true }).click();
    await expect(page.getByText("archived", { exact: true })).toBeVisible();
  });

  test("settings and trade pages load and save", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings", exact: true, level: 1 })).toBeVisible();
    await expect(page.getByLabel("Strong: all-in at or below (% of total SRP)")).toHaveValue(/94\.5/);
    await page.goto("/trade");
    await expect(page.getByRole("heading", { name: "Trade", exact: true, level: 1 })).toBeVisible();
    await page.goto("/benchmarks");
    await expect(page.getByRole("heading", { name: "Benchmarks", exact: true, level: 1 })).toBeVisible();
  });
});
