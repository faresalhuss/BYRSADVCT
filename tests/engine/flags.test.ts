import { describe, expect, it } from "vitest";
import fixture from "../fixtures/golden-4runner.json";
import { DEFAULT_SETTINGS, GEORGIA_TAVT_2026, compareDeals, evaluateDeal, type DealInput, type Offer } from "@/engine";

function base(overrides: Partial<DealInput> = {}): DealInput {
  return {
    id: "d1",
    name: "Deal 1",
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

const codes = (d: DealInput) => new Set(evaluateDeal(d).flags.map((f) => f.code));

describe("flags fire where they apply and stay quiet where they do not", () => {
  it("payment-only quote", () => {
    const offer: Offer = { ...(fixture.offer as Offer), sellingPriceCents: null, lines: [] };
    expect(codes(base({ offer })).has("payment_only_quote")).toBe(true);
    expect(codes(base()).has("payment_only_quote")).toBe(false);
  });

  it("sticker mismatch", () => {
    const sticker = { ...fixture.sticker, totalSrpCents: 6236100 } as DealInput["sticker"];
    const r = evaluateDeal(base({ sticker }));
    const f = r.flags.find((x) => x.code === "sticker_mismatch");
    expect(f?.impactCents).toBe(100);
  });

  it("rebate absorbed into the discount", () => {
    const offer: Offer = {
      ...(fixture.offer as Offer),
      lines: [...(fixture.offer as Offer).lines, { id: "reb", label: "Toyota customer cash", cents: 100000, category: "manufacturer_rebate", taxable: null, source: "worksheet", applied: "in_price" }],
    };
    expect(codes(base({ offer })).has("rebate_absorbed")).toBe(true);
    const ok: Offer = { ...offer, lines: offer.lines.map((l) => (l.id === "reb" ? { ...l, applied: "after_price" as const } : l)) };
    expect(codes(base({ offer: ok })).has("rebate_absorbed")).toBe(false);
  });

  it("quoted payment above the computed payment at the stated APR", () => {
    const offer: Offer = {
      ...(fixture.offer as Offer),
      financing: [{ id: "f1", lender: "TFS", apr: 0.0499, termMonths: 48, cashDownCents: 0, amountFinancedCents: 5482691, paymentCents: 131000, source: "worksheet" }],
    };
    const r = evaluateDeal(base({ offer }));
    const f = r.flags.find((x) => x.code === "payment_gap");
    expect(f).toBeDefined();
    expect(f!.impactCents!).toBeGreaterThan(0);
    const honest: Offer = { ...offer, financing: [{ ...offer.financing[0]!, paymentCents: 126238 }] };
    expect(codes(base({ offer: honest })).has("payment_gap")).toBe(false);
  });

  it("grid APR above pre-approval", () => {
    const settings = { ...DEFAULT_SETTINGS, preApprovalApr: 0.0599 };
    expect(codes(base({ settings })).has("grid_apr_above_preapproval")).toBe(true);
    const generous = { ...DEFAULT_SETTINGS, preApprovalApr: 0.1 };
    expect(codes(base({ settings: generous })).has("grid_apr_above_preapproval")).toBe(false);
  });

  it("expired quote, outside offer and payoff", () => {
    const offer: Offer = { ...(fixture.offer as Offer), quoteExpiresOn: "2026-10-01" };
    const trade = {
      ...fixture.trade,
      payoffGoodThrough: "2026-09-30",
      outsideOffers: [{ id: "o", source: "CarMax", cents: 2350000, expiresOn: "2026-10-01", contingentOnInspection: true }],
    } as DealInput["trade"];
    const c = codes(base({ offer, trade }));
    expect(c.has("quote_expired")).toBe(true);
    expect(c.has("outside_offer_expired")).toBe(true);
    expect(c.has("payoff_expired")).toBe(true);
    // An expired outside offer is excluded, so no break-even comparison exists.
    expect(c.has("trade_below_breakeven")).toBe(false);
  });

  it("benchmark older than 30 days", () => {
    const benchmarks = [{ id: "b", source: "Forum", url: null, observedOn: "2026-08-01", totalSrpCents: 6236000, priceCents: 5900000, kind: "paid" as const }];
    expect(codes(base({ benchmarks })).has("benchmark_stale")).toBe(true);
    const fresh = [{ ...benchmarks[0]!, observedOn: "2026-10-01" }];
    expect(codes(base({ benchmarks: fresh })).has("benchmark_stale")).toBe(false);
  });

  it("invalid VIN and decode mismatch", () => {
    expect(codes(base({ vehicle: { vin: "JTEVA5BR0T5165696", year: 2026, make: "Toyota", model: "4Runner", trim: null, powertrain: null } })).has("vin_invalid")).toBe(true);
    const decoded = { modelYear: 2025, make: "Toyota", model: "4Runner", trim: "TRD Off-Road Premium", fuelType: "Gasoline", engine: "2.4L turbo", driveType: "4WD" };
    const r = evaluateDeal(base({ decoded }));
    expect(r.flags.some((f) => f.code === "vin_decode_mismatch")).toBe(true);
    expect(r.vin.mismatches[0]).toMatch(/Year/);
    const hybrid = { ...decoded, modelYear: 2026, fuelType: "Gasoline / Electric hybrid" };
    expect(evaluateDeal(base({ decoded: hybrid })).vin.mismatches.some((m) => m.startsWith("Powertrain"))).toBe(true);
    const match = { ...decoded, modelYear: 2026 };
    expect(evaluateDeal(base({ decoded: match })).flags.some((f) => f.code === "vin_decode_mismatch")).toBe(false);
  });

  it("stale tax rule shows the re-verify badge", () => {
    const taxRule = { ...GEORGIA_TAVT_2026, verifiedOn: "2026-01-01" };
    expect(codes(base({ taxRule })).has("tax_rule_reverify")).toBe(true);
    expect(codes(base()).has("tax_rule_reverify")).toBe(false);
  });

  it("unknown doc fee is reported as missing, never as zero", () => {
    const offer: Offer = { ...(fixture.offer as Offer), lines: (fixture.offer as Offer).lines.map((l) => (l.id === "doc" ? { ...l, cents: null } : l)) };
    const r = evaluateDeal(base({ offer }));
    expect(r.complete).toBe(false);
    expect(r.missing).toContain("Doc fee");
    expect(r.price.dealerFees.value).toBeNull();
    expect(r.price.allIn.value).toBeNull();
    expect(r.verdict.band).toBe("incomplete");
  });
});

describe("compare", () => {
  it("ranks on price alone and on net position with trade, and says who to push", () => {
    const a = evaluateDeal(base({ id: "a", name: "A" }));
    const cheaper: Offer = { ...(fixture.offer as Offer), sellingPriceCents: 5800000, tradeAllowanceCents: 2000000 };
    const b = evaluateDeal(base({ id: "b", name: "B", offer: cheaper }));
    const price = compareDeals([a, b], "price_only");
    expect(price.ranking.find((r) => r.dealId === "b")?.rank).toBe(1);
    expect(price.push[0]?.dealId).toBe("a");
    expect(price.push[0]?.gapCents).toBe(71400);
    const withTrade = compareDeals([a, b], "with_trade");
    // B's lower price (714) is outweighed by a 1,500 lower allowance plus its 105 tax value.
    expect(withTrade.ranking.find((r) => r.dealId === "a")?.rank).toBe(1);
    expect(withTrade.rows.find((r) => r.key === "netWith")?.bestIndex).toBe(0);
  });

  it("incomplete deals rank separately", () => {
    const a = evaluateDeal(base({ id: "a", name: "A" }));
    const b = evaluateDeal(base({ id: "b", name: "B", offer: { ...(fixture.offer as Offer), sellingPriceCents: null } }));
    const c = compareDeals([a, b], "price_only");
    expect(c.ranking.find((r) => r.dealId === "b")?.rank).toBeNull();
    expect(c.ranking.find((r) => r.dealId === "a")?.rank).toBe(1);
  });
});
