// Signs in as the E2E user on production (through the Vercel protection bypass cookie), creates the
// golden deal through the real UI on an iPhone profile, captures screenshots of each main screen,
// reports console errors, and deletes the test deal. Usage: BYPASS=<secret> node scripts/prod-screenshots.mjs
import { webkit, devices } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
process.loadEnvFile(".env.local");
process.loadEnvFile(".env.e2e.local");
const base = process.env.PROD_URL ?? "https://project-6cbo3.vercel.app";
fs.mkdirSync("docs/screenshots", { recursive: true });
const browser = await webkit.launch();
const ctx = await browser.newContext({ ...devices["iPhone 15"], colorScheme: "dark" });
const page = await ctx.newPage();
const errors = [];
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 160)); });
page.on("pageerror", (e) => errors.push("pageerror: " + String(e).slice(0, 160)));
const shot = (name) => page.screenshot({ path: `docs/screenshots/${name}.png` });

await page.goto(`${base}/login?x-vercel-protection-bypass=${process.env.BYPASS}&x-vercel-set-bypass-cookie=true`, { waitUntil: "networkidle" });
await shot("01-login");
await page.getByLabel("Email").fill(process.env.E2E_EMAIL);
await page.getByLabel("Password").fill(process.env.E2E_PASSWORD);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL(base + "/");
await page.waitForLoadState("networkidle");

const name = `E2E prod ${Date.now()}`;
await page.goto(base + "/deals/new", { waitUntil: "networkidle" });
await shot("03-new-deal-import");
await page.getByLabel("Dealership name").fill(name);
await page.getByLabel("Total SRP (bottom line)").fill("62,360");
await page.getByLabel("Selling price", { exact: true }).fill("58714");
await page.getByLabel("Trade allowance", { exact: true }).fill("21500");
await page.getByLabel("Dealer's stated balance").fill("56545.91");
for (const [btn, label, amt] of [["+ Doc fee", "Doc fee amount", "699"], ["+ ELT", "ELT amount", "257"], ["+ Georgia lemon law fee", "Georgia lemon law fee amount", "3"], ["+ Add-on", "Add-on amount", "200"], ["+ State taxes and fees", "State taxes and fees amount", "4172.91"]]) {
  await page.getByRole("button", { name: btn }).click();
  await page.getByLabel(label).fill(amt);
}
await page.getByLabel("State taxes and fees amount").blur();
await page.waitForTimeout(300);
await shot("03b-editor");
const t0 = Date.now();
await page.getByRole("button", { name: "Create deal" }).first().click();
await page.waitForURL(/\/deals\/[0-9a-f-]{36}$/);
await page.locator("h2#verdict-h").waitFor();
await page.waitForTimeout(400);
const createMs = Date.now() - t0;
await shot("04-deal");
const headline = await page.locator("h2#verdict-h").textContent();
const flagTitles = await page.locator("section[aria-labelledby=flags-h] li p.font-medium").allTextContents();
await page.getByRole("button", { name: /All-in dealer price: \$59,870\.00/ }).first().click();
await page.waitForTimeout(300);
await shot("05-derivation");
for (const [path, file] of [["/", "02-deals"], ["/compare?view=overall", "06-compare-overall"], ["/compare?view=trade", "06b-compare-trade"], ["/trade", "07-trade"], ["/benchmarks", "08-benchmarks"], ["/inquire", "09-inquire"], ["/glossary", "10-learn"], ["/settings", "11-settings"]]) {
  await page.goto(base + path, { waitUntil: "networkidle" });
  await shot(file);
}
await browser.close();
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false } });
await sb.auth.signInWithPassword({ email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD });
const { data } = await sb.from("deals").delete().like("dealership_name", "E2E %").select("id");
console.log(JSON.stringify({ headline, flagTitles, createRoundTripMs: createMs, consoleErrors: errors, cleanedUp: data?.length }, null, 1));
