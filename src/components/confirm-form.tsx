"use client";

import type { ReactNode } from "react";

/** A server-action form that asks before it submits. Used for archive and delete. */
export function ConfirmForm({ action, message, className, children }: { action: () => Promise<void>; message: string; className?: string; children: ReactNode }) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
