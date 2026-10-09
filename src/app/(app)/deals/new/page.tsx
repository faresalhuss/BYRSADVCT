import type { Metadata } from "next";
import { Suspense } from "react";
import { DealEditor } from "@/components/editor/deal-editor";
import { EMPTY_OFFER, EMPTY_STICKER, EMPTY_VEHICLE, getSettingsBundle, getTradeBundle } from "@/db/queries";
import type { DealForm } from "@/domain/schemas";
import { todayIso } from "@/lib/dates";
import { anthropicConfigured } from "@/lib/anthropic";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "New deal" };

export default function NewDealPage(props: PageProps<"/deals/new">) {
  return (
    <main>
      <PageHeader crumb={{ href: "/", label: "Deals" }} title="New deal" description="Import the documents or enter the offer line by line. Everything recalculates as you type." />
      <Suspense fallback={<div className="skeleton h-64" aria-hidden="true" />}>
        <Editor searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function Editor({ searchParams }: { searchParams: PageProps<"/deals/new">["searchParams"] }) {
  const sp = await searchParams;
  const openImport = sp.import === "1";
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
  return <DealEditor mode="new" dealId={null} initial={initial} previousOffer={null} context={{ taxRule: settings.taxRule, settings: settings.settings, trade: trade.profile, today: todayIso(), importEnabled: anthropicConfigured(), openImport }} />;
}
