"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./icons";

export const TABS = [
  { href: "/", label: "Deals", icon: Icon.Deals, match: (p: string) => p === "/" || p.startsWith("/deals") },
  { href: "/inquire", label: "Inquire", icon: Icon.Phone, match: (p: string) => p.startsWith("/inquire") },
  { href: "/compare", label: "Compare", icon: Icon.Compare, match: (p: string) => p.startsWith("/compare") },
  { href: "/trade", label: "Trade", icon: Icon.Trade, match: (p: string) => p.startsWith("/trade") },
  { href: "/benchmarks", label: "Benchmarks", icon: Icon.Benchmarks, match: (p: string) => p.startsWith("/benchmarks") },
  { href: "/glossary", label: "Learn", icon: Icon.Glossary, match: (p: string) => p.startsWith("/glossary") },
  { href: "/settings", label: "Settings", icon: Icon.Settings, match: (p: string) => p.startsWith("/settings") },
] as const;

/** Presentational tab list. `path` null means "no active tab" (the prerendered fallback). */
function TabList({ variant, path }: { variant: "side" | "bottom"; path: string | null }) {
  if (variant === "side") {
    return (
      <ul className="flex flex-col gap-0.5">
        {TABS.map((t) => {
          const active = path !== null && t.match(path);
          const I = t.icon;
          return (
            <li key={t.href}>
              <Link href={t.href} aria-current={active ? "page" : undefined} className="nav-item">
                <I size={17} />
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    );
  }
  // Phone bar: the four most-used destinations plus "More" for the rest.
  const primary = TABS.slice(0, 4);
  const more = TABS.slice(4);
  const moreActive = path !== null && more.some((t) => t.match(path));
  return (
    <ul className="grid grid-cols-5">
      {primary.map((t) => {
        const active = path !== null && t.match(path);
        const I = t.icon;
        return (
          <li key={t.href}>
            <Link href={t.href} aria-current={active ? "page" : undefined} className={`flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? "text-accent" : "text-ink-3"}`}>
              <I size={20} />
              {t.label}
            </Link>
          </li>
        );
      })}
      <li>
        <button type="button" popoverTarget="more-nav" className={`flex h-14 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${moreActive ? "text-accent" : "text-ink-3"}`} aria-haspopup="dialog">
          <Icon.More size={20} />
          More
        </button>
        <div id="more-nav" popover="auto" role="dialog" aria-label="More pages" className="panel mx-auto mb-16 mt-auto w-[min(92vw,22rem)] p-2 backdrop:bg-black/40">
          <ul className="flex flex-col">
            {more.map((t) => {
              const active = path !== null && t.match(path);
              const I = t.icon;
              return (
                <li key={t.href}>
                  <Link href={t.href} aria-current={active ? "page" : undefined} className="nav-item tap" onClick={() => document.getElementById("more-nav")?.hidePopover()}>
                    <I size={17} />
                    {t.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </li>
    </ul>
  );
}

/** Reads the pathname, so it must render inside a Suspense boundary. */
export function NavTabs({ variant }: { variant: "side" | "bottom" }) {
  const path = usePathname();
  return <TabList variant={variant} path={path} />;
}

/** The same markup with no active tab, used as the Suspense fallback (no hook). */
export function NavTabsStatic({ variant }: { variant: "side" | "bottom" }) {
  return <TabList variant={variant} path={null} />;
}
