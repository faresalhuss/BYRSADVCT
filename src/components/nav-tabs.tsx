"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const TABS = [
  { href: "/", label: "Deals", match: (p: string) => p === "/" || p.startsWith("/deals") },
  { href: "/compare", label: "Compare", match: (p: string) => p.startsWith("/compare") },
  { href: "/trade", label: "Trade", match: (p: string) => p.startsWith("/trade") },
  { href: "/benchmarks", label: "Benchmarks", match: (p: string) => p.startsWith("/benchmarks") },
  { href: "/settings", label: "Settings", match: (p: string) => p.startsWith("/settings") },
] as const;

/** Tab list with the active tab marked. Reads the pathname, so it renders inside a Suspense boundary. */
export function NavTabs({ variant, pathname }: { variant: "top" | "bottom"; pathname?: string | null }) {
  const livePath = usePathname();
  const path = pathname === undefined ? livePath : pathname;
  return (
    <ul className={variant === "top" ? "flex gap-1" : "grid grid-cols-5"}>
      {TABS.map((t) => {
        const active = path !== null && t.match(path);
        return (
          <li key={t.href}>
            {variant === "top" ? (
              <Link href={t.href} aria-current={active ? "page" : undefined} className={`tap inline-flex items-center rounded-sm px-3 text-sm font-medium ${active ? "bg-accent-bg text-accent" : "text-ink-2 hover:text-ink"}`}>
                {t.label}
              </Link>
            ) : (
              <Link href={t.href} aria-current={active ? "page" : undefined} className={`flex h-14 flex-col items-center justify-center text-xs font-medium ${active ? "text-accent" : "text-ink-2"}`}>
                <span aria-hidden="true" className={`mb-1 h-1 w-6 rounded-full ${active ? "bg-accent" : "bg-transparent"}`} />
                {t.label}
              </Link>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Same markup without the pathname read, used as the Suspense fallback. */
export function NavTabsStatic({ variant }: { variant: "top" | "bottom" }) {
  return (
    <ul className={variant === "top" ? "flex gap-1" : "grid grid-cols-5"}>
      {TABS.map((t) => (
        <li key={t.href}>
          {variant === "top" ? (
            <Link href={t.href} className="tap inline-flex items-center rounded-sm px-3 text-sm font-medium text-ink-2">
              {t.label}
            </Link>
          ) : (
            <Link href={t.href} className="flex h-14 flex-col items-center justify-center text-xs font-medium text-ink-2">
              <span aria-hidden="true" className="mb-1 h-1 w-6 rounded-full bg-transparent" />
              {t.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
