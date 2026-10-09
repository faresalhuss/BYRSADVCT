import { NextResponse, type NextRequest } from "next/server";
import { normalizePhone } from "@/lib/phone";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { evaluate, getDeal, getEvalContext, parseOffer, parseSticker, parseVehicle } from "@/db/queries";
import { formatCents, type DealReport, type Offer } from "@/engine";
import { formatDate } from "@/lib/dates";

/**
 * A buyer's-order style PDF in the layout dealerships use: header block, vehicle block,
 * itemized price, trade, taxes and fees, totals, payment grid, signature lines. Page 2 is
 * the app's audit of the same figures so the two can be laid side by side.
 */

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9.5, fontFamily: "Helvetica", color: "#111" },
  h1: { fontSize: 15, fontFamily: "Helvetica-Bold", letterSpacing: 0.5 },
  h2: { fontSize: 10.5, fontFamily: "Helvetica-Bold", marginBottom: 4, marginTop: 10, textTransform: "uppercase", letterSpacing: 0.6 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5, borderBottomWidth: 0.5, borderBottomColor: "#bbb" },
  rowStrong: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 3.5, borderTopWidth: 1, borderTopColor: "#111", marginTop: 2 },
  label: { flex: 1 },
  num: { width: 90, textAlign: "right", fontFamily: "Helvetica" },
  numStrong: { width: 90, textAlign: "right", fontFamily: "Helvetica-Bold" },
  box: { borderWidth: 1, borderColor: "#111", padding: 8, marginTop: 6 },
  grid2: { flexDirection: "row", gap: 12 },
  col: { flex: 1 },
  muted: { color: "#555", fontSize: 8.5 },
  sig: { flexDirection: "row", gap: 24, marginTop: 28 },
  sigLine: { flex: 1, borderTopWidth: 1, borderTopColor: "#111", paddingTop: 3, fontSize: 8.5 },
  cell: { flex: 1, textAlign: "right", paddingVertical: 2 },
  cellHead: { flex: 1, textAlign: "right", fontFamily: "Helvetica-Bold", paddingVertical: 2 },
  flag: { color: "#9a2f22" },
});

function money(c: number | null | undefined): string {
  return c === null || c === undefined ? "" : formatCents(c);
}

function Line({ label, cents, strong = false }: { label: string; cents: number | null | undefined; strong?: boolean }) {
  return (
    <View style={strong ? s.rowStrong : s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={strong ? s.numStrong : s.num}>{money(cents)}</Text>
    </View>
  );
}

function BuyersOrder({ r, offer, dealer, vehicleText, vin, stock, today, sticker }: { r: DealReport; offer: Offer; dealer: { name: string; address: string | null; phone: string | null; salesperson: string | null }; vehicleText: string; vin: string | null; stock: string | null; today: string; sticker: ReturnType<typeof parseSticker> }) {
  const fees = r.price.feeLines;
  const addons = r.price.addonLines;
  const gov = r.price.govLines;
  const stated = r.tax.statedTax.value;
  const terms = [...new Set(offer.paymentGrid.map((c) => c.termMonths))].sort((a, b) => a - b);
  const downs = [...new Set(offer.paymentGrid.map((c) => c.cashDownCents))].sort((a, b) => a - b);
  const subtotal = offer.sellingPriceCents === null ? null : offer.sellingPriceCents + fees.reduce((a, l) => a + (l.cents ?? 0), 0) + addons.reduce((a, l) => a + (l.cents ?? 0), 0);
  const govTotal = gov.reduce((a, l) => a + (l.cents ?? 0), 0) + (stated ?? 0);
  const total = subtotal === null ? null : subtotal + govTotal - (offer.tradeAllowanceCents ?? 0);
  const balance = total === null ? null : total + (r.trade.payoff.value ?? 0) - (offer.cashDownCents ?? 0);
  return (
    <Page size="LETTER" style={s.page}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
        <View>
          <Text style={s.h1}>{dealer.name.toUpperCase()}</Text>
          {dealer.address && <Text style={s.muted}>{dealer.address}</Text>}
          {dealer.phone && <Text style={s.muted}>{normalizePhone(dealer.phone)}</Text>}
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 12 }}>PURCHASE WORKSHEET</Text>
          <Text style={s.muted}>Date {formatDate(today)}</Text>
          {dealer.salesperson && <Text style={s.muted}>Sales consultant: {dealer.salesperson}</Text>}
          <Text style={s.muted}>Prepared from revision figures as quoted</Text>
        </View>
      </View>

      <View style={s.box}>
        <View style={s.grid2}>
          <View style={s.col}>
            <Text style={s.muted}>VEHICLE</Text>
            <Text>{vehicleText || "Vehicle"}</Text>
          </View>
          <View style={s.col}>
            <Text style={s.muted}>VIN</Text>
            <Text>{vin ?? ""}</Text>
          </View>
          <View style={s.col}>
            <Text style={s.muted}>STOCK</Text>
            <Text>{stock ?? ""}</Text>
          </View>
          <View style={s.col}>
            <Text style={s.muted}>TOTAL SRP</Text>
            <Text>{money(sticker.totalSrpCents)}</Text>
          </View>
        </View>
      </View>

      <View style={s.grid2}>
        <View style={s.col}>
          <Text style={s.h2}>Price</Text>
          <Line label="Manufacturer suggested retail price (Total SRP)" cents={sticker.totalSrpCents} />
          {offer.statedDiscountCents != null && <Line label="Discount" cents={-offer.statedDiscountCents} />}
          <Line label="Selling price" cents={offer.sellingPriceCents} strong />
          {addons.map((l) => (
            <Line key={l.id} label={l.label} cents={l.cents} />
          ))}
          {fees.map((l) => (
            <Line key={l.id} label={l.label} cents={l.cents} />
          ))}
          <Line label="Subtotal" cents={subtotal} strong />
          <Text style={s.h2}>Taxes and government fees</Text>
          <Line label="State taxes and fees (as quoted)" cents={stated} />
          {gov.map((l) => (
            <Line key={l.id} label={l.label} cents={l.cents} />
          ))}
        </View>
        <View style={s.col}>
          <Text style={s.h2}>Trade and totals</Text>
          <Line label="Trade allowance" cents={offer.tradeAllowanceCents === null ? null : -offer.tradeAllowanceCents} />
          <Line label="Trade payoff" cents={r.trade.payoff.value} />
          <Line label="Cash down" cents={offer.cashDownCents === null ? null : -offer.cashDownCents} />
          <Line label="Total" cents={total} strong />
          <Line label="Balance" cents={balance} strong />
          {offer.statedBalanceCents != null && <Text style={s.muted}>{`Dealer's stated balance: ${money(offer.statedBalanceCents)}`}</Text>}
          {terms.length > 0 && (
            <View style={{ marginTop: 10 }}>
              <Text style={s.h2}>Payment options</Text>
              <View style={{ flexDirection: "row" }}>
                <Text style={{ width: 40, paddingVertical: 2, fontFamily: "Helvetica-Bold" }}>Term</Text>
                {downs.map((d) => (
                  <Text key={d} style={s.cellHead}>
                    {formatCents(d, { cents: false })} down
                  </Text>
                ))}
              </View>
              {terms.map((t) => (
                <View key={t} style={{ flexDirection: "row", borderTopWidth: 0.5, borderTopColor: "#bbb" }}>
                  <Text style={{ width: 40, paddingVertical: 2 }}>{t} mo</Text>
                  {downs.map((d) => {
                    const c = offer.paymentGrid.find((x) => x.termMonths === t && x.cashDownCents === d);
                    return (
                      <Text key={d} style={s.cell}>
                        {c ? money(c.paymentCents) : ""}
                      </Text>
                    );
                  })}
                </View>
              ))}
              <Text style={s.muted}>Payments shown with approved credit; APR and term per retail installment contract.</Text>
            </View>
          )}
        </View>
      </View>

      <View style={s.sig}>
        <Text style={s.sigLine}>Customer signature</Text>
        <Text style={s.sigLine}>Sales manager</Text>
        <Text style={s.sigLine}>Date</Text>
      </View>
      <Text style={[s.muted, { marginTop: 16 }]}>This worksheet is not a contract. Figures are as quoted by the dealership and reproduced by BYRSADVCT; see page 2 for the audited figures.</Text>
    </Page>
  );
}

function Audit({ r, dealer }: { r: DealReport; dealer: string }) {
  const flags = r.flags.filter((f) => f.severity !== "info");
  return (
    <Page size="LETTER" style={s.page}>
      <Text style={s.h1}>AUDIT OF THE {dealer.toUpperCase()} WORKSHEET</Text>
      <Text style={s.muted}>{r.verdict.headline}</Text>
      <View style={s.grid2}>
        <View style={s.col}>
          <Text style={s.h2}>Audited price</Text>
          <Line label="Total SRP" cents={r.sticker.totalSrp.value} />
          <Line label="Selling price" cents={r.price.sellingPrice.value} />
          <Line label="Discount off total SRP" cents={r.price.discountOffSrp.value} />
          <Line label="Dealer fees" cents={r.price.dealerFees.value} />
          <Line label="Dealer add-ons (negotiable)" cents={r.price.dealerAddons.value} />
          <Line label="All-in dealer price" cents={r.price.allIn.value} strong />
          <View style={s.row}>
            <Text style={s.label}>All-in as % of total SRP</Text>
            <Text style={s.num}>{r.price.allInRatio.value === null ? "" : `${(r.price.allInRatio.value * 100).toFixed(2)}%`}</Text>
          </View>
          <Line label="Government fees (computed tax)" cents={r.price.govFees.value} />
          <Line label="Out the door" cents={r.price.otd.value} strong />
        </View>
        <View style={s.col}>
          <Text style={s.h2}>Tax and trade</Text>
          <Line label="Taxable base" cents={r.tax.taxableBase.value} />
          <Line label="Computed Georgia TAVT" cents={r.tax.computedTax.value} />
          <Line label="Dealer's stated tax" cents={r.tax.statedTax.value} />
          <Line label="Difference" cents={r.tax.difference.value} strong />
          <Line label="Corrected balance" cents={r.tax.correctedBalance.value} strong />
          <Line label="Trade allowance" cents={r.trade.allowance.value} />
          <Line label="Trade equity" cents={r.trade.equity.value} />
          <Line label="Effective trade value (with tax credit)" cents={r.trade.effectiveValue.value} />
          <Line label="Break-even allowance vs outside offer" cents={r.trade.breakEvenAllowance.value} />
        </View>
      </View>
      <Text style={s.h2}>Flags ({flags.length})</Text>
      {flags.length === 0 ? (
        <Text>None.</Text>
      ) : (
        flags.map((f) => (
          <View key={f.id} style={{ marginBottom: 4 }}>
            <Text style={[{ fontFamily: "Helvetica-Bold" }, f.severity === "flag" ? s.flag : {}]}>
              {f.title}
              {f.impactCents !== null ? ` (${formatCents(f.impactCents)})` : ""}
            </Text>
            <Text style={s.muted}>{f.detail}</Text>
          </View>
        ))
      )}
      {r.financing.grid.length > 0 && (
        <>
          <Text style={s.h2}>Payment grid implied APR</Text>
          {r.financing.grid.map((g) => (
            <Text key={g.termMonths}>
              {g.termMonths} months: {g.impliedApr === null ? "unknown" : `${(g.impliedApr * 100).toFixed(2)}%`}
            </Text>
          ))}
        </>
      )}
      <Text style={[s.muted, { marginTop: 16 }]}>Generated by BYRSADVCT. Rule: {r.tax.rule.name} at {(r.tax.rule.rate * 100).toFixed(1)}% verified {r.tax.rule.verifiedOn}.</Text>
    </Page>
  );
}

export async function GET(_req: NextRequest, ctx: RouteContext<"/api/deals/[id]/pdf">) {
  const { id } = await ctx.params;
  const [d, evalCtx] = await Promise.all([getDeal(id), getEvalContext()]);
  if (!d) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const r = evaluate(d, evalCtx);
  const vehicle = parseVehicle(d.deal.vehicle);
  const sticker = parseSticker(d.deal.sticker);
  const offer = d.latest ? parseOffer(d.latest.offer) : { sellingPriceCents: null, lines: [], tradeAllowanceCents: null, cashDownCents: null, financing: [], paymentGrid: [] };
  const vehicleText = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim, vehicle.exteriorColor].filter(Boolean).join(" ");
  const doc = (
    <Document title={`${d.deal.dealership_name} worksheet`} author="BYRSADVCT">
      <BuyersOrder r={r} offer={offer} dealer={{ name: d.deal.dealership_name, address: d.deal.dealership_address, phone: d.deal.dealership_phone, salesperson: d.deal.salesperson }} vehicleText={vehicleText} vin={vehicle.vin} stock={vehicle.stockNumber ?? null} today={evalCtx.today} sticker={sticker} />
      <Audit r={r} dealer={d.deal.dealership_name} />
    </Document>
  );
  const buffer = await renderToBuffer(doc);
  const name = `${d.deal.dealership_name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-worksheet-${evalCtx.today}.pdf`;
  return new NextResponse(new Uint8Array(buffer), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${name}"`, "cache-control": "private, no-store" } });
}
