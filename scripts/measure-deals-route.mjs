// Measures the deals route ("/") on a Pixel 7 profile against a running production server: JS bytes, LCP, CLS.
// Usage: pnpm start & node scripts/measure-deals-route.mjs
import { chromium, devices } from "@playwright/test";
import { createServerClient } from "@supabase/ssr";
process.loadEnvFile(".env.local"); process.loadEnvFile(".env.e2e.local");
const base = "http://localhost:3000";
const jar = [];
const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { cookies: { getAll: () => jar, setAll: (cs) => { for (const c of cs) { const i = jar.findIndex(j => j.name === c.name); if (i >= 0) jar[i] = { name: c.name, value: c.value }; else jar.push({ name: c.name, value: c.value }); } } } });
const { error } = await sb.auth.signInWithPassword({ email: process.env.E2E_EMAIL, password: process.env.E2E_PASSWORD });
if (error) throw error;
const browser = await chromium.launch();
const ctx = await browser.newContext({ ...devices["Pixel 7"] });
await ctx.addCookies(jar.map(c => ({ name: c.name, value: c.value, url: base })));
const page = await ctx.newPage();
let js = 0, jsGz = 0, css = 0, n = 0;
page.on("response", async (r) => {
  const u = r.url(); if (!u.startsWith(base)) return;
  const ct = r.headers()["content-type"] || "";
  if (u.includes("/_next/static/") && (ct.includes("javascript") || u.endsWith(".js"))) { const b = await r.body().catch(() => null); if (b) { js += b.length; n++; const sizes = await r.request().sizes().catch(() => null); if (sizes) jsGz += sizes.responseBodySize; } }
  if (ct.includes("text/css")) { const b = await r.body().catch(() => null); if (b) css += b.length; }
});
const t0 = Date.now();
await page.goto(base + "/", { waitUntil: "networkidle" });
const vitals = await page.evaluate(() => new Promise((res) => { let lcp = 0; let cls = 0; new PerformanceObserver((l) => { for (const e of l.getEntries()) lcp = e.startTime; }).observe({ type: "largest-contentful-paint", buffered: true }); new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) cls += e.value; }).observe({ type: "layout-shift", buffered: true }); setTimeout(() => res({ lcp: Math.round(lcp), cls: +cls.toFixed(4) }), 800); }));
console.log(JSON.stringify({ route: "/", scripts: n, jsBytesUncompressed: js, jsBytesOnWire: jsGz, cssBytes: css, loadMs: Date.now() - t0, ...vitals }));
await browser.close();
