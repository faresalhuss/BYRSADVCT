import { describe, expect, it } from "vitest";
import fixture from "../fixtures/golden-4runner.json";
import { DEFAULT_SETTINGS, GEORGIA_TAVT_2026, evaluateDeal, type DealInput, type Offer } from "@/engine";

const input: DealInput = {
  id: "perf",
  name: "Perf",
  sticker: fixture.sticker as DealInput["sticker"],
  vehicle: { vin: fixture.vehicle.vin, year: 2026, make: "Toyota", model: "4Runner", trim: "TRD Off-Road Premium", powertrain: "gas" },
  offer: fixture.offer as Offer,
  previousOffer: { ...(fixture.offer as Offer), sellingPriceCents: 6071400 },
  trade: fixture.trade as DealInput["trade"],
  taxRule: GEORGIA_TAVT_2026,
  settings: { ...DEFAULT_SETTINGS, preApprovalApr: 0.0599, promoRates: [{ id: "p", label: "promo", apr: 0.0499, termMonths: null, source: "x", asOf: "2026-10-01" }] },
  today: fixture.today,
};

describe("recalculation budget", () => {
  it("evaluates a full deal in under 16 ms (median of 200 runs, after warm-up)", () => {
    for (let i = 0; i < 50; i += 1) evaluateDeal(input);
    const samples: number[] = [];
    for (let i = 0; i < 200; i += 1) {
      const t0 = performance.now();
      evaluateDeal(input);
      samples.push(performance.now() - t0);
    }
    samples.sort((a, b) => a - b);
    const median = samples[Math.floor(samples.length / 2)]!;
    const p95 = samples[Math.floor(samples.length * 0.95)]!;
    console.log(`evaluateDeal median ${median.toFixed(3)} ms, p95 ${p95.toFixed(3)} ms`);
    expect(median).toBeLessThan(16);
  });
});
