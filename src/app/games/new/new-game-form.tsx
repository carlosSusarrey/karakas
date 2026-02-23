"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, useEffect, Suspense } from "react";
import {
  createGame,
  getUserDecks,
  getPlaygroupData,
  getPlaygroupDecks,
  getPlaygroupPlayerDecks,
  saveNewDeckFromGame,
  type PlayerSetup,
  type PlaygroupData,
  type PlaygroupDeckData,
  type PlaygroupPlayerDeckData,
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
import { Header } from "@/components/header";
import { CardAutocomplete } from "@/components/card-autocomplete";
import { AlertMessage } from "@/components/alert-message";

type PlayerInput = {
  id: string;
  type: "playgroup_member" | "playgroup_player" | "guest";
  userId?: string;
  playgroupPlayerId?: string;
  guestName: string;
  deckId: string;
  playgroupPlayerDeckId: string;
  commanderUsed1: string;
  commanderUsed2: string;
  bracketUsed: string;
  showAllDecks: boolean;
  saveAsNewDeck: boolean;
};

function createEmptyPlayer(type: PlayerInput["type"]): PlayerInput {
  return {
    id: generateId(),
    type,
    guestName: "",
    deckId: "",
    playgroupPlayerDeckId: "",
    commanderUsed1: "",
    commanderUsed2: "",
    bracketUsed: "",
    showAllDecks: false,
    saveAsNewDeck: false,
  };
}

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

function NewGameFormInner({ username }: { username: string }) {
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
  const [playgroupPlayerDecks, setPlaygroupPlayerDecks] = useState<PlaygroupPlayerDeckData[]>([]);
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
            createEmptyPlayer("playgroup_member"),
            createEmptyPlayer("playgroup_member"),
          ]);
        } else {
          // Playgroup not found or user not a member
          router.push("/playgroups");
          return;
        }
      } else {
        // No playgroup - redirect to playgroups page
        router.push("/playgroups");
        return;
      }

      setIsLoading(false);
    }

    loadData();
  }, [playgroupId, router]);

  // Load decks when format changes
  useEffect(() => {
    async function loadDecks() {
      if (playgroupId && playgroupData) {
        const [decks, playerDecks] = await Promise.all([
          getPlaygroupDecks(playgroupId, format),
          getPlaygroupPlayerDecks(playgroupId, format),
        ]);
        setPlaygroupDecks(decks);
        setPlaygroupPlayerDecks(playerDecks);
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
    setPlayers([...players, createEmptyPlayer(playgroupId ? "playgroup_member" : "guest")]);
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
    const resetFields = {
      deckId: "",
      playgroupPlayerDeckId: "",
      commanderUsed1: "",
      commanderUsed2: "",
      bracketUsed: "",
      showAllDecks: false,
      saveAsNewDeck: false,
    };

    if (!value) {
      updatePlayer(playerId, { type: "playgroup_member", userId: undefined, playgroupPlayerId: undefined, guestName: "", ...resetFields });
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
        ...resetFields,
      });
    } else if (value.startsWith("player:")) {
      const playgroupPlayerId = value.replace("player:", "");
      const player = playgroupData?.players.find((p) => p.id === playgroupPlayerId);
      updatePlayer(playerId, {
        type: "playgroup_player",
        playgroupPlayerId,
        userId: undefined,
        guestName: player?.name || "",
        ...resetFields,
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

  function getPlayerOwnDecks(player: PlayerInput) {
    if (player.type === "playgroup_member" && player.userId) {
      return {
        memberDecks: playgroupDecks.filter((d) => d.userId === player.userId),
        playerDecks: [] as PlaygroupPlayerDeckData[],
      };
    }
    if (player.type === "playgroup_player" && player.playgroupPlayerId) {
      return {
        memberDecks: [] as PlaygroupDeckData[],
        playerDecks: playgroupPlayerDecks.filter((d) => d.playgroupPlayerId === player.playgroupPlayerId),
      };
    }
    return { memberDecks: [] as PlaygroupDeckData[], playerDecks: [] as PlaygroupPlayerDeckData[] };
  }

  function getOtherDecks(player: PlayerInput) {
    if (player.type === "playgroup_member" && player.userId) {
      return {
        memberDecks: playgroupDecks.filter((d) => d.userId !== player.userId),
        playerDecks: playgroupPlayerDecks,
      };
    }
    if (player.type === "playgroup_player" && player.playgroupPlayerId) {
      return {
        memberDecks: playgroupDecks,
        playerDecks: playgroupPlayerDecks.filter((d) => d.playgroupPlayerId !== player.playgroupPlayerId),
      };
    }
    return { memberDecks: playgroupDecks, playerDecks: playgroupPlayerDecks };
  }

  function handleDeckSelect(playerId: string, value: string) {
    if (value === "__load_more__") {
      updatePlayer(playerId, { showAllDecks: true });
      return;
    }

    if (!value) {
      updatePlayer(playerId, {
        deckId: "",
        playgroupPlayerDeckId: "",
        commanderUsed1: "",
        commanderUsed2: "",
        bracketUsed: "",
        saveAsNewDeck: false,
      });
      return;
    }

    if (playgroupId) {
      // Check if it's a member deck or a player deck
      if (value.startsWith("player_deck:")) {
        const playerDeckId = value.replace("player_deck:", "");
        const deck = playgroupPlayerDecks.find((d) => d.id === playerDeckId);
        updatePlayer(playerId, {
          deckId: "",
          playgroupPlayerDeckId: playerDeckId,
          commanderUsed1: deck?.commander1 || "",
          commanderUsed2: deck?.commander2 || "",
          bracketUsed: deck?.bracket?.toString() || "",
        });
      } else {
        const deck = playgroupDecks.find((d) => d.id === value);
        updatePlayer(playerId, {
          deckId: value,
          playgroupPlayerDeckId: "",
          commanderUsed1: deck?.commander1 || "",
          commanderUsed2: deck?.commander2 || "",
          bracketUsed: deck?.bracket?.toString() || "",
        });
      }
    } else {
      const deck = userDecks.find((d) => d.id === value);
      updatePlayer(playerId, {
        deckId: value,
        playgroupPlayerDeckId: "",
        commanderUsed1: deck?.commander1 || "",
        commanderUsed2: deck?.commander2 || "",
        bracketUsed: deck?.bracket?.toString() || "",
      });
    }
  }

  function getDeckSelectValue(player: PlayerInput): string {
    if (player.playgroupPlayerDeckId) {
      return `player_deck:${player.playgroupPlayerDeckId}`;
    }
    return player.deckId;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Validate players
    if (players.some((p) => !p.userId && !p.playgroupPlayerId)) {
      setError("All players must be selected");
      return;
    }

    startTransition(async () => {
      // Save any new decks that the user requested
      const updatedPlayers = [...players];
      for (let i = 0; i < updatedPlayers.length; i++) {
        const p = updatedPlayers[i];
        if (p.saveAsNewDeck && p.commanderUsed1 && playgroupId && !p.deckId && !p.playgroupPlayerDeckId) {
          const saveResult = await saveNewDeckFromGame({
            playgroupId,
            playerType: p.type as "playgroup_member" | "playgroup_player",
            userId: p.userId,
            playgroupPlayerId: p.playgroupPlayerId,
            format,
            commander1: p.commanderUsed1,
            commander2: p.commanderUsed2 || undefined,
            bracket: p.bracketUsed ? parseInt(p.bracketUsed) : undefined,
          });

          if ("error" in saveResult) {
            setError(`Failed to save deck for player ${i + 1}: ${saveResult.error}`);
            return;
          }

          if (saveResult.deckType === "deck") {
            updatedPlayers[i] = { ...p, deckId: saveResult.deckId };
          } else {
            updatedPlayers[i] = { ...p, playgroupPlayerDeckId: saveResult.deckId };
          }
        }
      }

      const playerSetups: PlayerSetup[] = updatedPlayers.map((p) => ({
        id: p.id,
        type: p.type,
        userId: p.userId,
        playgroupPlayerId: p.playgroupPlayerId,
        guestName: p.type === "guest" ? p.guestName.trim() : undefined,
        deckId: p.deckId || undefined,
        playgroupPlayerDeckId: p.playgroupPlayerDeckId || undefined,
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
      <Header username={username} activeTab="games" />

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <Link href={`/playgroups/${playgroupId}`} className="text-zinc-400 hover:text-zinc-300 text-sm">
              ← Back to {playgroupData?.name}
            </Link>
            <h1 className="text-3xl font-bold mt-4">Start New Game</h1>
            <p className="text-zinc-400 mt-2">
              Playing in <span className="text-amber-500">{playgroupData?.name}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {error && <AlertMessage variant="error">{error}</AlertMessage>}

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
                      {(playgroupDecks.length > 0 || playgroupPlayerDecks.length > 0 || userDecks.length > 0) && (
                        <div>
                          <label className="block text-sm text-zinc-400 mb-1">
                            Deck (optional)
                          </label>
                          <select
                            value={getDeckSelectValue(player)}
                            onChange={(e) => handleDeckSelect(player.id, e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
                          >
                            <option value="">No deck selected</option>
                            {playgroupId ? (
                              <>
                                {(() => {
                                  const own = getPlayerOwnDecks(player);
                                  const hasOwn = own.memberDecks.length > 0 || own.playerDecks.length > 0;
                                  const other = getOtherDecks(player);
                                  const hasOther = other.memberDecks.length > 0 || other.playerDecks.length > 0;

                                  return (
                                    <>
                                      {own.memberDecks.length > 0 && (
                                        <optgroup label="Your Decks">
                                          {own.memberDecks.map((deck) => (
                                            <option key={deck.id} value={deck.id}>
                                              {deck.name}
                                              {deck.commander1 && ` - ${deck.commander1}`}
                                            </option>
                                          ))}
                                        </optgroup>
                                      )}
                                      {own.playerDecks.length > 0 && (
                                        <optgroup label="Your Decks">
                                          {own.playerDecks.map((deck) => (
                                            <option key={deck.id} value={`player_deck:${deck.id}`}>
                                              {deck.name}
                                              {deck.commander1 && ` - ${deck.commander1}`}
                                            </option>
                                          ))}
                                        </optgroup>
                                      )}
                                      {hasOther && !player.showAllDecks && (
                                        <option value="__load_more__">
                                          Load more decks...
                                        </option>
                                      )}
                                      {player.showAllDecks && (
                                        <>
                                          {other.memberDecks.length > 0 && (
                                            <optgroup label="Other Member Decks">
                                              {other.memberDecks.map((deck) => (
                                                <option key={deck.id} value={deck.id}>
                                                  {deck.name}
                                                  {deck.commander1 && ` - ${deck.commander1}`}
                                                  {` (${deck.createdBy.username})`}
                                                </option>
                                              ))}
                                            </optgroup>
                                          )}
                                          {other.playerDecks.length > 0 && (
                                            <optgroup label="Other Player Decks">
                                              {other.playerDecks.map((deck) => (
                                                <option key={deck.id} value={`player_deck:${deck.id}`}>
                                                  {deck.name}
                                                  {deck.commander1 && ` - ${deck.commander1}`}
                                                  {` (${deck.playerName})`}
                                                </option>
                                              ))}
                                            </optgroup>
                                          )}
                                        </>
                                      )}
                                      {!hasOwn && !hasOther && (
                                        <option value="" disabled>No decks available</option>
                                      )}
                                    </>
                                  );
                                })()}
                              </>
                            ) : (
                              userDecks.map((deck) => (
                                <option key={deck.id} value={deck.id}>
                                  {deck.name}
                                  {deck.commander1 && ` - ${deck.commander1}`}
                                </option>
                              ))
                            )}
                          </select>
                        </div>
                      )}

                      {/* Commander Fields - only show if no deck selected */}
                      {showCommander && !player.deckId && !player.playgroupPlayerDeckId && (
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm text-zinc-400 mb-1">
                              Commander
                            </label>
                            <CardAutocomplete
                              id={`commander1-${player.id}`}
                              name={`commander1-${player.id}`}
                              value={player.commanderUsed1}
                              onChange={(value) =>
                                updatePlayer(player.id, {
                                  commanderUsed1: value,
                                })
                              }
                              placeholder="Commander name"
                              commanderOnly={true}
                              showPreview={true}
                            />
                          </div>
                          <div>
                            <label className="block text-sm text-zinc-400 mb-1">
                              Partner (optional)
                            </label>
                            <CardAutocomplete
                              id={`commander2-${player.id}`}
                              name={`commander2-${player.id}`}
                              value={player.commanderUsed2}
                              onChange={(value) =>
                                updatePlayer(player.id, {
                                  commanderUsed2: value,
                                })
                              }
                              placeholder="Partner commander"
                              commanderOnly={true}
                              showPreview={true}
                            />
                          </div>
                        </div>
                      )}

                      {/* Bracket Field - only show if no deck selected */}
                      {showBracket && !player.deckId && !player.playgroupPlayerDeckId && (
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

                      {/* Save as new deck */}
                      {showCommander && !player.deckId && !player.playgroupPlayerDeckId &&
                        player.commanderUsed1 && (player.userId || player.playgroupPlayerId) && (
                        <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={player.saveAsNewDeck}
                            onChange={(e) =>
                              updatePlayer(player.id, { saveAsNewDeck: e.target.checked })
                            }
                            className="rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500"
                          />
                          Save as new deck for this player
                        </label>
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
              href={`/playgroups/${playgroupId}`}
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

export function NewGameForm({ username }: { username: string }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-zinc-400">Loading...</div>
        </div>
      }
    >
      <NewGameFormInner username={username} />
    </Suspense>
  );
}
