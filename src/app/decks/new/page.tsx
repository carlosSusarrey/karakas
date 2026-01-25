"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createDeck } from "./actions";
import {
  MTG_FORMATS,
  FORMAT_LABELS,
  EDH_BRACKETS,
  BRACKET_DESCRIPTIONS,
  isCommanderFormat,
  hasBrackets,
  type MtgFormat,
  type EdhBracket,
} from "@/types/mtg";
import { Header } from "@/components/header";
import { CardAutocomplete } from "@/components/card-autocomplete";

export default function NewDeckPage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<MtgFormat>("commander");
  const [commander1, setCommander1] = useState("");
  const [commander2, setCommander2] = useState("");

  const showCommander = isCommanderFormat(format);
  const showBracket = hasBrackets(format);

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createDeck(formData);
      if ("error" in result) {
        setError(result.error);
      } else {
        router.push("/decks");
      }
    });
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header activeTab="decks" />

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <Link
              href="/decks"
              className="text-zinc-400 hover:text-zinc-300 text-sm"
            >
              ← Back to Decks
            </Link>
            <h1 className="text-3xl font-bold mt-4">Create New Deck</h1>
          </div>

          <form action={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-900/50 border border-red-800 text-red-200 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Deck Name */}
            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium text-zinc-300 mb-2"
              >
                Deck Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                required
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
                placeholder="e.g., Urza Stax"
              />
            </div>

            {/* Format */}
            <div>
              <label
                htmlFor="format"
                className="block text-sm font-medium text-zinc-300 mb-2"
              >
                Format *
              </label>
              <select
                id="format"
                name="format"
                required
                value={format}
                onChange={(e) => setFormat(e.target.value as MtgFormat)}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
              >
                {MTG_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {FORMAT_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>

            {/* Commander (conditional) */}
            {showCommander && (
              <>
                <div>
                  <label
                    htmlFor="commander1"
                    className="block text-sm font-medium text-zinc-300 mb-2"
                  >
                    Commander
                  </label>
                  <CardAutocomplete
                    id="commander1"
                    name="commander1"
                    value={commander1}
                    onChange={setCommander1}
                    placeholder="e.g., Urza, Lord High Artificer"
                    commanderOnly={true}
                    showPreview={true}
                  />
                </div>

                <div>
                  <label
                    htmlFor="commander2"
                    className="block text-sm font-medium text-zinc-300 mb-2"
                  >
                    Partner Commander (optional)
                  </label>
                  <CardAutocomplete
                    id="commander2"
                    name="commander2"
                    value={commander2}
                    onChange={setCommander2}
                    placeholder="e.g., Thrasios, Triton Hero"
                    commanderOnly={true}
                    showPreview={true}
                  />
                </div>
              </>
            )}

            {/* Bracket (conditional) */}
            {showBracket && (
              <div>
                <label
                  htmlFor="bracket"
                  className="block text-sm font-medium text-zinc-300 mb-2"
                >
                  EDH Bracket
                </label>
                <select
                  id="bracket"
                  name="bracket"
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
                >
                  <option value="">Select bracket...</option>
                  {EDH_BRACKETS.map((b) => (
                    <option key={b} value={b}>
                      Bracket {b} - {BRACKET_DESCRIPTIONS[b as EdhBracket]}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Decklist URL */}
            <div>
              <label
                htmlFor="decklistUrl"
                className="block text-sm font-medium text-zinc-300 mb-2"
              >
                Decklist URL (optional)
              </label>
              <input
                type="url"
                id="decklistUrl"
                name="decklistUrl"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
                placeholder="e.g., https://moxfield.com/decks/..."
              />
              <p className="text-zinc-500 text-sm mt-1">
                Link to your decklist on Moxfield, Archidekt, etc.
              </p>
            </div>

            {/* Submit */}
            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={isPending}
                className="bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors"
              >
                {isPending ? "Creating..." : "Create Deck"}
              </button>
              <Link
                href="/decks"
                className="border border-zinc-700 hover:border-zinc-500 text-zinc-300 px-6 py-2 rounded-lg transition-colors"
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
