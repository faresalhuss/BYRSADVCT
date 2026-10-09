import { NextResponse, type NextRequest } from "next/server";
import { evaluate, getBenchmarks, getEvalContext, listDeals, listInquiries, parseOffer, parseVehicle } from "@/db/queries";
import { compareOverall, compareTradeRoutes, formatApr, formatCents, formatPercent, type DealReport, type Derived } from "@/engine";

/**
 * A Markdown bundle written for pasting into an AI advisor: every deal itemized with the
 * engine's audit, the trade routes, benchmarks, programs and the rules used, plus the raw JSON.
 */

const v = (d: Derived) => (d.value === null ? "not yet quoted" : d.unit === "cents" ? formatCents(d.value) : d.unit === "ratio" ? formatPercent(d.value) : d.unit === "rate" ? formatApr(d.value) : String(d.value));

function dealSection(r: DealReport, offer: ReturnType<typeof parseOffer>, vehicleText: string, status: string, revision: number): string {
  const lines: string[] = [];
  lines.push(`### ${r.name} (${status}, revision ${revision}${r.dealType === "lease" ? ", lease" : ""})`);
  lines.push(`Vehicle: ${vehicleText || "not entered"}`);
  lines.push(`Verdict: ${r.verdict.headline} (score ${r.verdict.score ?? "n/a"})`);
  if (!r.complete) lines.push(`Incomplete: ${r.missing.join(", ")}`);
  lines.push("");
  lines.push("| Item | Amount |");
  lines.push("|---|---:|");
  for (const d of [r.sticker.totalSrp, r.sticker.factoryMsrpPlusDph, r.price.sellingPrice, r.price.discountOffSrp, r.price.discountPct, r.price.dealerFees, r.price.dealerAddons, r.price.allIn, r.price.allInRatio, r.tax.taxableBase, r.tax.computedTax, r.tax.statedTax, r.tax.difference, r.price.govFees, r.price.otd, r.tax.correctedBalance, r.trade.allowance, r.trade.payoff, r.trade.equity, r.trade.taxValue, r.trade.effectiveValue, r.trade.breakEvenAllowance, r.trade.margin, r.trade.netCostWithTrade, r.trade.netCostOutside]) {
    lines.push(`| ${d.label} | ${v(d)} |`);
  }
  if (r.dealType === "lease") {
    for (const d of [r.lease.grossCapCost, r.lease.capReductions, r.lease.adjustedCapCost, r.lease.residual, r.lease.basePayment, r.lease.effectiveApr, r.lease.impliedApr, r.lease.taxTotal, r.lease.totalCost, r.lease.costPerMonth]) lines.push(`| ${d.label} | ${v(d)} |`);
  }
  lines.push("");
  lines.push("Worksheet lines as quoted:");
  for (const l of offer.lines) lines.push(`- ${l.label} (${l.category.replace(/_/g, " ")}, source ${l.source}): ${formatCents(l.cents)}${l.note ? ` (${l.note})` : ""}`);
  if (offer.paymentGrid.length) {
    lines.push("");
    lines.push("Payment grid (term, cash down, payment, implied APR):");
    for (const row of r.financing.grid) for (const c of row.cells) lines.push(`- ${row.termMonths} mo, ${formatCents(c.cashDownCents, { cents: false })} down: ${formatCents(c.paymentCents)} (implied ${formatApr(c.impliedApr)})`);
  }
  if (r.programs.applied.length) lines.push(`Rebate programs applied: ${r.programs.applied.map((a) => `${a.program.label} ${formatCents(a.amountCents)}`).join(", ")}`);
  if (r.programs.missing.length) lines.push(`Eligible programs not applied: ${r.programs.missing.map((p) => p.label).join(", ")}`);
  lines.push("");
  lines.push(`Flags (${r.flags.length}):`);
  for (const f of r.flags) lines.push(`- [${f.severity}] ${f.title}${f.impactCents !== null ? ` (impact ${formatCents(f.impactCents)})` : ""}: ${f.detail}`);
  if (r.dealType === "lease") {
    lines.push("");
    lines.push("Lease negotiation guidance:");
    for (const n of r.lease.negotiation) lines.push(`- ${n.label} (${n.valueText}; ${n.negotiable === "yes" ? "negotiable" : n.negotiable === "partly" ? "sometimes negotiable" : "fixed"}): ${n.advice}`);
  }
  lines.push("");
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  const scope = req.nextUrl.searchParams.get("scope") === "purchase" ? "purchase" : req.nextUrl.searchParams.get("scope") === "trade" ? "trade" : "both";
  const [deals, ctx, benchmarks, inquiries] = await Promise.all([listDeals(), getEvalContext(), getBenchmarks(), listInquiries()]);
  const reports = deals.map((d) => ({ d, r: evaluate(d, ctx) }));
  const { settings, taxRule } = ctx.settingsBundle;
  const md: string[] = [];
  md.push(`# BYRSADVCT export for an AI advisor`);
  md.push(`Generated ${ctx.today}. Money in US dollars. "Not yet quoted" means the dealer has not given that number; it is never zero.`);
  md.push("");
  md.push("## How to read this");
  md.push("- All-in dealer price = selling price + every dealer fee + dealer add-ons. It excludes tax, title and registration, which are the same at every dealer for the same price.");
  md.push(`- Targets: all-in at or below ${formatPercent(settings.thresholds.strongRatio, 1)} of Total SRP is strong; at or below ${formatPercent(settings.thresholds.beatsBestRatio, 1)} beats the current best.`);
  md.push(`- Tax rule: ${taxRule.name} ${formatApr(taxRule.rate, 1)}; base = selling price + taxable dealer fees - trade allowance - manufacturer rebates (verified ${taxRule.verifiedOn}, ${taxRule.sourceUrl}). Trade credit requires the trade VIN and owner on the dealer paperwork.`);
  if (taxRule.lease) md.push(`- Lease tax: ${taxRule.lease.name}, base = ${taxRule.lease.basis === "depreciation" ? "depreciation + amortized amounts + cash down" : taxRule.lease.basis} (${taxRule.lease.sourceUrl}).`);
  md.push("- Trade routes: a dealer allowance is worth allowance x (1 + 7%) in Georgia because it reduces TAVT; an outside offer is worth its cash. Break-even allowance = outside offer / 1.07.");
  md.push("");

  if (scope !== "trade") {
    md.push("## Purchase deals (2026 Toyota 4Runner TRD Off-Road Premium)");
    md.push("");
    for (const { d, r } of reports) {
      const vehicle = parseVehicle(d.deal.vehicle);
      const vehicleText = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ") + (vehicle.vin ? ` VIN ${vehicle.vin}` : "");
      md.push(dealSection(r, d.latest ? parseOffer(d.latest.offer) : { sellingPriceCents: null, lines: [], tradeAllowanceCents: null, cashDownCents: null, financing: [], paymentGrid: [] }, vehicleText, d.deal.status + (d.deal.archived_at ? ", archived" : ""), d.latest?.revision_no ?? 0));
    }
    const open = inquiries.filter((i) => i.status === "to_call" || i.status === "called");
    if (open.length) {
      md.push("### Listings not yet quoted (inquiries)");
      for (const i of open) {
        const vv = parseVehicle(i.vehicle);
        md.push(`- ${i.dealership_name}${i.city ? `, ${i.city}${i.state ? ` ${i.state}` : ""}` : ""}: ${[vv.year, vv.make, vv.model, vv.trim, vv.exteriorColor].filter(Boolean).join(" ")}${vv.vin ? ` VIN ${vv.vin}` : ""}; advertised ${i.advertised_price_cents === null ? "not stated" : formatCents(Number(i.advertised_price_cents))}${i.msrp_cents !== null ? ` on MSRP ${formatCents(Number(i.msrp_cents))}` : ""}${i.listing_url ? ` (${i.listing_url})` : ""}`);
      }
      md.push("");
    }
  }

  if (scope !== "purchase") {
    md.push("## Trade vehicle (2022 Tesla Model 3 Long Range)");
    md.push(`Payoff: ${formatCents(ctx.trade.profile.payoffCents)}${ctx.trade.profile.payoffGoodThrough ? ` good through ${ctx.trade.profile.payoffGoodThrough}` : ""}. Trade VIN and owner recorded on dealer paperwork: ${ctx.trade.profile.vinAndOwnerRecorded ? "yes" : "no"}.`);
    md.push("");
    md.push("Outside offers:");
    for (const o of ctx.trade.outsideOffers) md.push(`- ${o.source}: ${formatCents(o.cents)}${o.expiresOn ? `, expires ${o.expiresOn}` : ""}${o.contingentOnInspection ? ", contingent on inspection" : ""}${o.note ? ` (${o.note})` : ""}`);
    md.push("");
    const routes = compareTradeRoutes(reports.map((x) => x.r), ctx.trade.profile, taxRule, ctx.today);
    md.push("Every route ranked (nets you = allowance + tax credit, or outside cash):");
    for (const r of routes) md.push(`- ${r.rank ? `#${r.rank} ` : ""}${r.label}: gross ${formatCents(r.grossCents)}, tax credit ${formatCents(r.taxValueCents)}, nets ${formatCents(r.netCents)}${r.expired ? " (expired)" : ""}`);
    md.push("");
  }

  if (scope === "both") {
    md.push("## Best overall (each purchase deal with its best Tesla route)");
    for (const o of compareOverall(reports.map((x) => x.r))) md.push(`- ${o.rank ? `#${o.rank} ` : "(incomplete) "}${o.name}: all-in ${formatCents(o.allInCents)}, net with trade ${formatCents(o.netWithTradeCents)}, net selling outside ${formatCents(o.netOutsideCents)}, best route ${o.bestRoute ?? "unknown"}, best net ${formatCents(o.bestNetCents)}${o.gapToBestCents ? `, +${formatCents(o.gapToBestCents)} vs #1` : ""}`);
    md.push("");
  }

  md.push("## Benchmarks (researched market data, with sources)");
  for (const b of benchmarks.filter((b) => scope === "both" || (b.vehicle ?? "purchase") === scope)) md.push(`- [${b.vehicle ?? "purchase"}] ${b.source} (${b.observedOn}, ${b.kind}): ${b.totalSrpCents ? `sticker ${formatCents(b.totalSrpCents)}, ` : ""}price ${formatCents(b.priceCents)}${b.totalSrpCents ? ` (${formatPercent(b.priceCents / b.totalSrpCents)})` : ""}${b.note ? ` - ${b.note}` : ""}${b.url ? ` ${b.url}` : ""}`);
  md.push("");
  md.push("## Rebate programs and rates");
  for (const p of settings.programs) md.push(`- ${p.label} ${formatCents(p.amountCents)}: ${p.eligible ? "buyer qualifies" : "buyer does not qualify (or unconfirmed)"}. ${p.eligibility} Source ${p.sourceUrl}.`);
  for (const p of settings.promoRates) md.push(`- Promo rate: ${p.label} ${formatApr(p.apr)}${p.termMonths ? ` for ${p.termMonths} months` : ""} (${p.source}, ${p.asOf})`);
  md.push(`- Pre-approval APR: ${settings.preApprovalApr === null ? "not entered" : formatApr(settings.preApprovalApr)}`);
  md.push(`- Lease: acquisition fee ${formatCents(settings.lease.standardAcquisitionFeeCents)}, disposition ${formatCents(settings.lease.standardDispositionFeeCents)}, buy-rate money factor ${settings.lease.buyRateMoneyFactor ?? "unknown"}`);
  md.push("");
  md.push("## What I want from you");
  md.push("Compare these deals and tell me which to pursue and what exact numbers to ask each dealer for next. Keep price, trade and financing separate. Point out any figure that looks inconsistent with the rules above.");
  md.push("");
  md.push("## Raw data (JSON)");
  md.push("```json");
  md.push(JSON.stringify({ today: ctx.today, settings, taxRule, trade: ctx.trade, benchmarks, deals: reports.map(({ d, r }) => ({ deal: d.deal, latestOffer: d.latest?.offer ?? null, report: r })), inquiries }, null, 1));
  md.push("```");

  const body = md.join("\n");
  return new NextResponse(body, { headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="byrsadvct-advisor-${scope}-${ctx.today}.md"` } });
}
