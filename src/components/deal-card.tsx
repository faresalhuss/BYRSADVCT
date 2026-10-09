import Link from "next/link";
import type { DealRow } from "@/db/queries";
import { parseVehicle } from "@/db/queries";
import type { DealReport, OverallRow } from "@/engine";
import { formatDate } from "@/lib/dates";
import { Money, Pct } from "./money";
import { StatusPill, VerdictPill } from "./pills";

export function DealCard({ deal, report, rank, overall }: { deal: DealRow; report: DealReport; rank: number | null; overall: OverallRow | null }) {
  const v = parseVehicle(deal.vehicle);
  const flags = report.flags.filter((f) => f.severity === "flag").length;
  const vehicle = [v.year, v.make, v.model, v.trim].filter(Boolean).join(" ");
  return (
    <Link href={`/deals/${deal.id}`} className={`card card-hover block p-4 ${rank === 1 ? "card-accent" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate font-medium">
            {rank !== null && <span className="mono text-xs text-ink-3">#{rank}</span>}
            {deal.dealership_name}
          </p>
          <p className="truncate text-sm text-ink-2">{vehicle || "Vehicle not entered"}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusPill status={deal.status} />
          {report.dealType === "lease" && <span className="pill pill-info pill-plain">lease</span>}
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-3 gap-2">
        <div className="metric">
          <dt className="eyebrow">All-in % SRP</dt>
          <dd className="metric-value num text-xl">
            <Pct value={report.price.allInRatio.value} label="All-in as percent of total SRP" />
          </dd>
        </div>
        <div className="metric">
          <dt className="eyebrow">Out the door</dt>
          <dd className="metric-value num text-xl">
            <Money cents={report.price.otd.value} label="Out the door" showCents={false} />
          </dd>
        </div>
        <div className="metric">
          <dt className="eyebrow">Flags</dt>
          <dd className={`metric-value num text-xl ${flags > 0 ? "text-flag" : "text-good"}`}>
            <span className="sr-only">Open flags: </span>
            {flags}
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-3">
        <VerdictPill band={report.verdict.band} />
        {overall && overall.rank !== null && (
          <span>
            With trade: #{overall.rank}
            {overall.gapToBestCents !== null && overall.gapToBestCents > 0 && (
              <>
                {" "}
                (+<Money cents={overall.gapToBestCents} showCents={false} />)
              </>
            )}
          </span>
        )}
        {deal.quote_expires_on && <span>Expires {formatDate(deal.quote_expires_on)}</span>}
      </div>
    </Link>
  );
}
