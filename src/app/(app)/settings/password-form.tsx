"use client";

import { useActionState } from "react";
import { changePassword, type PasswordState } from "@/app/login/actions";

const initial: PasswordState = { status: "idle" };

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, initial);
  return (
    <form action={action} className="mt-3 flex max-w-sm flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">New password</span>
        <input name="password" type="password" autoComplete="new-password" minLength={10} required className="field" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Repeat it</span>
        <input name="confirm" type="password" autoComplete="new-password" minLength={10} required className="field" />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Saving" : "Change password"}
        </button>
        <span className={`text-sm ${state.status === "error" ? "text-flag" : "text-ink-2"}`} role="status">
          {state.status === "saved" ? "Password changed" : state.status === "error" ? state.message : ""}
        </span>
      </div>
    </form>
  );
}
