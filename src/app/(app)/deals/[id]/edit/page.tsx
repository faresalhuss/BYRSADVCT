import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { DealEditor } from "@/components/editor/deal-editor";
import { getDeal, getSettingsBundle, getTradeBundle, parseDecoded, parseOffer, parseSticker, parseVehicle, EMPTY_OFFER } from "@/db/queries";
import type { DealForm } from "@/domain/schemas";
import { todayIso } from "@/lib/dates";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Edit deal" };

export default function EditDealPage(props: PageProps<"/deals/[id]/edit">) {
  return (
    <main>
      <PageHeader crumb={{ href: "/", label: "Deals" }} title="Edit deal" description="Saving a changed offer creates a new revision. The old one stays in the history." />
      <Suspense fallback={<div className="skeleton h-64" aria-hidden="true" />}>
        <Editor params={props.params} />
      </Suspense>
    </main>
  );
}

async function Editor({ params }: { params: PageProps<"/deals/[id]/edit">["params"] }) {
  const { id } = await params;
  const [d, settings, trade] = await Promise.all([getDeal(id), getSettingsBundle(), getTradeBundle()]);
  if (!d) notFound();
  const initial: DealForm = {
    dealershipName: d.deal.dealership_name,
    dealershipAddress: d.deal.dealership_address,
    dealershipPhone: d.deal.dealership_phone,
    dealershipWebsite: d.deal.dealership_website,
    salesperson: d.deal.salesperson,
    status: d.deal.status as DealForm["status"],
    quoteExpiresOn: d.deal.quote_expires_on,
    vehicle: parseVehicle(d.deal.vehicle),
    decoded: parseDecoded(d.deal.decoded),
    sticker: parseSticker(d.deal.sticker),
    offer: d.latest ? parseOffer(d.latest.offer) : EMPTY_OFFER,
    revisionNote: null,
  };
  return <DealEditor mode="edit" dealId={id} initial={initial} previousOffer={d.latest ? parseOffer(d.latest.offer) : null} context={{ taxRule: settings.taxRule, settings: settings.settings, trade: trade.profile, today: todayIso(), importEnabled: false, openImport: false }} />;
}
