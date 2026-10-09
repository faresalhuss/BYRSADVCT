/**
 * US phone numbers in one shape everywhere: "(404) 555-1212".
 * Numbers that are not ten digits (international, extensions) are left as typed.
 */

function digitsOf(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  return d;
}

function isInternational(raw: string): boolean {
  const t = raw.trim();
  return t.startsWith("+") && !t.startsWith("+1");
}

/** Progressive formatting for a controlled input: formats as the user types, never blocks typing. */
export function formatPhoneInput(raw: string): string {
  if (isInternational(raw)) return raw;
  const d = digitsOf(raw);
  if (d.length === 0) return "";
  if (d.length > 10) return raw.trim();
  const a = d.slice(0, 3);
  const b = d.slice(3, 6);
  const c = d.slice(6, 10);
  if (d.length <= 3) return `(${a}`;
  if (d.length <= 6) return `(${a}) ${b}`;
  return `(${a}) ${b}-${c}`;
}

/** Storage and display shape: a complete ten-digit number becomes "(404) 555-1212"; anything else is trimmed and kept. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const t = raw.trim();
  if (t === "") return null;
  if (isInternational(t)) return t;
  const d = digitsOf(t);
  return d.length === 10 ? formatPhoneInput(d) : t;
}

/** A tel: link the phone app understands. */
export function telHref(raw: string): string {
  const t = raw.trim();
  if (isInternational(t)) return `tel:${t.replace(/[^\d+]/g, "")}`;
  const d = digitsOf(t);
  return d.length === 10 ? `tel:+1${d}` : `tel:${t.replace(/[^\d+]/g, "")}`;
}
