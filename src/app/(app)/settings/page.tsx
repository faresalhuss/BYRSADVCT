import type { Metadata } from "next";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { PageHeader, Section } from "@/components/ui";
import { getSettingsBundle } from "@/db/queries";
import { PasswordForm } from "./password-form";
import { ProgramsForm } from "./programs-form";
import { SettingsForm } from "./settings-form";
import { TaxRuleForm } from "./tax-rule-form";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <main>
      <PageHeader title="Settings" description="Thresholds, rebate programs you qualify for, your rates, lease program figures, the state tax rules, and exports." />
      <Suspense fallback={<div className="skeleton h-64" aria-hidden="true" />}>
        <Settings />
      </Suspense>
    </main>
  );
}

async function Settings() {
  const bundle = await getSettingsBundle();
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Section id="programs" title="Rebate programs" intro="Researched 2026-10-09 for Southeast Toyota territory. Read each rule and tick the ones that apply to you; the app then flags any deal that leaves one out." className="lg:col-span-2">
        <ProgramsForm initial={{ ...bundle.settings, activeTaxRuleId: bundle.activeTaxRuleId }} />
      </Section>
      <Section id="targets" title="Targets, rates and lease program">
        <SettingsForm initial={{ ...bundle.settings, activeTaxRuleId: bundle.activeTaxRuleId }} ruleOptions={bundle.taxRules.map((r) => ({ id: r.id, name: `${r.name} v${r.version} (${(r.rate * 100).toFixed(2)}%)` }))} />
      </Section>
      <div className="flex flex-col gap-4">
        <Section id="tax" title="State tax rule" intro="Versioned. Saving a changed rule under a new id keeps the old one for history.">
          <TaxRuleForm initial={bundle.taxRule} />
        </Section>
        <Section id="password" title="Your password" intro="At least 10 characters. Takes effect on your next sign-in.">
          <PasswordForm />
        </Section>
        <Section id="export" title="Export" intro="Everything you have entered, with the engine's audit of each deal.">
          <div className="flex flex-wrap gap-2">
            <a href="/api/export/advisor?scope=both" className="btn btn-primary" download>
              <Icon.Download size={16} /> AI advisor bundle (4Runner + Tesla)
            </a>
            <a href="/api/export/advisor?scope=purchase" className="btn" download>
              4Runner only
            </a>
            <a href="/api/export/advisor?scope=trade" className="btn" download>
              Tesla only
            </a>
            <a href="/api/export?format=json" className="btn" download>
              Raw JSON
            </a>
            <a href="/api/export?format=csv" className="btn" download>
              CSV
            </a>
          </div>
          <p className="mt-2 text-xs text-ink-3">The advisor bundle is a Markdown document written for pasting into an AI chat: every deal itemized, the audits, trade routes, benchmarks and the rules used.</p>
        </Section>
      </div>
    </div>
  );
}
