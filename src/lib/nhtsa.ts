import { z } from "zod";
import type { VehicleDecoded } from "@/engine/types";

const resultSchema = z.object({
  Results: z
    .array(
      z.object({
        ModelYear: z.string().optional(),
        Make: z.string().optional(),
        Model: z.string().optional(),
        Trim: z.string().optional(),
        Series: z.string().optional(),
        FuelTypePrimary: z.string().optional(),
        ElectrificationLevel: z.string().optional(),
        EngineModel: z.string().optional(),
        DisplacementL: z.string().optional(),
        EngineCylinders: z.string().optional(),
        Turbo: z.string().optional(),
        DriveType: z.string().optional(),
        ErrorCode: z.string().optional(),
        ErrorText: z.string().optional(),
      }),
    )
    .min(1),
});

function clean(s: string | undefined): string | null {
  const t = (s ?? "").trim();
  return t === "" ? null : t;
}

export async function decodeVin(vin: string, fetchImpl: typeof fetch = fetch): Promise<VehicleDecoded> {
  const res = await fetchImpl(`https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${encodeURIComponent(vin)}?format=json`, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`NHTSA responded ${res.status}`);
  const json = resultSchema.parse(await res.json());
  const r = json.Results[0]!;
  const year = clean(r.ModelYear);
  const engineBits = [clean(r.DisplacementL) ? `${Number(r.DisplacementL).toFixed(1)}L` : null, clean(r.EngineCylinders) ? `${r.EngineCylinders}-cyl` : null, clean(r.Turbo)?.toLowerCase() === "yes" ? "turbo" : null, clean(r.EngineModel)].filter(Boolean);
  const electrification = clean(r.ElectrificationLevel);
  const fuel = [clean(r.FuelTypePrimary), electrification && !/not applicable/i.test(electrification) ? electrification : null].filter(Boolean).join(" / ");
  return {
    modelYear: year ? Number(year) : null,
    make: clean(r.Make) ? titleCase(r.Make!) : null,
    model: clean(r.Model),
    trim: clean(r.Trim),
    fuelType: fuel === "" ? null : fuel,
    engine: engineBits.length ? engineBits.join(" ") : null,
    driveType: clean(r.DriveType),
    errorCode: clean(r.ErrorCode) === "0" ? null : clean(r.ErrorText) ?? clean(r.ErrorCode),
  };
}

function titleCase(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
