import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12">
      <h1 className="text-3xl">You are offline</h1>
      <p className="mt-2 text-ink-2">Any deal you were editing is kept as a draft on this device. Reconnect and open it again to resume.</p>
      <Link href="/" className="btn mt-6 self-start">
        Try again
      </Link>
    </main>
  );
}
