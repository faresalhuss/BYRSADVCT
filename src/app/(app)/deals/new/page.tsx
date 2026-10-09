import type { Metadata } from "next";
import { Suspense } from "react";
import { DealEditor } from "@/components/editor/deal-editor";
import { EMPTY_OFFER, EMPTY_STICKER, EMPTY_VEHICLE, getSettingsBundle, getTradeBundle } from "@/db/queries";
import type { DealForm } from "@/domain/schemas";
import { todayIso } from "@/lib/dates";

export const metadata: Metadata = { title: "New deal" };

export default function NewDealPage() {
  return (
    <main>
      <h1 className="text-3xl">New deal</h1>
      <p className="mt-1 text-sm text-ink-2">Enter the offer line by line. Everything recalculates as you type.</p>
      <Suspense fallback={<p className="mt-4 text-ink-2">Loading</p>}>
        <Editor />
      </Suspense>
    </main>
  );
}

async function Editor() {
  const [settings, trade] = await Promise.all([getSettingsBundle(), getTradeBundle()]);
  const initial: DealForm = {
    dealershipName: "",
    dealershipAddress: null,
    dealershipPhone: null,
    dealershipWebsite: null,
    salesperson: null,
    status: "verbal",
    quoteExpiresOn: null,
    vehicle: { ...EMPTY_VEHICLE, year: 2026, make: "Toyota", model: "4Runner", trim: "TRD Off-Road Premium", powertrain: null },
    decoded: null,
    sticker: EMPTY_STICKER,
    offer: EMPTY_OFFER,
    revisionNote: null,
  };
  return <DealEditor mode="new" dealId={null} initial={initial} previousOffer={null} context={{ taxRule: settings.taxRule, settings: settings.settings, trade: trade.profile, today: todayIso() }} />;
}
