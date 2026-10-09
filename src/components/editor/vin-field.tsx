"use client";

import { useState } from "react";
import { checkVin, type VehicleDecoded, type VehicleEntered } from "@/engine";

export type VinUseField = "year" | "make" | "model" | "trim" | "powertrain";

/**
 * VIN input with live check-digit validation and an NHTSA decode shown beside what was typed.
 * Shared by the deal editor and the inquiry form so both decode the same way.
 */
export function VinField({ id = "vin", value, check, decoded, entered, onChange, onDecoded, onUse }: { id?: string; value: string; check: ReturnType<typeof checkVin>; decoded: VehicleDecoded | null; entered: VehicleEntered; onChange: (v: string) => void; onDecoded: (d: VehicleDecoded | null) => void; onUse: (field: VinUseField, value: string | number | null) => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function decode() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/vin/${encodeURIComponent(value.trim())}`);
      const json = (await res.json()) as { decoded?: VehicleDecoded; error?: string };
      if (!res.ok || !json.decoded) throw new Error(json.error ?? "Decode failed");
      onDecoded(json.decoded);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Decode failed");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <label htmlFor={id} className="text-sm font-medium">
        VIN
      </label>
      <div className="mt-1 flex gap-2">
        <input id={id} className="field num uppercase" value={value} autoCapitalize="characters" autoComplete="off" spellCheck={false} maxLength={17} aria-describedby={`${id}-status`} aria-invalid={check && !check.valid ? "true" : undefined} onChange={(e) => onChange(e.target.value)} />
        <button type="button" className="btn" onClick={decode} disabled={busy || !check || check.vin.length !== 17}>
          {busy ? "Decoding" : "Decode"}
        </button>
      </div>
      <p id={`${id}-status`} className={`mt-1 text-xs ${check && !check.valid ? "text-flag" : "text-ink-2"}`}>
        {!check ? "17 characters; the check digit is verified as you type." : check.valid ? `Check digit ${check.checkDigit} is valid.` : check.reason}
        {err && <span className="ml-2 text-flag">{err}</span>}
      </p>
      {decoded && (
        <div className="mt-2 rounded-md border border-line bg-surface-2/50 p-3 text-sm">
          <p className="mb-2 font-medium">NHTSA decode beside what you entered</p>
          {decoded.errorCode && <p className="mb-2 text-caution">{decoded.errorCode}</p>}
          <table className="w-full">
            <thead className="text-xs uppercase text-ink-2">
              <tr>
                <th className="text-left font-medium">Field</th>
                <th className="text-left font-medium">Entered</th>
                <th className="text-left font-medium">Decoded</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ["year", "Year", entered.year, decoded.modelYear],
                  ["make", "Make", entered.make, decoded.make],
                  ["model", "Model", entered.model, decoded.model],
                  ["trim", "Trim", entered.trim, decoded.trim],
                  ["powertrain", "Powertrain", entered.powertrain, [decoded.fuelType, decoded.engine].filter(Boolean).join(", ") || null],
                ] as const
              ).map(([field, label, a, b]) => (
                <tr key={field} className="border-t border-line">
                  <td className="py-1 pr-2 text-ink-2">{label}</td>
                  <td className="py-1 pr-2">{a ?? "not entered"}</td>
                  <td className="py-1 pr-2">{b ?? "not decoded"}</td>
                  <td className="py-1 text-right">
                    {b !== null && b !== undefined && String(a ?? "") !== String(b) && (
                      <button type="button" className="btn btn-quiet btn-sm" onClick={() => onUse(field, b as string | number)}>
                        Use
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-line">
                <td className="py-1 pr-2 text-ink-2">Drive</td>
                <td className="py-1 pr-2" />
                <td className="py-1 pr-2" colSpan={2}>
                  {decoded.driveType ?? "not decoded"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
