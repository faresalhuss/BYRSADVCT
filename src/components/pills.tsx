import type { FlagSeverity, Verdict } from "@/engine";

export function StatusPill({ status }: { status: string }) {
  const cls = status === "written" ? "pill-accent" : status === "expired" ? "pill-flag" : "pill-info";
  return <span className={`pill ${cls}`}>{status}</span>;
}

export function VerdictPill({ band }: { band: Verdict["band"] }) {
  switch (band) {
    case "strong":
      return <span className="pill pill-good">Strong</span>;
    case "beats_best":
      return <span className="pill pill-good">Beats best</span>;
    case "keep_negotiating":
      return <span className="pill pill-caution">Keep negotiating</span>;
    default:
      return <span className="pill pill-info">Incomplete</span>;
  }
}

export function SeverityPill({ severity }: { severity: FlagSeverity }) {
  const cls = severity === "flag" ? "pill-flag" : severity === "caution" ? "pill-caution" : "pill-info";
  const label = severity === "flag" ? "Flag" : severity === "caution" ? "Caution" : "Info";
  return <span className={`pill ${cls}`}>{label}</span>;
}
