import { derived, input, ratio, sumKnown } from "./money";
import type { Cents, DealReport, Offer, OfferLine, Sticker } from "./types";
import type { StickerReport } from "./sticker";

export interface PriceInputs {
  offer: Offer;
  sticker: Sticker;
  stickerReport: StickerReport;
  computedTaxCents: Cents | null;
  computedTaxNoAddonsCents: Cents | null;
}

export function isDealerAddon(line: OfferLine): boolean {
  return line.category === "dealer_addon" && !line.onSticker;
}

export function analyzePrice(p: PriceInputs): DealReport["price"] {
  const { offer, stickerReport } = p;
  const selling = offer.sellingPriceCents;
  const totalSrp = stickerReport.totalSrp.value;
  const factory = stickerReport.factoryMsrpPlusDph.value;

  const sellingPrice = derived("price.selling", "Selling price", selling, "cents", "dealer's price for the vehicle before fees, tax and title", [
    input("Selling price", selling, "cents", "worksheet"),
  ]);

  const discount = selling === null || totalSrp === null ? null : totalSrp - selling;
  const discountOffSrp = derived("price.discount", "Discount off total SRP", discount, "cents", "total SRP - selling price", [
    input("Total SRP", totalSrp, "cents", "sticker"),
    input("Selling price", selling, "cents", "worksheet"),
  ]);
  const discountPct = derived("price.discountPct", "Discount off total SRP", ratio(discount, totalSrp), "ratio", "discount / total SRP", [
    input("Discount", discount, "cents", "computed"),
    input("Total SRP", totalSrp, "cents", "sticker"),
  ]);
  const vsFactory = derived(
    "price.vsFactory",
    "Selling price vs factory MSRP + DPH",
    selling === null || factory === null ? null : selling - factory,
    "cents",
    "selling price - (factory MSRP + DPH)",
    [input("Selling price", selling, "cents", "worksheet"), input("Factory MSRP + DPH", factory, "cents", "sticker")],
    "Negative means the selling price is below the manufacturer's price before distributor and dealer additions.",
  );

  const feeLines = offer.lines.filter((l) => l.category === "dealer_fee");
  const addonLines = offer.lines.filter(isDealerAddon);
  const govLines = offer.lines.filter((l) => l.category === "gov_fee");

  const fees = sumKnown(feeLines.map((l) => l.cents));
  const addons = sumKnown(addonLines.map((l) => l.cents));
  const gov = sumKnown(govLines.map((l) => l.cents));

  const dealerFees = derived(
    "price.dealerFees",
    "Dealer fees",
    fees.unknown > 0 ? null : fees.total,
    "cents",
    feeLines.map((l) => l.label).join(" + ") || "no dealer fees entered",
    feeLines.map((l) => input(l.label, l.cents, "cents", l.source)),
    fees.unknown > 0 ? `${fees.unknown} fee(s) not yet quoted` : undefined,
  );
  const dealerAddons = derived(
    "price.dealerAddons",
    "Dealer add-ons not on the sticker",
    addons.unknown > 0 ? null : addons.total,
    "cents",
    addonLines.map((l) => l.label).join(" + ") || "none",
    addonLines.map((l) => input(l.label, l.cents, "cents", l.source)),
  );

  const allInCents = selling === null || dealerFees.value === null || dealerAddons.value === null ? null : selling + dealerFees.value + dealerAddons.value;
  const allIn = derived("price.allIn", "All-in dealer price", allInCents, "cents", "selling price + dealer fees + dealer add-ons", [
    input("Selling price", selling, "cents", "worksheet"),
    input("Dealer fees", dealerFees.value, "cents", "computed"),
    input("Dealer add-ons", dealerAddons.value, "cents", "computed"),
  ]);
  const allInRatio = derived("price.allInRatio", "All-in as % of total SRP", ratio(allInCents, totalSrp), "ratio", "all-in dealer price / total SRP", [
    input("All-in dealer price", allInCents, "cents", "computed"),
    input("Total SRP", totalSrp, "cents", "sticker"),
  ]);

  const allInNoAddonsCents = selling === null || dealerFees.value === null ? null : selling + dealerFees.value;
  const allInNoAddons = derived("price.allInNoAddons", "All-in without dealer add-ons", allInNoAddonsCents, "cents", "selling price + dealer fees", [
    input("Selling price", selling, "cents", "worksheet"),
    input("Dealer fees", dealerFees.value, "cents", "computed"),
  ]);
  const allInNoAddonsRatio = derived(
    "price.allInNoAddonsRatio",
    "All-in without add-ons as % of total SRP",
    ratio(allInNoAddonsCents, totalSrp),
    "ratio",
    "(selling price + dealer fees) / total SRP",
    [input("All-in without add-ons", allInNoAddonsCents, "cents", "computed"), input("Total SRP", totalSrp, "cents", "sticker")],
  );

  const govFeesCents = gov.unknown > 0 || p.computedTaxCents === null ? null : gov.total + p.computedTaxCents;
  const govFees = derived(
    "price.govFees",
    "Government fees",
    govFeesCents,
    "cents",
    [...govLines.map((l) => l.label), "computed tax"].join(" + "),
    [...govLines.map((l) => input(l.label, l.cents, "cents", l.source)), input("Computed tax", p.computedTaxCents, "cents", "computed")],
    "Uses the computed tax, not the dealer's stated tax.",
  );

  const otdCents = allInCents === null || govFeesCents === null ? null : allInCents + govFeesCents;
  const otd = derived("price.otd", "Out the door", otdCents, "cents", "all-in dealer price + government fees (with computed tax)", [
    input("All-in dealer price", allInCents, "cents", "computed"),
    input("Government fees", govFeesCents, "cents", "computed"),
  ]);

  const govNoAddons = gov.unknown > 0 || p.computedTaxNoAddonsCents === null ? null : gov.total + p.computedTaxNoAddonsCents;
  const otdNoAddonsCents = allInNoAddonsCents === null || govNoAddons === null ? null : allInNoAddonsCents + govNoAddons;
  const otdNoAddons = derived("price.otdNoAddons", "Out the door without add-ons", otdNoAddonsCents, "cents", "all-in without add-ons + government fees (tax recomputed)", [
    input("All-in without add-ons", allInNoAddonsCents, "cents", "computed"),
    input("Government fees without add-ons", govNoAddons, "cents", "computed"),
  ]);

  return {
    sellingPrice,
    discountOffSrp,
    discountPct,
    vsFactoryMsrpDph: vsFactory,
    dealerFees,
    dealerAddons,
    allIn,
    allInRatio,
    allInNoAddons,
    allInNoAddonsRatio,
    govFees,
    otd,
    otdNoAddons,
    addonLines,
    feeLines,
    govLines,
  };
}
