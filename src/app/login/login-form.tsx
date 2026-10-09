"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { sendMagicLink, type LoginState } from "./actions";

const initial: LoginState = { status: "idle" };

export function LoginForm() {
  const params = useSearchParams();
  const reason = params.get("reason");
  const next = params.get("next") ?? "/";
  const [state, action, pending] = useActionState(sendMagicLink, initial);

  if (state.status === "sent") {
    return (
      <div className="card mt-8 p-5" role="status">
        <p className="font-medium">Check your email.</p>
        <p className="mt-1 text-ink-2">A sign-in link was sent to {state.email}. Open it on this device.</p>
      </div>
    );
  }

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
        <input
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          required
          className="field"
          aria-invalid={state.status === "error" ? "true" : undefined}
          aria-describedby={state.status === "error" ? "login-error" : undefined}
        />
      </label>
      {state.status === "error" && (
        <p id="login-error" className="text-sm text-flag" role="alert">
          {state.message}
        </p>
      )}
      <button type="submit" className="btn btn-primary" disabled={pending}>
        {pending ? "Sending" : "Send sign-in link"}
      </button>
    </form>
  );
}
