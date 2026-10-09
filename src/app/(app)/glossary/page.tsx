import type { Metadata } from "next";
import { GLOSSARY } from "@/content/glossary";
import { PageHeader, Section } from "@/components/ui";

export const metadata: Metadata = { title: "Learn" };

const STEPS = [
  { title: "1. Price first", body: "Settle the selling price and every dealer fee and add-on before anything else. Compare dealers on all-in dealer price as a percentage of Total SRP. Say you have no trade and are not sure about financing yet; it keeps the conversation on price." },
  { title: "2. Trade second", body: "Get two or three outside offers for the Tesla before you discuss the trade. In Georgia a dealer allowance is worth 7% more than the same cash from an outside buyer because it reduces TAVT. The break-even allowance is outside offer divided by 1.07." },
  { title: "3. Financing third", body: "Get pre-approved at a credit union first. Then ask the dealer to beat the rate. Check every payment grid cell: the app solves the APR behind each one and shows hidden principal when a quoted payment is higher than the stated APR produces." },
  { title: "4. Rebates on top", body: "Manufacturer rebates (college grad, military, customer cash) come from Toyota, not the dealer, and are applied after the negotiated price. Tick the programs you qualify for in Settings; the app flags any deal that leaves one out." },
  { title: "5. Lease if the numbers say so", body: "A lease is a purchase in disguise: the agreed value is the selling price, the money factor is the interest rate, the residual is set by the lessor. Negotiate the agreed value and the money factor; the residual and the fees are mostly fixed." },
];

export default function GlossaryPage() {
  return (
    <main>
      <PageHeader title="How dealer deals work" description="The order to negotiate in, and plain-language definitions of every term the app uses. Tap any dotted term elsewhere in the app for the same explanation." />
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Section id="order" title="The order that keeps money from hiding">
          <ol className="flex flex-col gap-4">
            {STEPS.map((s) => (
              <li key={s.title}>
                <p className="font-medium">{s.title}</p>
                <p className="mt-1 text-sm text-ink-2">{s.body}</p>
              </li>
            ))}
          </ol>
        </Section>
        <Section id="terms" title="Terms">
          <dl className="divide-y divide-line">
            {GLOSSARY.map((g) => (
              <div key={g.key} id={g.key} className="scroll-mt-20 py-4 first:pt-0">
                <dt className="font-medium">{g.term}</dt>
                <dd className="mt-1 text-sm text-ink-2">{g.short}</dd>
                <dd className="mt-2 grid gap-2 text-sm sm:grid-cols-3">
                  <div>
                    <p className="eyebrow">What it is</p>
                    <p className="mt-0.5">{g.what}</p>
                  </div>
                  <div>
                    <p className="eyebrow">How dealers use it</p>
                    <p className="mt-0.5">{g.dealer}</p>
                  </div>
                  <div>
                    <p className="eyebrow">What to ask</p>
                    <p className="mt-0.5">{g.ask}</p>
                  </div>
                </dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
    </main>
  );
}
