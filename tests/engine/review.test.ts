import { describe, expect, it } from "vitest";
import fixture from "../fixtures/golden-4runner.json";
import { DEFAULT_SETTINGS, GEORGIA_TAVT_2026, evaluateDeal, reconcileOfferLines, reconcileStickerLines, parseMoney, type DealInput, type Offer } from "@/engine";

function base(overrides: Partial<DealInput> = {}): DealInput {
  return {
    id: "r",
    name: "Review",
    sticker: fixture.sticker as DealInput["sticker"],
    vehicle: { vin: fixture.vehicle.vin, year: 2026, make: "Toyota", model: "4Runner", trim: "TRD Off-Road Premium", powertrain: "gas" },
    offer: fixture.offer as Offer,
    trade: fixture.trade as DealInput["trade"],
    taxRule: GEORGIA_TAVT_2026,
    settings: DEFAULT_SETTINGS,
    today: fixture.today,
    ...overrides,
  };
}
const offer = fixture.offer as Offer;
const codes = (d: DealInput) => new Set(evaluateDeal(d).flags.map((f) => f.code));

describe("regressions from the engine review", () => {
  it("a correctly taxed no-trade deal is not flagged as missing the trade credit", () => {
    const noTrade: Offer = { ...offer, tradeAllowanceCents: null, lines: offer.lines.map((l) => (l.category === "tax" ? { ...l, cents: 417291 } : l)) };
    const r = evaluateDeal(base({ offer: noTrade }));
    expect(r.tax.likelyError).toBeNull();
    expect(codes(base({ offer: noTrade })).has("tax_wrong_base")).toBe(false);
    expect(r.tax.candidates.filter((c) => c.code !== "correct").every((c) => c.baseCents !== r.tax.taxableBase.value)).toBe(true);
  });

  it("when the trade credit does not apply (VIN not recorded), the dealer's no-credit tax is correct", () => {
    const trade = { ...(fixture.trade as DealInput["trade"]), vinAndOwnerRecorded: false };
    const r = evaluateDeal(base({ trade }));
    expect(r.tax.computedTax.value).toBe(417291);
    expect(r.tax.likelyError).toBeNull();
    expect(r.trade.taxValue.value).toBe(0);
  });

  it("an unknown taxable fee makes the taxable base and tax unknown instead of silently smaller", () => {
    const o: Offer = { ...offer, lines: offer.lines.map((l) => (l.id === "doc" ? { ...l, cents: null } : l)) };
    const r = evaluateDeal(base({ offer: o }));
    expect(r.tax.taxableBase.value).toBeNull();
    expect(r.tax.computedTax.value).toBeNull();
    expect(r.tax.likelyError).toBeNull();
    expect(codes(base({ offer: o })).has("tax_differs")).toBe(false);
  });

  it("a partially entered stated tax is unknown, not a partial sum", () => {
    const o: Offer = { ...offer, lines: [...offer.lines, { id: "tax2", label: "County tax", cents: null, category: "tax", taxable: null, source: "worksheet" }] };
    expect(evaluateDeal(base({ offer: o })).tax.statedTax.value).toBeNull();
  });

  it("an add-on printed on the sticker is inside the selling price: excluded from all-in, base and totals", () => {
    const o: Offer = { ...offer, lines: [...offer.lines, { id: "tint", label: "Window tint", cents: 40000, category: "dealer_addon", taxable: null, source: "worksheet", onSticker: true }] };
    const r = evaluateDeal(base({ offer: o }));
    expect(r.price.allIn.value).toBe(5987000);
    expect(r.tax.taxableBase.value).toBe(3811300);
    expect(r.tax.correctedBalance.value).toBe(5504091);
  });

  it("the tax value of the trade is capped at the tax due without the credit", () => {
    const o: Offer = { ...offer, tradeAllowanceCents: 6500000 };
    const r = evaluateDeal(base({ offer: o }));
    expect(r.tax.computedTax.value).toBe(0);
    expect(r.trade.taxValue.value).toBe(417291);
  });

  it("a grid principal that is unknown stays unknown and yields no implied APR", () => {
    const o: Offer = { ...offer, statedBalanceCents: null };
    const r = evaluateDeal(base({ offer: o }));
    expect(r.financing.grid[0]!.cells[0]!.principalCents).toBeNull();
    expect(r.financing.grid[0]!.impliedApr).toBeNull();
  });

  it("a financing quote with unknown cash down has an unknown principal", () => {
    const o: Offer = { ...offer, financing: [{ id: "q", lender: "X", apr: 0.05, termMonths: 60, cashDownCents: null, amountFinancedCents: null, paymentCents: 100000, source: "worksheet" }] };
    expect(evaluateDeal(base({ offer: o })).financing.quotes[0]!.principal.value).toBeNull();
  });

  it("a negative APR does not throw", () => {
    const o: Offer = { ...offer, financing: [{ id: "q", lender: "X", apr: -0.01, termMonths: 60, cashDownCents: 0, amountFinancedCents: 5000000, paymentCents: 100000, source: "worksheet" }] };
    expect(() => evaluateDeal(base({ offer: o }))).not.toThrow();
  });

  it("trade allowance up while the payment grid's implied APR went up fires the revision flag", () => {
    const worseGrid: Offer = { ...offer, tradeAllowanceCents: 2200000, paymentGrid: offer.paymentGrid.map((c) => ({ ...c, paymentCents: c.paymentCents + 2000 })) };
    const c = codes(base({ offer: worseGrid, previousOffer: offer }));
    expect(c.has("trade_up_price_up")).toBe(true);
  });

  it("a deal with no trade and no payoff still has a corrected balance; with a trade the payoff must be known", () => {
    const noTrade: Offer = { ...offer, tradeAllowanceCents: null };
    const trade = { ...(fixture.trade as DealInput["trade"]), payoffCents: null };
    expect(evaluateDeal(base({ offer: noTrade, trade })).tax.correctedBalance.value).not.toBeNull();
    expect(evaluateDeal(base({ trade })).tax.correctedBalance.value).toBeNull();
  });

  it("a quote with no dealer-fee or government-fee line is incomplete", () => {
    const bare: Offer = { ...offer, lines: offer.lines.filter((l) => l.category === "tax") };
    const r = evaluateDeal(base({ offer: bare }));
    expect(r.complete).toBe(false);
    expect(r.missing.some((m) => m.startsWith("dealer fees"))).toBe(true);
    expect(r.missing.some((m) => m.startsWith("government fees"))).toBe(true);
  });

  it("a sticker with a total but no lines yet is not a mismatch", () => {
    const r = evaluateDeal(base({ sticker: { lines: [], totalSrpCents: 6236000 } }));
    expect(r.sticker.reconciles).toBeNull();
    expect(r.sticker.lineSum.value).toBeNull();
    expect(r.flags.some((f) => f.code === "sticker_mismatch")).toBe(false);
  });

  it("number inputs to parseMoney round like their string form", () => {
    expect(parseMoney(1.005)).toBe(101);
    expect(parseMoney(58714.5)).toBe(5871450);
  });

  it("reconciliation helpers", () => {
    expect(reconcileStickerLines(fixture.sticker.lines, 6236000).reconciles).toBe(true);
    expect(reconcileStickerLines(fixture.sticker.lines, 6236100).reconciles).toBe(false);
    expect(reconcileStickerLines([], 6236000).reconciles).toBe(false);
    const o = reconcileOfferLines({ sellingPriceCents: 5871400, tradeAllowanceCents: 2150000, statedTotalCents: 4254591, lines: offer.lines });
    expect(o.sumCents).toBe(4254591);
    expect(o.reconciles).toBe(true);
  });
});
