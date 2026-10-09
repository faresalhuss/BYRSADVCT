import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { NavTabs, NavTabsStatic } from "./nav-tabs";

export function AppShell({ children, signOutAction }: { children: ReactNode; signOutAction: () => Promise<void> }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="no-print sticky top-0 z-30 border-b border-line bg-bg">
        <div className="mx-auto flex h-12 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link href="/" className="serif text-lg tracking-tight">
            BYRSADVCT
          </Link>
          <nav aria-label="Primary" className="hidden sm:block">
            <Suspense fallback={<NavTabsStatic variant="top" />}>
              <NavTabs variant="top" />
            </Suspense>
          </nav>
          <form action={signOutAction}>
            <button type="submit" className="btn btn-quiet btn-sm text-ink-2">
              Sign out
            </button>
          </form>
        </div>
      </header>
      <div className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-4 sm:px-6 sm:pb-8">{children}</div>
      <nav aria-label="Primary" className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden">
        <Suspense fallback={<NavTabsStatic variant="bottom" />}>
          <NavTabs variant="bottom" />
        </Suspense>
      </nav>
    </div>
  );
}
