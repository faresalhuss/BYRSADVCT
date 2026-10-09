import { Icon } from "./icons";

export function mapsUrl(parts: (string | null | undefined)[]): string | null {
  const q = parts.filter((p) => p && p.trim()).join(", ");
  if (!q) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** A dealership address that opens in Google Maps. Falls back to the dealership name when no address is known. */
export function MapLink({ name, address, city, state, zip, className = "" }: { name: string; address?: string | null; city?: string | null; state?: string | null; zip?: string | null; className?: string }) {
  const text = [address, [city, state].filter(Boolean).join(", "), zip].filter((p) => p && String(p).trim()).join(" · ");
  const href = mapsUrl([name, address, city, state, zip]);
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noreferrer" className={`inline-flex items-center gap-1.5 text-sm text-ink-2 underline decoration-dotted underline-offset-4 hover:text-accent ${className}`} aria-label={`Open ${name} in Google Maps`}>
      <Icon.Arrow size={14} className="rotate-[-45deg]" />
      {text || "Open in Google Maps"}
    </a>
  );
}
