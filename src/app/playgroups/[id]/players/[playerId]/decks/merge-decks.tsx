"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { mergePlaygroupPlayerDecks } from "./actions";

type Deck = {
  id: string;
  name: string;
  format: string;
  commander1: string | null;
  commander2: string | null;
  _count: { gamePlayers: number };
};

type Props = {
  playerId: string;
  decks: Deck[];
};

export function MergeDecks({ playerId, decks }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const [targetDeckId, setTargetDeckId] = useState<string>("");
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Need at least 2 decks to merge
  if (decks.length < 2) {
    return null;
  }

  const availableSourceDecks = decks.filter((d) => d.id !== targetDeckId);

  function toggleSourceDeck(deckId: string) {
    setSelectedSourceIds((prev) =>
      prev.includes(deckId)
        ? prev.filter((id) => id !== deckId)
        : [...prev, deckId]
    );
  }

  function handleReset() {
    setTargetDeckId("");
    setSelectedSourceIds([]);
    setError(null);
    setSuccessMessage(null);
  }

  async function handleMerge() {
    if (!targetDeckId) {
      setError("Please select a target deck");
      return;
    }

    if (selectedSourceIds.length === 0) {
      setError("Please select at least one deck to merge");
      return;
    }

    setError(null);

    startTransition(async () => {
      const result = await mergePlaygroupPlayerDecks(
        targetDeckId,
        selectedSourceIds
      );

      if ("error" in result) {
        setError(result.error);
      } else {
        const sourceNames = decks
          .filter((d) => selectedSourceIds.includes(d.id))
          .map((d) => d.name)
          .join(", ");
        const targetName = decks.find((d) => d.id === targetDeckId)?.name;
        setSuccessMessage(
          `Merged ${selectedSourceIds.length} deck(s) into "${targetName}". ${result.mergedGames} game record(s) updated.`
        );
        setTargetDeckId("");
        setSelectedSourceIds([]);
        setTimeout(() => {
          setSuccessMessage(null);
          setIsOpen(false);
          router.refresh();
        }, 3000);
      }
    });
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="text-amber-400 hover:text-amber-300 text-sm font-medium"
      >
        Merge Decks
      </button>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold">Merge Decks</h3>
        <button
          onClick={() => {
            setIsOpen(false);
            handleReset();
          }}
          className="text-zinc-400 hover:text-zinc-300 text-sm"
        >
          Cancel
        </button>
      </div>

      <p className="text-zinc-400 text-sm mb-4">
        Merge multiple decks into one. Game records from the source decks will
        be transferred to the target deck, and source decks will be archived.
      </p>

      {error && (
        <div className="bg-red-900/50 border border-red-800 text-red-200 px-3 py-2 rounded-lg text-sm mb-4">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="bg-green-900/50 border border-green-800 text-green-200 px-3 py-2 rounded-lg text-sm mb-4">
          {successMessage}
        </div>
      )}

      {!successMessage && (
        <>
          {/* Target Deck Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              Target Deck (keep this one)
            </label>
            <select
              value={targetDeckId}
              onChange={(e) => {
                setTargetDeckId(e.target.value);
                // Remove from source if it was selected
                setSelectedSourceIds((prev) =>
                  prev.filter((id) => id !== e.target.value)
                );
              }}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
            >
              <option value="">Select target deck...</option>
              {decks.map((deck) => (
                <option key={deck.id} value={deck.id}>
                  {deck.name} ({deck._count.gamePlayers} games)
                  {deck.commander1 && ` - ${deck.commander1}`}
                </option>
              ))}
            </select>
          </div>

          {/* Source Decks Selection */}
          {targetDeckId && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Source Decks (merge into target)
              </label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {availableSourceDecks.map((deck) => (
                  <label
                    key={deck.id}
                    className="flex items-center gap-3 p-2 bg-zinc-800 rounded cursor-pointer hover:bg-zinc-750"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSourceIds.includes(deck.id)}
                      onChange={() => toggleSourceDeck(deck.id)}
                      className="w-4 h-4 rounded border-zinc-600 bg-zinc-700 text-amber-500 focus:ring-amber-500 focus:ring-offset-zinc-900"
                    />
                    <div className="flex-1">
                      <span className="text-zinc-100">{deck.name}</span>
                      <span className="text-zinc-500 text-sm ml-2">
                        ({deck._count.gamePlayers} games)
                      </span>
                      {deck.commander1 && (
                        <span className="text-zinc-400 text-sm ml-2">
                          - {deck.commander1}
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {targetDeckId && selectedSourceIds.length > 0 && (
            <div className="bg-zinc-800 rounded p-3 mb-4 text-sm">
              <p className="text-zinc-300">
                <strong>Summary:</strong> Merge{" "}
                <span className="text-amber-400">
                  {selectedSourceIds.length} deck(s)
                </span>{" "}
                into{" "}
                <span className="text-amber-400">
                  &quot;{decks.find((d) => d.id === targetDeckId)?.name}&quot;
                </span>
              </p>
              <p className="text-zinc-500 mt-1">
                Total games to transfer:{" "}
                {decks
                  .filter((d) => selectedSourceIds.includes(d.id))
                  .reduce((sum, d) => sum + d._count.gamePlayers, 0)}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleMerge}
              disabled={
                isPending || !targetDeckId || selectedSourceIds.length === 0
              }
              className="bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm px-4 py-2 rounded transition-colors"
            >
              {isPending ? "Merging..." : "Merge Decks"}
            </button>
            <button
              onClick={handleReset}
              disabled={isPending}
              className="text-zinc-400 hover:text-zinc-300 text-sm px-4 py-2"
            >
              Reset
            </button>
          </div>
        </>
      )}
    </div>
  );
}
