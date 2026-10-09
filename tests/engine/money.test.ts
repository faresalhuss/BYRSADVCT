import { describe, expect, it } from "vitest";
import { formatCents, mulRate, parseMoney, roundHalfUp, divByOnePlusRate, checkVin, expectedCheckDigit, diffOffers, buildTarget } from "@/engine";
import type { Offer } from "@/engine";

describe("parseMoney", () => {
  it.each([
    ["$58,714.00", 5871400],
    ["58714", 5871400],
    ["58.7k", 5870000],
    ["58,714.5", 5871450],
    ["1 505", 150500],
    ["(1,505.00)", -150500],
    ["-1,505", -150500],
    ["$0", 0],
    ["0.07", 7],
    ["2.5k", 250000],
    ["1.234", 123],
    ["1.235", 124],
  ])("parses %s", (text, cents) => {
    expect(parseMoney(text)).toBe(cents);
  });
  it.each(["", "abc", "$", "..", "12.3.4", null, undefined])("rejects %s", (text) => {
    expect(parseMoney(text as string)).toBeNull();
  });
});

describe("formatCents", () => {
  it("formats negatives with a leading minus, never parentheses", () => {
    expect(formatCents(-150500)).toBe("-$1,505.00");
    expect(formatCents(5987000)).toBe("$59,870.00");
    expect(formatCents(null)).toBe("not yet quoted");
    expect(formatCents(49500, { signAlways: true })).toBe("+$495.00");
  });
});

describe("rounding", () => {
  it("rounds half up", () => {
    expect(roundHalfUp(2.5)).toBe(3);
    expect(roundHalfUp(2.4999)).toBe(2);
    expect(roundHalfUp(-2.5)).toBe(-2);
  });
  it("mulRate uses integer math", () => {
    expect(mulRate(3811300, 0.07, 4)).toBe(266791);
    expect(mulRate(5961300, 0.07, 4)).toBe(417291);
    expect(mulRate(2150000, 0.07, 4)).toBe(150500);
    // 1.005 * 100 would be 100.49999 in floating point; integer math gives 101
    expect(mulRate(100, 1.005, 4)).toBe(101);
  });
  it("divByOnePlusRate matches the break-even figure", () => {
    expect(divByOnePlusRate(2350000, 0.07, 4)).toBe(2196262);
  });
});

describe("vin", () => {
  it("computes check digits", () => {
    expect(expectedCheckDigit("JTEVA5BRXT5165696")).toBe("X");
    expect(checkVin("jtevA5BRXT5165696")?.valid).toBe(true);
    expect(checkVin("JTEVA5BR0T5165696")?.valid).toBe(false);
    expect(checkVin("JTEVA5BRXT516569")?.reason).toMatch(/17/);
    expect(checkVin("JTEVA5BRXT516569O")?.reason).toMatch(/I, O or Q/);
    expect(checkVin("")).toBeNull();
  });
});

describe("revision diff", () => {
  const a: Offer = {
    sellingPriceCents: 100,
    lines: [{ id: "doc", label: "Doc fee", cents: 10, category: "dealer_fee", taxable: null, source: "worksheet" }],
    tradeAllowanceCents: 50,
    cashDownCents: 0,
    financing: [{ id: "f", lender: "X", apr: 0.05, termMonths: 48, cashDownCents: 0, amountFinancedCents: null, paymentCents: null, source: "worksheet" }],
    paymentGrid: [],
  };
  const b: Offer = { ...a, sellingPriceCents: 120, tradeAllowanceCents: 60, lines: [{ ...a.lines[0]!, cents: 15 }, { id: "n", label: "Nitrogen", cents: 5, category: "dealer_addon", taxable: null, source: "worksheet" }], financing: [{ ...a.financing[0]!, apr: 0.06 }] };
  it("diffs line by line", () => {
    const d = diffOffers(a, b);
    expect(d.sellingPriceDelta).toBe(20);
    expect(d.tradeAllowanceDelta).toBe(10);
    expect(d.dealerChargesDelta).toBe(10);
    expect(d.aprDelta).toBeCloseTo(0.01, 9);
    expect(d.lines.find((l) => l.key === "line:n")?.change).toBe("added");
    expect(d.lines.find((l) => l.key === "line:doc")?.change).toBe("changed");
    expect(d.lines.find((l) => l.key === "cashDown")?.change).toBe("same");
  });
});

describe("target builder", () => {
  it("gives the selling price to ask for and the gap", () => {
    const t = buildTarget({ targetRatio: 0.945, totalSrpCents: 6236000, sellingPriceCents: 5871400, dealerFeesCents: 95600, dealerAddonsCents: 20000 });
    expect(t.targetAllInCents).toBe(5893020);
    expect(t.targetSellingPriceCents).toBe(5893020 - 95600 - 20000);
    expect(t.targetSellingPriceNoAddonsCents).toBe(5893020 - 95600);
    expect(t.gapCents).toBe(5871400 - (5893020 - 95600 - 20000));
  });
  it("stays unknown when inputs are unknown", () => {
    const t = buildTarget({ targetRatio: 0.945, totalSrpCents: null, sellingPriceCents: 5871400, dealerFeesCents: null, dealerAddonsCents: 0 });
    expect(t.targetAllInCents).toBeNull();
    expect(t.gapCents).toBeNull();
  });
});
