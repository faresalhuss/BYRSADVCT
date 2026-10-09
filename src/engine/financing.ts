import { amortizedPayment, impliedApr, paymentGap, totalInterest } from "./finance";
import { derived, input } from "./money";
import type { Cents, DealReport, GridRowAudit, Offer, Settings } from "./types";

export interface FinancingInputs {
  offer: Offer;
  settings: Settings;
}

export function gridPrincipalCents(offer: Offer): Cents | null {
  return offer.gridPrincipalCents ?? offer.statedBalanceCents ?? null;
}

export function auditGrid(offer: Offer, settings: Settings): GridRowAudit[] {
  const principal = gridPrincipalCents(offer);
  const byTerm = new Map<number, Offer["paymentGrid"]>();
  for (const cell of offer.paymentGrid) {
    const list = byTerm.get(cell.termMonths) ?? [];
    list.push(cell);
    byTerm.set(cell.termMonths, list);
  }
  const rows: GridRowAudit[] = [];
  for (const [termMonths, cells] of [...byTerm.entries()].sort((a, b) => a[0] - b[0])) {
    const audited = cells
      .slice()
      .sort((a, b) => a.cashDownCents - b.cashDownCents)
      .map((c) => {
        const p = principal === null ? null : principal - c.cashDownCents;
        return {
          id: c.id,
          cashDownCents: c.cashDownCents,
          principalCents: p ?? 0,
          paymentCents: c.paymentCents,
          impliedApr: p === null ? null : impliedApr(p, c.paymentCents, termMonths),
        };
      });
    const aprs = audited.map((c) => c.impliedApr).filter((v): v is number => v !== null);
    const rowApr = aprs.length === 0 ? null : aprs.reduce((s, v) => s + v, 0) / aprs.length;
    const consistent = aprs.length < 2 ? null : Math.max(...aprs) - Math.min(...aprs) <= settings.gridRowAprTolerance;
    rows.push({ termMonths, cells: audited, impliedApr: rowApr === null ? null : Math.round(rowApr * 1e5) / 1e5, consistent });
  }
  return rows;
}

export function analyzeFinancing(f: FinancingInputs): DealReport["financing"] {
  const { offer, settings } = f;
  const principalCents = gridPrincipalCents(offer);
  const gridPrincipal = derived(
    "fin.gridPrincipal",
    "Principal behind the payment grid",
    principalCents,
    "cents",
    offer.gridPrincipalCents !== null && offer.gridPrincipalCents !== undefined ? "stated on the worksheet" : "dealer's stated balance (before cash down)",
    [input("Stated balance", offer.statedBalanceCents ?? null, "cents", "worksheet")],
    "Each grid column subtracts its cash down from this principal.",
  );

  const quotes = offer.financing.map((q) => {
    const p = q.amountFinancedCents ?? (principalCents === null || q.cashDownCents === null ? principalCents : principalCents - q.cashDownCents);
    const principal = derived("fin.principal", "Amount financed", p, "cents", q.amountFinancedCents !== null ? "stated amount financed" : "stated balance - cash down", [
      input("Amount financed", q.amountFinancedCents, "cents", q.source),
      input("Stated balance", principalCents, "cents", "worksheet"),
      input("Cash down", q.cashDownCents, "cents", q.source),
    ]);
    const canCompute = p !== null && q.apr !== null && q.termMonths !== null && q.termMonths > 0 && p > 0;
    const computed = canCompute ? amortizedPayment(p, q.apr!, q.termMonths!) : null;
    const computedPayment = derived(
      "fin.computedPayment",
      "Computed payment at stated APR",
      computed,
      "cents",
      "standard amortization: P x i / (1 - (1 + i)^-n), i = APR / 12",
      [input("Principal", p, "cents", "computed"), input("APR", q.apr, "rate", q.source), input("Term", q.termMonths, "months", q.source)],
    );
    const quotedPayment = derived("fin.quotedPayment", "Quoted payment", q.paymentCents, "cents", "payment on the worksheet", [
      input("Quoted payment", q.paymentCents, "cents", q.source),
    ]);
    const gapInfo = canCompute && q.paymentCents !== null ? paymentGap(p, q.apr!, q.termMonths!, q.paymentCents) : null;
    const gap = derived("fin.gap", "Payment gap", gapInfo?.gapCents ?? null, "cents", "quoted payment - computed payment", [
      input("Quoted payment", q.paymentCents, "cents", q.source),
      input("Computed payment", computed, "cents", "computed"),
    ]);
    const hiddenPrincipal = derived(
      "fin.hiddenPrincipal",
      "Hidden principal implied by the gap",
      gapInfo?.hiddenPrincipalCents ?? null,
      "cents",
      "present value of the quoted payment at the stated APR - stated principal",
      [input("Quoted payment", q.paymentCents, "cents", q.source), input("APR", q.apr, "rate", q.source), input("Term", q.termMonths, "months", q.source), input("Principal", p, "cents", "computed")],
    );
    const interest = canCompute && q.paymentCents !== null ? totalInterest(p, q.paymentCents, q.termMonths!) : canCompute && computed !== null ? totalInterest(p, computed, q.termMonths!) : null;
    const totalInterestD = derived("fin.totalInterest", "Total interest", interest, "cents", "payment x term - principal", [
      input("Payment", q.paymentCents ?? computed, "cents", q.paymentCents !== null ? q.source : "computed"),
      input("Term", q.termMonths, "months", q.source),
      input("Principal", p, "cents", "computed"),
    ]);
    return {
      id: q.id,
      lender: q.lender,
      apr: q.apr,
      termMonths: q.termMonths,
      principal,
      computedPayment,
      quotedPayment,
      gap,
      hiddenPrincipal,
      totalInterest: totalInterestD,
    };
  });

  return { quotes, grid: auditGrid(offer, settings), gridPrincipal };
}
