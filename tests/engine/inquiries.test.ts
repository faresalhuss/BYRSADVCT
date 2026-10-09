import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { compareInquiries, rankInquiries, type InquiryInput } from "@/engine";

const TODAY = "2026-10-09";
const row = (p: Partial<InquiryInput> & { id: string }): InquiryInput => ({ status: "to_call", advertisedCents: null, msrpCents: null, stockDate: null, ...p });

describe("inquiry ranking", () => {
  it("orders by advertised share of MSRP, then price-only listings, then unpriced", () => {
    const rows = [
      row({ id: "unpriced" }),
      row({ id: "adv-only-high", advertisedCents: 6100000 }),
      row({ id: "pct-97", advertisedCents: 6050000, msrpCents: 6236000 }),
      row({ id: "adv-only-low", advertisedCents: 5900000 }),
      row({ id: "pct-94", advertisedCents: 5871400, msrpCents: 6236000 }),
      row({ id: "dismissed-best", advertisedCents: 5000000, msrpCents: 6236000, status: "dismissed" }),
    ];
    const ranked = rankInquiries(rows, TODAY);
    expect(ranked.map((r) => [r.id, r.rank])).toEqual([
      ["pct-94", 1],
      ["pct-97", 2],
      ["adv-only-low", 3],
      ["adv-only-high", 4],
      ["unpriced", 5],
      ["dismissed-best", null],
    ]);
    expect(ranked[0]!.reason).toBe("Advertised at 94.15% of MSRP ($58,714 against $62,360).");
    expect(ranked[2]!.reason).toMatch(/no MSRP yet/);
    expect(ranked[4]!.reason).toMatch(/No price yet/);
  });

  it("breaks ties with older stock first and mentions aged inventory", () => {
    const a = row({ id: "b-new", advertisedCents: 6000000, msrpCents: 6236000, stockDate: "2026-10-01" });
    const b = row({ id: "a-old", advertisedCents: 6000000, msrpCents: 6236000, stockDate: "2026-08-01" });
    const ranked = rankInquiries([a, b], TODAY);
    expect(ranked[0]!.id).toBe("a-old");
    expect(ranked[0]!.daysOnLot).toBe(69);
    expect(ranked[0]!.reason).toMatch(/On the lot 69 days/);
    expect(ranked[1]!.reason).not.toMatch(/On the lot/);
  });

  it("is a total order: antisymmetric, transitive and independent of input order", () => {
    const arb = fc.record({
      id: fc.uuid(),
      status: fc.constantFrom("to_call", "called"),
      advertisedCents: fc.option(fc.integer({ min: 1_000_000, max: 9_000_000 }), { nil: null }),
      msrpCents: fc.option(fc.integer({ min: 1_000_000, max: 9_000_000 }), { nil: null }),
      stockDate: fc.option(fc.constantFrom("2026-06-01", "2026-09-01", "2026-10-08"), { nil: null }),
    });
    fc.assert(
      fc.property(fc.array(arb, { minLength: 1, maxLength: 12 }), fc.array(arb, { minLength: 3, maxLength: 3 }), (rows, [a, b, c]) => {
        const ranked = rankInquiries(rows, TODAY);
        expect(ranked.map((r) => r.rank)).toEqual(rows.map((_, i) => i + 1));
        const shuffled = [...rows].reverse();
        expect(rankInquiries(shuffled, TODAY).map((r) => r.id)).toEqual(ranked.map((r) => r.id));
        const ab = compareInquiries(a!, b!, TODAY);
        expect(Math.sign(compareInquiries(b!, a!, TODAY))).toBe(-Math.sign(ab));
        if (ab <= 0 && compareInquiries(b!, c!, TODAY) <= 0) expect(compareInquiries(a!, c!, TODAY)).toBeLessThanOrEqual(0);
        // Every comparable listing ranks above every price-only one, which ranks above every unpriced one.
        const tiers = ranked.map((r) => r.tier);
        const order = { priced: 0, advertised_only: 1, unpriced: 2 };
        for (let i = 1; i < tiers.length; i += 1) expect(order[tiers[i]!]).toBeGreaterThanOrEqual(order[tiers[i - 1]!]);
      }),
      { numRuns: 300 },
    );
  });
});
