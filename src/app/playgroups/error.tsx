"use client";

import Link from "next/link";

export default function PlaygroupsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-bold text-amber-500 mb-4">
          Unable to load playgroups
        </h1>
        <p className="text-zinc-400 mb-6">
          There was a problem loading your playgroups. Please try again.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={reset}
            className="bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-lg transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="border border-zinc-700 hover:border-zinc-500 text-zinc-300 px-6 py-2 rounded-lg transition-colors"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
