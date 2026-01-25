"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  MTG_FORMATS,
  FORMAT_LABELS,
  COMMANDER_FORMATS,
  BRACKET_FORMATS,
  EDH_BRACKETS,
  BRACKET_DESCRIPTIONS,
  type MtgFormat,
  type EdhBracket,
} from "@/types/mtg";
import { createPlaygroupPlayerDeck } from "./actions";

type Props = {
  playerId: string;
};

export function DeckForm({ playerId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [format, setFormat] = useState<MtgFormat>("commander");

  const showCommanderFields = COMMANDER_FORMATS.includes(format);
  const showBracketField = BRACKET_FORMATS.includes(format);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await createPlaygroupPlayerDeck(playerId, formData);

      if ("error" in result) {
        setError(result.error);
      } else {
        setShowForm(false);
        router.refresh();
      }
    });
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg transition-colors"
      >
        + Add Deck
      </button>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h2 className="text-lg font-semibold mb-4">Add New Deck</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-900/50 border border-red-800 text-red-200 px-3 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-zinc-300 mb-1"
            >
              Deck Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              placeholder="e.g., Krenko Goblins"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
              required
            />
          </div>

          <div>
            <label
              htmlFor="format"
              className="block text-sm font-medium text-zinc-300 mb-1"
            >
              Format *
            </label>
            <select
              id="format"
              name="format"
              value={format}
              onChange={(e) => setFormat(e.target.value as MtgFormat)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
            >
              {MTG_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {FORMAT_LABELS[f]}
                </option>
              ))}
            </select>
          </div>
        </div>

        {showCommanderFields && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="commander1"
                className="block text-sm font-medium text-zinc-300 mb-1"
              >
                Commander
              </label>
              <input
                type="text"
                id="commander1"
                name="commander1"
                placeholder="e.g., Krenko, Mob Boss"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>

            <div>
              <label
                htmlFor="commander2"
                className="block text-sm font-medium text-zinc-300 mb-1"
              >
                Partner Commander
              </label>
              <input
                type="text"
                id="commander2"
                name="commander2"
                placeholder="If using partners"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
              />
            </div>
          </div>
        )}

        {showBracketField && (
          <div>
            <label
              htmlFor="bracket"
              className="block text-sm font-medium text-zinc-300 mb-1"
            >
              EDH Bracket
            </label>
            <select
              id="bracket"
              name="bracket"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
            >
              <option value="">Select bracket (optional)</option>
              {EDH_BRACKETS.map((b) => (
                <option key={b} value={b}>
                  Bracket {b} - {BRACKET_DESCRIPTIONS[b as EdhBracket]}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label
            htmlFor="decklistUrl"
            className="block text-sm font-medium text-zinc-300 mb-1"
          >
            Decklist URL
          </label>
          <input
            type="url"
            id="decklistUrl"
            name="decklistUrl"
            placeholder="https://moxfield.com/decks/..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            {isPending ? "Creating..." : "Create Deck"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowForm(false);
              setError(null);
            }}
            className="text-zinc-400 hover:text-zinc-300 px-4 py-2 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
