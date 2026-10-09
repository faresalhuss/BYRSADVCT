"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signInWithPassword, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

export function LoginForm() {
  const params = useSearchParams();
  const reason = params.get("reason");
  const next = params.get("next") ?? "/";
  const [state, action, pending] = useActionState(signInWithPassword, initial);

  return (
    <form action={action} className="mt-8 flex flex-col gap-4">
      {reason === "not-allowed" && (
        <p className="rounded-sm bg-flag-bg px-3 py-2 text-flag" role="alert">
          That email address is not on the allowlist.
        </p>
      )}
      <input type="hidden" name="next" value={next} />
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Email</span>
        <input name="email" type="email" inputMode="email" autoComplete="username" autoCapitalize="none" required className="field" aria-invalid={state.status === "error" ? "true" : undefined} aria-describedby={state.status === "error" ? "login-error" : undefined} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Password</span>
        <input name="password" type="password" autoComplete="current-password" required className="field" aria-invalid={state.status === "error" ? "true" : undefined} aria-describedby={state.status === "error" ? "login-error" : undefined} />
      </label>
      {state.status === "error" && (
        <p id="login-error" className="text-sm text-flag" role="alert">
          {state.message}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
