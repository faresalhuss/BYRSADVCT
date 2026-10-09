"use client";

import { useSyncExternalStore } from "react";

const KEY = "byrsadvct:theme";
type Theme = "dark" | "light";

function read(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark";
}
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
function setTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem(KEY, t);
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, read, () => "dark" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button type="button" className={`btn btn-quiet btn-sm ${className}`} onClick={() => setTheme(next)} aria-label={`Switch to ${next} theme`} title={`Switch to ${next} theme`}>
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}
function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
