import { describe, expect, it } from "vitest";
import fixture from "../fixtures/golden-4runner.json";
import {
  DEFAULT_SETTINGS,
  GEORGIA_TAVT_2026,
  amortizedPayment,
  checkVin,
  evaluateDeal,
  type DealInput,
  type Offer,
  type Settings,
} from "@/engine";

const settings: Settings = {
  ...DEFAULT_SETTINGS,
  promoRates: [{ id: "promo", label: "Toyota promo", apr: fixture.promoApr, termMonths: null, source: "fixture", asOf: fixture.today }],
};

function buildInput(overrides: Partial<DealInput> = {}): DealInput {
  return {
    id: "golden",
    name: "Golden 4Runner",
    sticker: fixture.sticker as DealInput["sticker"],
    vehicle: {
      vin: fixture.vehicle.vin,
      year: fixture.vehicle.year,
      make: fixture.vehicle.make,
      model: fixture.vehicle.model,
      trim: fixture.vehicle.trim,
      powertrain: fixture.vehicle.powertrain,
    },
    offer: fixture.offer as Offer,
    trade: fixture.trade as DealInput["trade"],
    taxRule: GEORGIA_TAVT_2026,
    settings,
    today: fixture.today,
    ...overrides,
  };
}

const exp = fixture.expected;

describe("golden fixture: 2026 4Runner TRD Off-Road Premium", () => {
  const report = evaluateDeal(buildInput());

  it("VIN check digit is valid (X)", () => {
    const v = checkVin(fixture.vehicle.vin);
    expect(v?.valid).toBe(true);
    expect(v?.checkDigit).toBe(exp.vinCheckDigit);
    expect(report.vin.valid).toBe(true);
  });

  it("sticker reconciles: 57,320 + 3,445 + 1,595 = 62,360", () => {
    expect(report.sticker.reconciles).toBe(true);
    expect(report.sticker.lineSum.value).toBe(fixture.sticker.totalSrpCents);
    expect(report.sticker.factoryMsrpPlusDph.value).toBe(exp.factoryMsrpPlusDphCents);
  });

  it("discount off total SRP is 3,646.00 (5.85%) and 201.00 below factory MSRP + DPH", () => {
    expect(report.price.discountOffSrp.value).toBe(exp.discountCents);
    expect(report.price.discountPct.value).toBeCloseTo(exp.discountPct, 4);
    expect(report.price.vsFactoryMsrpDph.value).toBe(exp.vsFactoryMsrpDphCents);
  });

  it("all-in dealer price is 59,870.00 (96.01%), 59,670.00 (95.69%) without the carbon program", () => {
    expect(report.price.allIn.value).toBe(exp.allInCents);
    expect(report.price.allInRatio.value).toBeCloseTo(exp.allInRatio, 4);
    expect(report.price.allInNoAddons.value).toBe(exp.allInNoAddonsCents);
    expect(report.price.allInNoAddonsRatio.value).toBeCloseTo(exp.allInNoAddonsRatio, 4);
  });

  it("tax audit: dealer's 4,172.91 is 7% of 59,613.00 (no trade credit); correct TAVT is 2,667.91; overcharge 1,505.00", () => {
    expect(report.tax.statedTax.value).toBe(exp.dealerStatedTaxCents);
    expect(report.tax.taxableBase.value).toBe(exp.correctTaxBaseCents);
    expect(report.tax.computedTax.value).toBe(exp.correctTaxCents);
    expect(report.tax.likelyError?.code).toBe("no_trade_credit");
    expect(report.tax.likelyError?.baseCents).toBe(exp.dealerTaxBaseCents);
    expect(report.tax.difference.value).toBe(exp.overchargeCents);
    const flag = report.flags.find((f) => f.code === "tax_wrong_base");
    expect(flag).toBeDefined();
    expect(flag?.impactCents).toBe(exp.overchargeCents);
  });

  it("corrected balance is 55,040.91; without the carbon program TAVT is 2,653.91 and balance 54,826.91", () => {
    expect(report.tax.correctedBalance.value).toBe(exp.correctedBalanceCents);
    expect(report.tax.computedTaxNoAddons.value).toBe(exp.taxNoAddonsCents);
    expect(report.tax.correctedBalanceNoAddons.value).toBe(exp.correctedBalanceNoAddonsCents);
  });

  it("trade equity is 7,500.00", () => {
    expect(report.trade.equity.value).toBe(exp.equityCents);
  });

  it("against a 23,500 outside offer: allowance worth 23,005 after tax credit, outside wins by 495, break-even 21,962.62", () => {
    expect(report.trade.effectiveValue.value).toBe(exp.effectiveTradeValueCents);
    expect(report.trade.winner).toBe("outside");
    expect(report.trade.margin.value).toBe(-exp.outsideWinsByCents);
    expect(report.trade.breakEvenAllowance.value).toBe(exp.breakEvenAllowanceCents);
    expect(report.trade.ifDealerMatches.value).toBe(exp.ifDealerMatchesTradeWinsByCents);
    expect(report.flags.some((f) => f.code === "trade_below_breakeven")).toBe(true);
  });

  it("if the dealer matches 23,500, trading in wins by 1,645.00", () => {
    const matched = evaluateDeal(buildInput({ offer: { ...(fixture.offer as Offer), tradeAllowanceCents: 2350000 } }));
    expect(matched.trade.winner).toBe("trade");
    expect(matched.trade.margin.value).toBe(exp.ifDealerMatchesTradeWinsByCents);
  });

  it("implied APR from the grid: about 9.20% (48), 9.15% (66), 8.12% (75), consistent across each row, flagged against 4.99% promo", () => {
    const byTerm = new Map(report.financing.grid.map((r) => [String(r.termMonths), r]));
    for (const [term, apr] of Object.entries(exp.impliedApr)) {
      const row = byTerm.get(term);
      expect(row, `row ${term}`).toBeDefined();
      expect(row!.impliedApr).not.toBeNull();
      expect(Math.abs(row!.impliedApr! - apr)).toBeLessThanOrEqual(exp.impliedAprToleranceAbs);
      expect(row!.consistent).toBe(true);
      for (const cell of row!.cells) {
        expect(Math.abs(cell.impliedApr! - apr)).toBeLessThanOrEqual(exp.impliedAprToleranceAbs);
      }
    }
    const promoFlags = report.flags.filter((f) => f.code === "grid_apr_above_promo");
    expect(promoFlags.length).toBe(3);
  });

  it("payment on 54,826.91 at 4.99% for 48 months is about 1,262.40", () => {
    const p = amortizedPayment(exp.correctedBalanceNoAddonsCents, 0.0499, 48);
    expect(Math.abs(p - exp.paymentAt499For48Cents)).toBeLessThanOrEqual(exp.paymentToleranceCents);
  });

  it("revision 2 (allowance up to 23,500, selling price up to 60,714) fires trade_up_price_up", () => {
    const rev2: Offer = { ...(fixture.offer as Offer), sellingPriceCents: fixture.revision2.sellingPriceCents, tradeAllowanceCents: fixture.revision2.tradeAllowanceCents };
    const r = evaluateDeal(buildInput({ offer: rev2, previousOffer: fixture.offer as Offer }));
    const flag = r.flags.find((f) => f.code === "trade_up_price_up");
    expect(flag).toBeDefined();
    expect(flag?.impactCents).toBe(200000);
    expect(r.revisionDiff?.tradeAllowanceDelta).toBe(200000);
    expect(r.revisionDiff?.sellingPriceDelta).toBe(200000);
  });

  it("carbon neutral program is flagged as a junk fee / add-on not on the sticker", () => {
    const f = report.flags.find((x) => x.code === "junk_fee" || x.code === "addon_not_on_sticker");
    expect(f).toBeDefined();
    expect(f?.impactCents).toBe(20000);
  });

  it("verdict is keep negotiating and the derivation of every headline number lists its inputs", () => {
    expect(report.verdict.band).toBe("keep_negotiating");
    expect(report.complete).toBe(true);
    for (const d of [report.price.allIn, report.price.otd, report.tax.computedTax, report.trade.breakEvenAllowance]) {
      expect(d.formula.length).toBeGreaterThan(0);
      expect(d.inputs.length).toBeGreaterThan(0);
    }
  });

  it("flags that should stay quiet stay quiet", () => {
    const codes = new Set(report.flags.map((f) => f.code));
    for (const quiet of ["payment_only_quote", "sticker_mismatch", "vin_invalid", "rebate_absorbed", "payment_gap", "quote_expired", "outside_offer_expired", "payoff_expired", "trade_up_price_up", "tax_rule_reverify", "grid_inconsistent"]) {
      expect(codes.has(quiet), quiet).toBe(false);
    }
  });
});
