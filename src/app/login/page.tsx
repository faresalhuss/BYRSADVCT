import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="rise w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-accent text-accent-ink">
            <span className="text-sm font-bold">B</span>
          </span>
          <span className="text-base font-semibold tracking-tight">BYRSADVCT</span>
        </div>
        <div className="card p-6">
          <h1 className="text-xl">Sign in</h1>
          <p className="mt-1 text-sm text-ink-2">Dealer offers, itemized and ranked. Private to the two of you.</p>
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
