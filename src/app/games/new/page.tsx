"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, useEffect, Suspense } from "react";
import {
  createGame,
  getUserDecks,
  getPlaygroupData,
  getPlaygroupDecks,
  type PlayerSetup,
  type PlaygroupData,
  type PlaygroupDeckData,
} from "./actions";
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
  type: "playgroup_member" | "playgroup_player" | "guest";
  userId?: string;
  playgroupPlayerId?: string;
  guestName: string;
  deckId: string;
  commanderUsed1: string;
  commanderUsed2: string;
  bracketUsed: string;
};

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function NewGameForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const playgroupId = searchParams.get("playgroup");

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [format, setFormat] = useState<MtgFormat>("commander");
  const [players, setPlayers] = useState<PlayerInput[]>([]);
  const [userDecks, setUserDecks] = useState<Deck[]>([]);
  const [playgroupData, setPlaygroupData] = useState<PlaygroupData | null>(null);
  const [playgroupDecks, setPlaygroupDecks] = useState<PlaygroupDeckData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const showCommander = isCommanderFormat(format);
  const showBracket = hasBrackets(format);

  // Load playgroup data if a playgroup is specified
  useEffect(() => {
    async function loadData() {
      setIsLoading(true);

      if (playgroupId) {
        const data = await getPlaygroupData(playgroupId);
        if (data) {
          setPlaygroupData(data);
          // Set default format from playgroup if available
          if (data.defaultFormat) {
            setFormat(data.defaultFormat as MtgFormat);
          }
          // Initialize with two empty player slots
          setPlayers([
            { id: generateId(), type: "playgroup_member", guestName: "", deckId: "", commanderUsed1: "", commanderUsed2: "", bracketUsed: "" },
            { id: generateId(), type: "playgroup_member", guestName: "", deckId: "", commanderUsed1: "", commanderUsed2: "", bracketUsed: "" },
          ]);
        } else {
          // Playgroup not found or user not a member
          router.push("/games/new");
          return;
        }
      } else {
        // No playgroup - use guest mode
        setPlayers([
          { id: generateId(), type: "guest", guestName: "", deckId: "", commanderUsed1: "", commanderUsed2: "", bracketUsed: "" },
          { id: generateId(), type: "guest", guestName: "", deckId: "", commanderUsed1: "", commanderUsed2: "", bracketUsed: "" },
        ]);
      }

      setIsLoading(false);
    }

    loadData();
  }, [playgroupId, router]);

  // Load decks when format changes
  useEffect(() => {
    async function loadDecks() {
      if (playgroupId && playgroupData) {
        const decks = await getPlaygroupDecks(playgroupId, format);
        setPlaygroupDecks(decks);
      } else {
        const decks = await getUserDecks(format);
        setUserDecks(decks);
      }
    }

    if (!isLoading) {
      loadDecks();
    }
  }, [format, playgroupId, playgroupData, isLoading]);

  function addPlayer() {
    const newPlayer: PlayerInput = playgroupId
      ? { id: generateId(), type: "playgroup_member", guestName: "", deckId: "", commanderUsed1: "", commanderUsed2: "", bracketUsed: "" }
      : { id: generateId(), type: "guest", guestName: "", deckId: "", commanderUsed1: "", commanderUsed2: "", bracketUsed: "" };
    setPlayers([...players, newPlayer]);
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

  function handlePlayerSelect(playerId: string, value: string) {
    if (!value) {
      updatePlayer(playerId, { type: "playgroup_member", userId: undefined, playgroupPlayerId: undefined, guestName: "" });
      return;
    }

    if (value.startsWith("member:")) {
      const userId = value.replace("member:", "");
      const member = playgroupData?.members.find((m) => m.id === userId);
      updatePlayer(playerId, {
        type: "playgroup_member",
        userId,
        playgroupPlayerId: undefined,
        guestName: member?.username || "",
      });
    } else if (value.startsWith("player:")) {
      const playgroupPlayerId = value.replace("player:", "");
      const player = playgroupData?.players.find((p) => p.id === playgroupPlayerId);
      updatePlayer(playerId, {
        type: "playgroup_player",
        playgroupPlayerId,
        userId: undefined,
        guestName: player?.name || "",
      });
    }
  }

  function getPlayerSelectValue(player: PlayerInput): string {
    if (player.type === "playgroup_member" && player.userId) {
      return `member:${player.userId}`;
    }
    if (player.type === "playgroup_player" && player.playgroupPlayerId) {
      return `player:${player.playgroupPlayerId}`;
    }
    return "";
  }

  function handleDeckSelect(playerId: string, deckId: string) {
    if (playgroupId) {
      const deck = playgroupDecks.find((d) => d.id === deckId);
      updatePlayer(playerId, {
        deckId,
        commanderUsed1: deck?.commander1 || "",
        commanderUsed2: deck?.commander2 || "",
        bracketUsed: deck?.bracket?.toString() || "",
      });
    } else {
      const deck = userDecks.find((d) => d.id === deckId);
      updatePlayer(playerId, {
        deckId,
        commanderUsed1: deck?.commander1 || "",
        commanderUsed2: deck?.commander2 || "",
        bracketUsed: deck?.bracket?.toString() || "",
      });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate players
    if (playgroupId) {
      if (players.some((p) => !p.userId && !p.playgroupPlayerId)) {
        setError("All players must be selected");
        return;
      }
    } else {
      if (players.some((p) => !p.guestName.trim())) {
        setError("All players must have a name");
        return;
      }
    }

    startTransition(async () => {
      const playerSetups: PlayerSetup[] = players.map((p) => ({
        id: p.id,
        type: p.type,
        userId: p.userId,
        playgroupPlayerId: p.playgroupPlayerId,
        guestName: p.type === "guest" ? p.guestName.trim() : undefined,
        deckId: p.deckId || undefined,
        commanderUsed1: p.commanderUsed1 || undefined,
        commanderUsed2: p.commanderUsed2 || undefined,
        bracketUsed: p.bracketUsed ? parseInt(p.bracketUsed) : undefined,
      }));

      const result = await createGame({
        format,
        playgroupId: playgroupId || undefined,
        players: playerSetups,
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        router.push(`/games/${result.gameId}/play`);
      }
    });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
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
            <Link href="/playgroups" className="text-zinc-400 hover:text-zinc-100 transition-colors">
              Playgroups
            </Link>
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
            {playgroupData ? (
              <Link href={`/playgroups/${playgroupId}`} className="text-zinc-400 hover:text-zinc-300 text-sm">
                ← Back to {playgroupData.name}
              </Link>
            ) : (
              <Link href="/games" className="text-zinc-400 hover:text-zinc-300 text-sm">
                ← Back to Games
              </Link>
            )}
            <h1 className="text-3xl font-bold mt-4">Start New Game</h1>
            {playgroupData ? (
              <p className="text-zinc-400 mt-2">
                Playing in <span className="text-amber-500">{playgroupData.name}</span>
              </p>
            ) : (
              <p className="text-zinc-400 mt-2">Set up the players and start tracking your game.</p>
            )}
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
                      {/* Player Selection (playgroup mode) or Name Input (guest mode) */}
                      {playgroupData ? (
                        <div>
                          <label className="block text-sm text-zinc-400 mb-1">
                            Select Player *
                          </label>
                          <select
                            value={getPlayerSelectValue(player)}
                            onChange={(e) => handlePlayerSelect(player.id, e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
                          >
                            <option value="">Choose a player...</option>
                            <optgroup label="Members">
                              {playgroupData.members.map((member) => (
                                <option key={member.id} value={`member:${member.id}`}>
                                  {member.username}
                                </option>
                              ))}
                            </optgroup>
                            {playgroupData.players.length > 0 && (
                              <optgroup label="Players (without accounts)">
                                {playgroupData.players.map((p) => (
                                  <option key={p.id} value={`player:${p.id}`}>
                                    {p.name}
                                  </option>
                                ))}
                              </optgroup>
                            )}
                          </select>
                        </div>
                      ) : (
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
                      )}

                      {/* Deck Selection */}
                      {(playgroupDecks.length > 0 || userDecks.length > 0) && (
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
                            {playgroupId
                              ? playgroupDecks.map((deck) => (
                                  <option key={deck.id} value={deck.id}>
                                    {deck.name}
                                    {deck.commander1 && ` - ${deck.commander1}`}
                                    {` (${deck.createdBy.username})`}
                                  </option>
                                ))
                              : userDecks.map((deck) => (
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
              {playgroupData ? (
                <Link
                  href={`/playgroups/${playgroupId}`}
                  className="border border-zinc-700 hover:border-zinc-500 text-zinc-300 px-6 py-3 rounded-lg transition-colors"
                >
                  Cancel
                </Link>
              ) : (
                <Link
                  href="/games"
                  className="border border-zinc-700 hover:border-zinc-500 text-zinc-300 px-6 py-3 rounded-lg transition-colors"
                >
                  Cancel
                </Link>
              )}
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default function NewGamePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-zinc-400">Loading...</div>
        </div>
      }
    >
      <NewGameForm />
    </Suspense>
  );
}
