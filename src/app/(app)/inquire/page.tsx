import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { MapLink } from "@/components/map-link";
import { Money } from "@/components/money";
import { EmptyState, PageHeader } from "@/components/ui";
import { listInquiries, parseVehicle } from "@/db/queries";
import { formatPercent, ratio } from "@/engine";
import { formatDate } from "@/lib/dates";

export const metadata: Metadata = { title: "Inquire" };

const STATUS: Record<string, { label: string; cls: string }> = {
  to_call: { label: "To call", cls: "pill-accent" },
  called: { label: "Called", cls: "pill-info" },
  converted: { label: "Converted", cls: "pill-good" },
  dismissed: { label: "Dismissed", cls: "pill-info" },
};

export default function InquirePage() {
  return (
    <main>
      <PageHeader
        title="Inquire"
        description="Listings worth a call. Save the VIN, stock number, trim, colors and advertised price, then convert the ones that quote into deals."
        actions={
          <Link href="/inquire/new" className="btn btn-primary">
            <Icon.Plus size={16} /> New listing
          </Link>
        }
      />
      <Suspense fallback={<div className="skeleton h-40" aria-hidden="true" />}>
        <List />
      </Suspense>
    </main>
  );
}

async function List() {
  const rows = await listInquiries();
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No listings saved yet."
        action={
          <Link href="/inquire/new" className="btn btn-primary">
            Add a listing to call about
          </Link>
        }
      >
        Paste the listing link, the VIN and the advertised price. Attach the window sticker or a screenshot if you have one.
      </EmptyState>
    );
  }
  const open = rows.filter((r) => r.status === "to_call" || r.status === "called");
  const done = rows.filter((r) => r.status === "converted" || r.status === "dismissed");
  return (
    <div className="flex flex-col gap-6">
      <ul className="rise-stagger grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {open.map((r) => (
          <Card key={r.id} r={r} />
        ))}
      </ul>
      {done.length > 0 && (
        <details>
          <summary className="tap inline-flex cursor-pointer items-center text-sm text-ink-2">Converted and dismissed ({done.length})</summary>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {done.map((r) => (
              <Card key={r.id} r={r} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function Card({ r }: { r: Awaited<ReturnType<typeof listInquiries>>[number] }) {
  const v = parseVehicle(r.vehicle);
  const st = STATUS[r.status] ?? STATUS.to_call!;
  const adv = r.advertised_price_cents === null ? null : Number(r.advertised_price_cents);
  const msrp = r.msrp_cents === null ? null : Number(r.msrp_cents);
  const pct = ratio(adv, msrp);
  return (
    <li className="card card-hover flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/inquire/${r.id}`} className="block truncate font-medium hover:text-accent">
            {r.dealership_name}
          </Link>
          <p className="truncate text-sm text-ink-2">{[v.year, v.make, v.model, v.trim].filter(Boolean).join(" ") || "Vehicle not entered"}</p>
        </div>
        <span className={`pill ${st.cls}`}>{st.label}</span>
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        <div>
          <dt className="eyebrow">Advertised</dt>
          <dd className="num text-base font-semibold">
            <Money cents={adv} label="Advertised price" />
          </dd>
        </div>
        <div>
          <dt className="eyebrow">Of MSRP</dt>
          <dd className="num text-base font-semibold">{formatPercent(pct)}</dd>
        </div>
        {v.exteriorColor && (
          <div>
            <dt className="eyebrow">Color</dt>
            <dd className="truncate">{v.exteriorColor}</dd>
          </div>
        )}
        {v.stockNumber && (
          <div>
            <dt className="eyebrow">Stock</dt>
            <dd className="num">{v.stockNumber}</dd>
          </div>
        )}
      </dl>
      <div className="flex flex-col gap-1">
        <MapLink name={r.dealership_name} address={r.address_line} city={r.city} state={r.state} zip={r.zip} />
        {r.phone && (
          <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-accent">
            <Icon.Phone size={14} /> {r.phone}
          </a>
        )}
      </div>
      <div className="mt-auto flex items-center justify-between text-xs text-ink-3">
        <span>Updated {formatDate(r.updated_at.slice(0, 10))}</span>
        {r.listing_url && (
          <a href={r.listing_url} target="_blank" rel="noreferrer" className="underline hover:text-accent">
            Listing
          </a>
        )}
      </div>
    </li>
  );
}
