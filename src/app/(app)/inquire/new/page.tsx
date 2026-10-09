import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { EMPTY_VEHICLE } from "@/db/queries";
import type { InquiryForm } from "@/domain/schemas";
import { InquiryEditor } from "../inquiry-form";

export const metadata: Metadata = { title: "New listing" };

export default function NewInquiryPage() {
  const initial: InquiryForm = {
    dealershipName: "",
    addressLine: null,
    city: null,
    state: "GA",
    zip: null,
    phone: null,
    website: null,
    listingUrl: null,
    salesperson: null,
    vehicle: { ...EMPTY_VEHICLE, year: 2026, make: "Toyota", model: "4Runner", trim: "TRD Off-Road Premium" },
    advertisedPriceCents: null,
    msrpCents: null,
    notes: null,
    status: "to_call",
  };
  return (
    <main>
      <PageHeader crumb={{ href: "/inquire", label: "Inquire" }} title="New listing" description="Save a listing to call about. You can attach the window sticker and a screenshot after saving." />
      <InquiryEditor mode="new" id={null} initial={initial} />
    </main>
  );
}
