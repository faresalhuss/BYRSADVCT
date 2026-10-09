import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Icon } from "./icons";
import { NavTabs, NavTabsStatic } from "./nav-tabs";
import { ThemeToggle } from "./theme-toggle";

export function AppShell({ children, signOutAction }: { children: ReactNode; signOutAction: () => Promise<void> }) {
  return (
    <div className="flex min-h-dvh">
      {/* Desktop rail */}
      <aside className="no-print sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-line bg-bg-elev px-3 py-4 lg:flex">
        <Link href="/" className="mb-6 flex items-center gap-2 px-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-accent-ink">
            <span className="text-sm font-bold">B</span>
          </span>
          <span className="text-sm font-semibold tracking-tight">BYRSADVCT</span>
        </Link>
        <nav aria-label="Primary" className="flex-1">
          <Suspense fallback={<NavTabsStatic variant="side" />}>
            <NavTabs variant="side" />
          </Suspense>
        </nav>
        <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
          <ThemeToggle />
          <form action={signOutAction}>
            <button type="submit" className="btn btn-quiet btn-sm text-ink-2" aria-label="Sign out" title="Sign out">
              <Icon.Logout size={16} />
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="no-print sticky top-0 z-30 flex h-12 items-center justify-between border-b border-line bg-bg/90 px-4 backdrop-blur-md lg:hidden">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-accent-ink">
              <span className="text-xs font-bold">B</span>
            </span>
            <span className="text-sm font-semibold tracking-tight">BYRSADVCT</span>
          </Link>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <form action={signOutAction}>
              <button type="submit" className="btn btn-quiet btn-sm text-ink-2" aria-label="Sign out">
                <Icon.Logout size={16} />
              </button>
            </form>
          </div>
        </header>
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:pb-10 lg:pt-8">{children}</div>
        <nav aria-label="Primary" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg-elev/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
          <Suspense fallback={<NavTabsStatic variant="bottom" />}>
            <NavTabs variant="bottom" />
          </Suspense>
        </nav>
      </div>
    </div>
  );
}
