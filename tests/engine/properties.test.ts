import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { amortizedPayment, impliedApr, presentValue, mulRate, roundHalfUp, taxableBase, GEORGIA_TAVT_2026, type Offer, type Sticker, type TradeProfile } from "@/engine";

describe("amortization invariants", () => {
  it("implied APR recovers the APR that produced the payment (to 0.02 points)", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 500_000, max: 20_000_000 }), // $5,000 to $200,000
        fc.integer({ min: 0, max: 2500 }).map((bp) => bp / 10_000), // 0% to 25%
        fc.integer({ min: 12, max: 96 }),
        (principal, apr, term) => {
          const pmt = amortizedPayment(principal, apr, term);
          const solved = impliedApr(principal, pmt, term);
          expect(solved).not.toBeNull();
          expect(Math.abs(solved! - apr)).toBeLessThanOrEqual(0.0002);
        },
      ),
      { numRuns: 300 },
    );
  });

  it("payment is monotone in APR and in principal, and at 0% equals principal / term", () => {
    fc.assert(
      fc.property(fc.integer({ min: 100_000, max: 20_000_000 }), fc.integer({ min: 1, max: 2000 }), fc.integer({ min: 12, max: 96 }), (p, bp, n) => {
        const low = amortizedPayment(p, (bp - 1) / 10_000, n);
        const high = amortizedPayment(p, bp / 10_000, n);
        expect(high).toBeGreaterThanOrEqual(low);
        expect(amortizedPayment(p + 100_00, bp / 10_000, n)).toBeGreaterThanOrEqual(high);
        expect(amortizedPayment(p, 0, n)).toBe(roundHalfUp(p / n));
      }),
    );
  });

  it("total paid never falls below principal and present value round-trips within a dollar per thousand", () => {
    fc.assert(
      fc.property(fc.integer({ min: 500_000, max: 20_000_000 }), fc.integer({ min: 0, max: 2500 }).map((bp) => bp / 10_000), fc.integer({ min: 12, max: 96 }), (p, apr, n) => {
        const pmt = amortizedPayment(p, apr, n);
        expect(pmt * n).toBeGreaterThanOrEqual(p - n); // allow half-cent rounding per payment
        const pv = presentValue(pmt, apr, n);
        expect(Math.abs(pv - p)).toBeLessThanOrEqual(n); // at most one cent per payment of rounding
      }),
    );
  });
});

describe("tax invariants", () => {
  const sticker: Sticker = { lines: [], totalSrpCents: null };
  const trade: TradeProfile = { payoffCents: null, payoffGoodThrough: null, outsideOffers: [], vinAndOwnerRecorded: true };

  it("mulRate is within half a cent of the real product and never negative for non-negative inputs", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 50_000_000 }), fc.integer({ min: 0, max: 1500 }).map((bp) => bp / 10_000), (cents, rate) => {
        const t = mulRate(cents, rate, 4);
        expect(t).toBeGreaterThanOrEqual(0);
        expect(Math.abs(t - cents * rate)).toBeLessThanOrEqual(0.5 + 1e-6);
      }),
    );
  });

  it("the taxable base is monotone in the selling price, drops by exactly the trade allowance, and never goes negative", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20_000_000 }),
        fc.integer({ min: 0, max: 500_000 }),
        fc.integer({ min: 0, max: 20_000_000 }),
        (selling, doc, allowance) => {
          const mk = (s: number, a: number | null): Offer => ({
            sellingPriceCents: s,
            lines: [{ id: "doc", label: "Doc fee", cents: doc, category: "dealer_fee", taxable: null, source: "worksheet" }],
            tradeAllowanceCents: a,
            cashDownCents: 0,
            financing: [],
            paymentGrid: [],
          });
          const noTrade = taxableBase(mk(selling, null), sticker, GEORGIA_TAVT_2026, trade).cents!;
          const withTrade = taxableBase(mk(selling, allowance), sticker, GEORGIA_TAVT_2026, trade).cents!;
          expect(noTrade).toBe(selling + doc);
          expect(withTrade).toBe(Math.max(0, selling + doc - allowance));
          expect(withTrade).toBeLessThanOrEqual(noTrade);
          const more = taxableBase(mk(selling + 1, null), sticker, GEORGIA_TAVT_2026, trade).cents!;
          expect(more).toBeGreaterThanOrEqual(noTrade);
        },
      ),
    );
  });

  it("the trade credit is worth exactly rate x allowance when the base stays positive", () => {
    fc.assert(
      fc.property(fc.integer({ min: 3_000_000, max: 20_000_000 }), fc.integer({ min: 0, max: 2_500_000 }), (selling, allowance) => {
        const mk = (a: number | null): Offer => ({ sellingPriceCents: selling, lines: [], tradeAllowanceCents: a, cashDownCents: 0, financing: [], paymentGrid: [] });
        const t0 = mulRate(taxableBase(mk(null), sticker, GEORGIA_TAVT_2026, trade).cents!, 0.07, 4);
        const t1 = mulRate(taxableBase(mk(allowance), sticker, GEORGIA_TAVT_2026, trade).cents!, 0.07, 4);
        expect(Math.abs(t0 - t1 - mulRate(allowance, 0.07, 4))).toBeLessThanOrEqual(1);
      }),
    );
  });
});
