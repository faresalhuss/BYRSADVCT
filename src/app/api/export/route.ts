import { NextResponse, type NextRequest } from "next/server";
import { evaluate, getEvalContext, listDeals, getNotes, getAttachments, parseVehicle } from "@/db/queries";
import { formatCents } from "@/engine";

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  const format = req.nextUrl.searchParams.get("format") === "csv" ? "csv" : "json";
  const [active, archived, ctx] = await Promise.all([listDeals(), listDeals({ archived: true }), getEvalContext()]);
  const deals = [...active, ...archived];
  const stamp = ctx.today;

  if (format === "json") {
    const full = await Promise.all(
      deals.map(async (d) => ({
        deal: d.deal,
        revisions: d.revisions,
        notes: await getNotes(d.deal.id),
        attachments: (await getAttachments(d.deal.id)).map((a) => ({ id: a.id, kind: a.kind, mime: a.mime, bytes: a.bytes, width: a.width, height: a.height, original_name: a.original_name, created_at: a.created_at })),
        report: evaluate(d, ctx),
      })),
    );
    const body = JSON.stringify({ exportedOn: stamp, settings: ctx.settingsBundle, trade: ctx.trade, benchmarks: ctx.benchmarks, deals: full }, null, 2);
    return new NextResponse(body, { headers: { "content-type": "application/json", "content-disposition": `attachment; filename="byrsadvct-${stamp}.json"` } });
  }

  const header = ["dealership", "status", "archived", "revision", "vehicle", "vin", "total_srp", "selling_price", "discount_pct", "dealer_fees", "dealer_addons", "all_in", "all_in_pct_srp", "computed_tax", "stated_tax", "tax_difference", "otd", "trade_allowance", "trade_equity", "net_cost_with_trade", "open_flags", "verdict"];
  const rows = deals.map((d) => {
    const r = evaluate(d, ctx);
    const v = parseVehicle(d.deal.vehicle);
    const money = (c: number | null) => (c === null ? "" : formatCents(c, { symbol: false }).replace(/,/g, ""));
    const pct = (x: number | null) => (x === null ? "" : (x * 100).toFixed(2));
    return [
      d.deal.dealership_name,
      d.deal.status,
      d.deal.archived_at ? "yes" : "no",
      d.latest?.revision_no ?? 0,
      [v.year, v.make, v.model, v.trim].filter(Boolean).join(" "),
      v.vin ?? "",
      money(r.sticker.totalSrp.value),
      money(r.price.sellingPrice.value),
      pct(r.price.discountPct.value),
      money(r.price.dealerFees.value),
      money(r.price.dealerAddons.value),
      money(r.price.allIn.value),
      pct(r.price.allInRatio.value),
      money(r.tax.computedTax.value),
      money(r.tax.statedTax.value),
      money(r.tax.difference.value),
      money(r.price.otd.value),
      money(r.trade.allowance.value),
      money(r.trade.equity.value),
      money(r.trade.netCostWithTrade.value),
      r.flags.filter((f) => f.severity === "flag").length,
      r.verdict.band,
    ]
      .map(csvCell)
      .join(",");
  });
  const csv = [header.join(","), ...rows].join("\n");
  return new NextResponse(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="byrsadvct-${stamp}.csv"` } });
}
