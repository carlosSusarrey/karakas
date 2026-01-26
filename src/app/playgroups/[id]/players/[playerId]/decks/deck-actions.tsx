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
import {
  updatePlaygroupPlayerDeck,
  deletePlaygroupPlayerDeck,
  toggleArchivePlaygroupPlayerDeck,
} from "./actions";
import { CardAutocomplete } from "@/components/card-autocomplete";

type Deck = {
  id: string;
  name: string;
  format: string;
  commander1: string | null;
  commander2: string | null;
  bracket: number | null;
  decklistUrl: string | null;
  isActive: boolean;
  _count: { gamePlayers: number };
};

type Props = {
  deck: Deck;
  canDelete: boolean;
};

export function DeckActions({ deck, canDelete }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<MtgFormat>(deck.format as MtgFormat);
  const [commander1, setCommander1] = useState(deck.commander1 || "");
  const [commander2, setCommander2] = useState(deck.commander2 || "");

  const showCommanderFields = COMMANDER_FORMATS.includes(format);
  const showBracketField = BRACKET_FORMATS.includes(format);

  async function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const result = await updatePlaygroupPlayerDeck(deck.id, formData);

      if ("error" in result) {
        setError(result.error);
      } else {
        setMode("view");
        router.refresh();
      }
    });
  }

  async function handleDelete() {
    setError(null);

    startTransition(async () => {
      const result = await deletePlaygroupPlayerDeck(deck.id);

      if ("error" in result) {
        setError(result.error);
        setMode("view");
      } else {
        router.refresh();
      }
    });
  }

  async function handleToggleArchive() {
    setError(null);

    startTransition(async () => {
      const result = await toggleArchivePlaygroupPlayerDeck(deck.id);

      if ("error" in result) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  if (mode === "delete") {
    return (
      <div className="flex items-center gap-2">
        {error && (
          <span className="text-red-400 text-sm">{error}</span>
        )}
        <span className="text-zinc-400 text-sm">Delete this deck?</span>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="text-red-400 hover:text-red-300 text-sm font-medium disabled:opacity-50"
        >
          {isPending ? "..." : "Yes"}
        </button>
        <button
          onClick={() => setMode("view")}
          disabled={isPending}
          className="text-zinc-400 hover:text-zinc-300 text-sm"
        >
          No
        </button>
      </div>
    );
  }

  if (mode === "edit") {
    return (
      <form onSubmit={handleEdit} className="w-full mt-3 space-y-3">
        {error && (
          <div className="bg-red-900/50 border border-red-800 text-red-200 px-3 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Deck Name</label>
            <input
              type="text"
              name="name"
              defaultValue={deck.name}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-zinc-400 mb-1">Format</label>
            <select
              name="format"
              value={format}
              onChange={(e) => setFormat(e.target.value as MtgFormat)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
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
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Commander</label>
              <CardAutocomplete
                id="edit-commander1"
                name="commander1"
                value={commander1}
                onChange={setCommander1}
                placeholder="Commander name"
                commanderOnly={true}
                showPreview={true}
                className="bg-zinc-800 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs text-zinc-400 mb-1">Partner</label>
              <CardAutocomplete
                id="edit-commander2"
                name="commander2"
                value={commander2}
                onChange={setCommander2}
                placeholder="If using partners"
                commanderOnly={true}
                showPreview={true}
                className="bg-zinc-800 text-sm"
              />
            </div>
          </div>
        )}

        {showBracketField && (
          <div>
            <label className="block text-xs text-zinc-400 mb-1">EDH Bracket</label>
            <select
              name="bracket"
              defaultValue={deck.bracket || ""}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
            >
              <option value="">No bracket</option>
              {EDH_BRACKETS.map((b) => (
                <option key={b} value={b}>
                  Bracket {b} - {BRACKET_DESCRIPTIONS[b as EdhBracket]}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs text-zinc-400 mb-1">Decklist URL</label>
          <input
            type="url"
            name="decklistUrl"
            defaultValue={deck.decklistUrl || ""}
            placeholder="https://moxfield.com/decks/..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 text-white text-sm px-3 py-1 rounded transition-colors"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("view");
              setError(null);
              setFormat(deck.format as MtgFormat);
              setCommander1(deck.commander1 || "");
              setCommander2(deck.commander2 || "");
            }}
            className="text-zinc-400 hover:text-zinc-300 text-sm px-3 py-1"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-red-400 text-sm mr-2">{error}</span>
      )}
      <button
        onClick={() => setMode("edit")}
        className="text-zinc-400 hover:text-zinc-300 text-sm"
      >
        Edit
      </button>
      <button
        onClick={handleToggleArchive}
        disabled={isPending}
        className="text-zinc-400 hover:text-zinc-300 text-sm disabled:opacity-50"
      >
        {isPending ? "..." : deck.isActive ? "Archive" : "Restore"}
      </button>
      {canDelete && (
        <button
          onClick={() => setMode("delete")}
          className="text-red-400 hover:text-red-300 text-sm"
        >
          Delete
        </button>
      )}
    </div>
  );
}
