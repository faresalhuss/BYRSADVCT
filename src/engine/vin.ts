/**
 * VIN check-digit validation (ISO 3779 / 49 CFR 565).
 */

const TRANSLITERATION: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
  "0": 0, "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9,
};

const WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];

export function normalizeVin(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Returns the expected check digit character for a 17-character VIN, or null if malformed. */
export function expectedCheckDigit(vin: string): string | null {
  const v = normalizeVin(vin);
  if (v.length !== 17) return null;
  if (/[IOQ]/.test(v)) return null;
  let sum = 0;
  for (let i = 0; i < 17; i += 1) {
    const ch = v[i]!;
    const n = TRANSLITERATION[ch];
    if (n === undefined) return null;
    sum += n * WEIGHTS[i]!;
  }
  const remainder = sum % 11;
  return remainder === 10 ? "X" : String(remainder);
}

export interface VinCheck {
  vin: string;
  valid: boolean;
  checkDigit: string | null;
  expected: string | null;
  reason: string | null;
}

export function checkVin(raw: string | null): VinCheck | null {
  if (raw === null || raw.trim() === "") return null;
  const vin = normalizeVin(raw);
  if (vin.length !== 17) {
    return { vin, valid: false, checkDigit: null, expected: null, reason: `VIN has ${vin.length} characters, needs 17` };
  }
  if (/[IOQ]/.test(vin)) {
    return { vin, valid: false, checkDigit: vin[8] ?? null, expected: null, reason: "VIN contains I, O or Q, which are never used" };
  }
  const expected = expectedCheckDigit(vin);
  const actual = vin[8] ?? null;
  const valid = expected !== null && actual === expected;
  return {
    vin,
    valid,
    checkDigit: actual,
    expected,
    reason: valid ? null : `Check digit is ${actual}, expected ${expected}`,
  };
}

/** Model year letter in position 10 per 49 CFR 565 (2010 to 2039 cycle). */
const YEAR_CODES = "ABCDEFGHJKLMNPRSTVWXY123456789";
export function modelYearFromVin(vin: string, assumeAfter2009 = true): number | null {
  const v = normalizeVin(vin);
  if (v.length !== 17) return null;
  const idx = YEAR_CODES.indexOf(v[9]!);
  if (idx < 0) return null;
  return (assumeAfter2009 ? 2010 : 1980) + idx;
}
