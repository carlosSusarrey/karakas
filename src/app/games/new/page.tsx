"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, useEffect } from "react";
import { createGame, getUserDecks, type PlayerSetup } from "./actions";
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
import type { Deck } from "@/generated/prisma/client";

type PlayerInput = {
  id: string;
  type: "user" | "guest";
  guestName: string;
  deckId: string;
  commanderUsed1: string;
  commanderUsed2: string;
  bracketUsed: string;
};

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

export default function NewGamePage() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<MtgFormat>("commander");
  const [players, setPlayers] = useState<PlayerInput[]>([
    { id: generateId(), type: "guest", guestName: "", deckId: "", commanderUsed1: "", commanderUsed2: "", bracketUsed: "" },
    { id: generateId(), type: "guest", guestName: "", deckId: "", commanderUsed1: "", commanderUsed2: "", bracketUsed: "" },
  ]);
  const [userDecks, setUserDecks] = useState<Deck[]>([]);

  const showCommander = isCommanderFormat(format);
  const showBracket = hasBrackets(format);

  // Load user's decks when format changes
  useEffect(() => {
    getUserDecks(format).then(setUserDecks);
  }, [format]);

  function addPlayer() {
    setPlayers([
      ...players,
      { id: generateId(), type: "guest", guestName: "", deckId: "", commanderUsed1: "", commanderUsed2: "", bracketUsed: "" },
    ]);
  }

  function removePlayer(id: string) {
    if (players.length <= 2) return;
    setPlayers(players.filter((p) => p.id !== id));
  }

  function updatePlayer(id: string, updates: Partial<PlayerInput>) {
    setPlayers(
      players.map((p) => (p.id === id ? { ...p, ...updates } : p))
    );
  }

  function handleDeckSelect(playerId: string, deckId: string) {
    const deck = userDecks.find((d) => d.id === deckId);
    updatePlayer(playerId, {
      deckId,
      commanderUsed1: deck?.commander1 || "",
      commanderUsed2: deck?.commander2 || "",
      bracketUsed: deck?.bracket?.toString() || "",
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate players
    const invalidPlayers = players.filter((p) => !p.guestName.trim());
    if (invalidPlayers.length > 0) {
      setError("All players must have a name");
      return;
    }

    startTransition(async () => {
      const playerSetups: PlayerSetup[] = players.map((p) => ({
        id: p.id,
        type: "guest" as const,
        guestName: p.guestName.trim(),
        deckId: p.deckId || undefined,
        commanderUsed1: p.commanderUsed1 || undefined,
        commanderUsed2: p.commanderUsed2 || undefined,
        bracketUsed: p.bracketUsed ? parseInt(p.bracketUsed) : undefined,
      }));

      const result = await createGame({
        format,
        players: playerSetups,
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        router.push(`/games/${result.gameId}/play`);
      }
    });
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
            <Link href="/games" className="text-zinc-400 hover:text-zinc-100 transition-colors">
              Games
            </Link>
            <Link href="/decks" className="text-zinc-400 hover:text-zinc-100 transition-colors">
              Decks
            </Link>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <Link href="/games" className="text-zinc-400 hover:text-zinc-300 text-sm">
              ← Back to Games
            </Link>
            <h1 className="text-3xl font-bold mt-4">Start New Game</h1>
            <p className="text-zinc-400 mt-2">Set up the players and start tracking your game.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {error && (
              <div className="bg-red-900/50 border border-red-800 text-red-200 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            {/* Format Selection */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <label htmlFor="format" className="block text-lg font-semibold mb-3">
                Game Format
              </label>
              <select
                id="format"
                value={format}
                onChange={(e) => setFormat(e.target.value as MtgFormat)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
              >
                {MTG_FORMATS.map((f) => (
                  <option key={f} value={f}>
                    {FORMAT_LABELS[f]}
                  </option>
                ))}
              </select>
            </div>

            {/* Players Section */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Players</h2>
                <button
                  type="button"
                  onClick={addPlayer}
                  className="text-amber-500 hover:text-amber-400 text-sm font-medium"
                >
                  + Add Player
                </button>
              </div>

              <div className="space-y-4">
                {players.map((player, index) => (
                  <div
                    key={player.id}
                    className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-zinc-400 text-sm font-medium">
                        Player {index + 1}
                      </span>
                      {players.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removePlayer(player.id)}
                          className="text-red-400 hover:text-red-300 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="space-y-3">
                      {/* Player Name */}
                      <div>
                        <label className="block text-sm text-zinc-400 mb-1">
                          Name *
                        </label>
                        <input
                          type="text"
                          value={player.guestName}
                          onChange={(e) =>
                            updatePlayer(player.id, { guestName: e.target.value })
                          }
                          placeholder="Player name"
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
                        />
                      </div>

                      {/* Deck Selection */}
                      {userDecks.length > 0 && (
                        <div>
                          <label className="block text-sm text-zinc-400 mb-1">
                            Deck (optional)
                          </label>
                          <select
                            value={player.deckId}
                            onChange={(e) => handleDeckSelect(player.id, e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
                          >
                            <option value="">No deck selected</option>
                            {userDecks.map((deck) => (
                              <option key={deck.id} value={deck.id}>
                                {deck.name}
                                {deck.commander1 && ` - ${deck.commander1}`}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Commander Fields (conditional) */}
                      {showCommander && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm text-zinc-400 mb-1">
                              Commander
                            </label>
                            <input
                              type="text"
                              value={player.commanderUsed1}
                              onChange={(e) =>
                                updatePlayer(player.id, {
                                  commanderUsed1: e.target.value,
                                })
                              }
                              placeholder="Commander name"
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-zinc-400 mb-1">
                              Partner (optional)
                            </label>
                            <input
                              type="text"
                              value={player.commanderUsed2}
                              onChange={(e) =>
                                updatePlayer(player.id, {
                                  commanderUsed2: e.target.value,
                                })
                              }
                              placeholder="Partner commander"
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
                            />
                          </div>
                        </div>
                      )}

                      {/* Bracket Field (conditional) */}
                      {showBracket && (
                        <div>
                          <label className="block text-sm text-zinc-400 mb-1">
                            EDH Bracket
                          </label>
                          <select
                            value={player.bracketUsed}
                            onChange={(e) =>
                              updatePlayer(player.id, { bracketUsed: e.target.value })
                            }
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
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
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Submit */}
            <div className="flex gap-4">
              <button
                type="submit"
                disabled={isPending}
                className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 disabled:cursor-not-allowed text-white py-3 rounded-lg transition-colors font-semibold text-lg"
              >
                {isPending ? "Starting..." : "Start Game"}
              </button>
              <Link
                href="/games"
                className="border border-zinc-700 hover:border-zinc-500 text-zinc-300 px-6 py-3 rounded-lg transition-colors"
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
