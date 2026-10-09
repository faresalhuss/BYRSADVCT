import Link from "next/link";
import type { DealRow } from "@/db/queries";
import type { DealReport } from "@/engine";
import { formatDate } from "@/lib/dates";
import { parseVehicle } from "@/db/queries";
import { Money, Pct } from "./money";
import { StatusPill, VerdictPill } from "./pills";

export function DealCard({ deal, report, rank }: { deal: DealRow; report: DealReport; rank: number | null }) {
  const v = parseVehicle(deal.vehicle);
  const flags = report.flags.filter((f) => f.severity === "flag").length;
  const vehicle = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
  return (
    <Link href={`/deals/${deal.id}`} className="card block p-4 hover:border-accent focus-visible:border-accent">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">
            {rank !== null && <span className="mr-2 text-ink-2">#{rank}</span>}
            {deal.dealership_name}
          </p>
          <p className="truncate text-sm text-ink-2">{vehicle || "Vehicle not entered"}</p>
        </div>
        <StatusPill status={deal.status} />
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2">
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-2">All-in % SRP</dt>
          <dd className="text-lg">
            <Pct value={report.price.allInRatio.value} label="All-in as percent of total SRP" />
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-2">Out the door</dt>
          <dd className="text-lg">
            <Money cents={report.price.otd.value} label="Out the door" showCents={false} />
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-ink-2">Flags</dt>
          <dd className={`text-lg num ${flags > 0 ? "text-flag" : ""}`}>{flags}</dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-2">
        <VerdictPill band={report.verdict.band} />
        {deal.quote_expires_on && <span>Expires {formatDate(deal.quote_expires_on)}</span>}
      </div>
    </Link>
  );
}
