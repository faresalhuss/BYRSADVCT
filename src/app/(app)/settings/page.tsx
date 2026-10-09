import type { Metadata } from "next";
import { Suspense } from "react";
import { getSettingsBundle } from "@/db/queries";
import { PasswordForm } from "./password-form";
import { SettingsForm } from "./settings-form";
import { TaxRuleForm } from "./tax-rule-form";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <main>
      <h1 className="text-3xl">Settings</h1>
      <p className="mt-1 text-sm text-ink-2">Thresholds, junk-fee list, your rates, and the state tax rules. Every number the verdict uses lives here.</p>
      <Suspense fallback={<p className="mt-4 text-ink-2">Loading</p>}>
        <Settings />
      </Suspense>
    </main>
  );
}

async function Settings() {
  const bundle = await getSettingsBundle();
  return (
    <div className="mt-4 grid gap-4 lg:grid-cols-2">
      <section className="card p-4">
        <h2 className="text-lg">Targets and rates</h2>
        <SettingsForm initial={{ ...bundle.settings, activeTaxRuleId: bundle.activeTaxRuleId }} ruleOptions={bundle.taxRules.map((r) => ({ id: r.id, name: `${r.name} v${r.version} (${(r.rate * 100).toFixed(2)}%)` }))} />
      </section>
      <section className="card p-4">
        <h2 className="text-lg">State tax rule</h2>
        <p className="mt-1 text-xs text-ink-2">Rules are versioned. Saving a changed rule under a new id keeps the old one for history.</p>
        <TaxRuleForm initial={bundle.taxRule} />
      </section>
      <section className="card p-4">
        <h2 className="text-lg">Your password</h2>
        <p className="mt-1 text-xs text-ink-2">At least 10 characters. Takes effect on your next sign-in.</p>
        <PasswordForm />
      </section>
      <section className="card p-4">
        <h2 className="text-lg">Export</h2>
        <p className="mt-1 text-sm text-ink-2">Everything you have entered, as a file.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a href="/api/export?format=json" className="btn" download>
            Download JSON
          </a>
          <a href="/api/export?format=csv" className="btn" download>
            Download CSV
          </a>
        </div>
      </section>
    </div>
  );
}
