import { formatPercent } from "./money";
import type { Flag, Settings, Verdict, VerdictDriver } from "./types";

/** Piecewise-linear base score from the all-in ratio. Every knot is visible in the drivers. */
export function baseScore(ratio: number, strong: number, beatsBest: number): number {
  const knots: [number, number][] = [
    [strong - 0.03, 100],
    [strong, 85],
    [beatsBest, 70],
    [1.0, 40],
    [1.05, 10],
  ];
  if (ratio <= knots[0]![0]) return 100;
  for (let i = 1; i < knots.length; i += 1) {
    const [x0, y0] = knots[i - 1]!;
    const [x1, y1] = knots[i]!;
    if (ratio <= x1) {
      const t = (ratio - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t;
    }
  }
  return 0;
}

export function computeVerdict(allInRatio: number | null, flags: Flag[], settings: Settings, missing: string[]): Verdict {
  const { label } = settings.thresholds;
  // Thresholds are user-editable; keep them ordered so the score stays monotone.
  const strongRatio = Math.min(settings.thresholds.strongRatio, settings.thresholds.beatsBestRatio);
  const beatsBestRatio = Math.max(settings.thresholds.strongRatio, settings.thresholds.beatsBestRatio);
  const thresholds = { strongRatio, beatsBestRatio, label };
  if (allInRatio === null) {
    return {
      band: "incomplete",
      score: null,
      headline: missing.length > 0 ? `Incomplete: missing ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? ` and ${missing.length - 3} more` : ""}` : "Incomplete",
      drivers: [],
      thresholds,
    };
  }
  const drivers: VerdictDriver[] = [];
  let score = baseScore(allInRatio, strongRatio, beatsBestRatio);
  drivers.push({ label: "All-in as % of total SRP", value: formatPercent(allInRatio), effect: Math.round(score) });

  let flagPenalty = 0;
  let cautionPenalty = 0;
  for (const f of flags) {
    if (f.severity === "flag") flagPenalty += 5;
    else if (f.severity === "caution") cautionPenalty += 2;
  }
  flagPenalty = Math.min(flagPenalty, 25);
  cautionPenalty = Math.min(cautionPenalty, 10);
  if (flagPenalty > 0) drivers.push({ label: "Open flags", value: `${flags.filter((f) => f.severity === "flag").length}`, effect: -flagPenalty });
  if (cautionPenalty > 0) drivers.push({ label: "Cautions", value: `${flags.filter((f) => f.severity === "caution").length}`, effect: -cautionPenalty });
  score = Math.max(0, Math.min(100, score - flagPenalty - cautionPenalty));

  let band: Verdict["band"];
  let headline: string;
  if (allInRatio <= strongRatio) {
    band = "strong";
    headline = `Strong: all-in is ${formatPercent(allInRatio)} of total SRP, at or below your ${formatPercent(strongRatio, 1)} target.`;
  } else if (allInRatio <= beatsBestRatio) {
    band = "beats_best";
    headline = `Beats your current best: ${formatPercent(allInRatio)} of total SRP, under ${formatPercent(beatsBestRatio, 1)}.`;
  } else {
    band = "keep_negotiating";
    headline = `Keep negotiating: ${formatPercent(allInRatio)} of total SRP is above your ${formatPercent(beatsBestRatio, 1)} line.`;
  }
  return { band, score: Math.round(score), headline, drivers, thresholds };
}
