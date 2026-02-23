"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createPlaygroup } from "../actions";
import { MTG_FORMATS, FORMAT_LABELS, type MtgFormat } from "@/types/mtg";
import { Header } from "@/components/header";
import { AlertMessage } from "@/components/alert-message";

export function NewPlaygroupForm({ username }: { username: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const name = formData.get("name") as string;
    const description = formData.get("description") as string;
    const defaultFormat = formData.get("defaultFormat") as MtgFormat | "";

    startTransition(async () => {
      const result = await createPlaygroup({
        name,
        description: description || undefined,
        defaultFormat: defaultFormat || undefined,
      });

      if ("error" in result && result.error) {
        setError(result.error);
      } else if ("playgroupId" in result) {
        router.push(`/playgroups/${result.playgroupId}`);
      }
    });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header username={username} activeTab="playgroups" />

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-xl mx-auto">
          <div className="mb-8">
            <Link
              href="/playgroups"
              className="text-zinc-400 hover:text-zinc-300 text-sm"
            >
              ← Back to Playgroups
            </Link>
            <h1 className="text-3xl font-bold mt-4">Create Playgroup</h1>
            <p className="text-zinc-400 mt-2">
              Set up a new playgroup to organize games with your friends.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && <AlertMessage variant="error">{error}</AlertMessage>}

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
              {/* Name */}
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-zinc-300 mb-2"
                >
                  Playgroup Name *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  required
                  maxLength={100}
                  placeholder="e.g., Friday Night Commander"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                />
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-zinc-300 mb-2"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  name="description"
                  rows={3}
                  placeholder="What's this playgroup about?"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                />
              </div>

              {/* Default Format */}
              <div>
                <label
                  htmlFor="defaultFormat"
                  className="block text-sm font-medium text-zinc-300 mb-2"
                >
                  Default Format
                </label>
                <select
                  id="defaultFormat"
                  name="defaultFormat"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="">No default format</option>
                  {MTG_FORMATS.map((format) => (
                    <option key={format} value={format}>
                      {FORMAT_LABELS[format]}
                    </option>
                  ))}
                </select>
                <p className="text-zinc-500 text-sm mt-1">
                  This will be pre-selected when creating new games
                </p>
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 disabled:cursor-not-allowed text-white py-3 rounded-lg transition-colors font-semibold"
              >
                {isPending ? "Creating..." : "Create Playgroup"}
              </button>
              <Link
                href="/playgroups"
                className="border border-zinc-700 hover:border-zinc-500 text-zinc-300 px-6 py-3 rounded-lg transition-colors text-center"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
