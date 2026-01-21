"use client";

import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { useState, useTransition, useEffect } from "react";
import { updateDeck } from "../actions";
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

interface DeckData {
  id: string;
  name: string;
  format: string;
  commander1: string | null;
  commander2: string | null;
  bracket: number | null;
  decklistUrl: string | null;
}

export default function EditDeckPage() {
  const router = useRouter();
  const params = useParams();
  const deckId = params.id as string;

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deck, setDeck] = useState<DeckData | null>(null);
  const [format, setFormat] = useState<MtgFormat>("commander");

  useEffect(() => {
    async function loadDeck() {
      try {
        const res = await fetch(`/api/decks/${deckId}`);
        if (!res.ok) {
          router.push("/decks");
          return;
        }
        const data = await res.json();
        setDeck(data);
        setFormat(data.format as MtgFormat);
      } catch {
        router.push("/decks");
      } finally {
        setLoading(false);
      }
    }
    loadDeck();
  }, [deckId, router]);

  const showCommander = isCommanderFormat(format);
  const showBracket = hasBrackets(format);

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateDeck(deckId, formData);
      if ("error" in result) {
        setError(result.error);
      } else {
        router.push(`/decks/${deckId}`);
      }
    });
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  if (!deck) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-amber-500">
            Karakas
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/decks" className="text-zinc-100 font-medium">
              Decks
            </Link>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <Link
              href={`/decks/${deckId}`}
              className="text-zinc-400 hover:text-zinc-300 text-sm"
            >
              ← Back to Deck
            </Link>
            <h1 className="text-3xl font-bold mt-4">Edit Deck</h1>
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
                defaultValue={deck.name}
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
                  <input
                    type="text"
                    id="commander1"
                    name="commander1"
                    defaultValue={deck.commander1 || ""}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
                    placeholder="e.g., Urza, Lord High Artificer"
                  />
                </div>

                <div>
                  <label
                    htmlFor="commander2"
                    className="block text-sm font-medium text-zinc-300 mb-2"
                  >
                    Partner Commander (optional)
                  </label>
                  <input
                    type="text"
                    id="commander2"
                    name="commander2"
                    defaultValue={deck.commander2 || ""}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
                    placeholder="e.g., Thrasios, Triton Hero"
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
                  defaultValue={deck.bracket?.toString() || ""}
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
                defaultValue={deck.decklistUrl || ""}
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
                {isPending ? "Saving..." : "Save Changes"}
              </button>
              <Link
                href={`/decks/${deckId}`}
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
