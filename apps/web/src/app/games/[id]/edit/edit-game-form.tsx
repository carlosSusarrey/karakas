"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateGame, deleteGame } from "./actions";
import {
  FORMAT_LABELS,
  isCommanderFormat,
  hasBrackets,
  type MtgFormat,
} from "@/types/mtg";
import { AlertMessage } from "@/components/alert-message";
import {
  PlayerDeckFields,
  type PlayerDeckEdit,
} from "@/components/player-deck-fields";

type GamePlayer = {
  id: string;
  userId: string | null;
  playgroupPlayerId: string | null;
  guestName: string | null;
  commanderUsed1: string | null;
  commanderUsed2: string | null;
  bracketUsed: number | null;
  placement: number | null;
  isWinner: boolean;
  isFirstOut: boolean;
  eliminatedTurn: number | null;
  user: { id: string; username: string } | null;
  playgroupPlayer: { id: string; name: string } | null;
  deck: { id: string; name: string } | null;
  playgroupPlayerDeck: { id: string; name: string } | null;
};

type Game = {
  id: string;
  format: string;
  totalTurns: number | null;
  notes: string | null;
  playedAt: Date;
  playgroup: { id: string; name: string } | null;
  players: GamePlayer[];
};

type Props = {
  game: Game;
};

export function EditGameForm({ game }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [totalTurns, setTotalTurns] = useState(game.totalTurns || 0);
  const [notes, setNotes] = useState(game.notes || "");
  const [playedAt, setPlayedAt] = useState(
    new Date(game.playedAt).toISOString().slice(0, 16)
  );

  const showDeckSection =
    isCommanderFormat(game.format) || hasBrackets(game.format);

  // Player results
  const [players, setPlayers] = useState(
    game.players.map((p) => ({
      id: p.id,
      name: getPlayerName(p),
      placement: p.placement,
      isWinner: p.isWinner,
      isFirstOut: p.isFirstOut,
      eliminatedTurn: p.eliminatedTurn,
    }))
  );

  // Deck edits per player
  const [deckEdits, setDeckEdits] = useState<Record<string, PlayerDeckEdit>>(
    () => {
      const initial: Record<string, PlayerDeckEdit> = {};
      for (const p of game.players) {
        initial[p.id] = {
          commanderUsed1: p.commanderUsed1 || "",
          commanderUsed2: p.commanderUsed2 || "",
          bracketUsed: p.bracketUsed?.toString() || "",
          saveAsNewDeck: false,
        };
      }
      return initial;
    }
  );

  function getPlayerName(player: GamePlayer) {
    if (player.user) return player.user.username;
    if (player.playgroupPlayer) return player.playgroupPlayer.name;
    return player.guestName || "Unknown Player";
  }

  function getDeckDisplayName(player: GamePlayer): string | null {
    if (player.deck) return player.deck.name;
    if (player.playgroupPlayerDeck) return player.playgroupPlayerDeck.name;
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await updateGame(game.id, {
        totalTurns,
        notes: notes || null,
        playedAt: new Date(playedAt),
        players: players.map((p) => {
          const de = deckEdits[p.id];
          return {
            id: p.id,
            placement: p.placement,
            isWinner: p.isWinner,
            isFirstOut: p.isFirstOut,
            eliminatedTurn: p.eliminatedTurn,
            commanderUsed1: de?.commanderUsed1 || null,
            commanderUsed2: de?.commanderUsed2 || null,
            bracketUsed: de?.bracketUsed ? parseInt(de.bracketUsed) : null,
          };
        }),
      });

      if ("error" in result) {
        setError(result.error);
      } else {
        router.push(`/games/${game.id}`);
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    setError(null);

    try {
      const result = await deleteGame(game.id);

      if ("error" in result) {
        setError(result.error);
        setShowDeleteConfirm(false);
      } else {
        if (game.playgroup) {
          router.push(`/playgroups/${game.playgroup.id}`);
        } else {
          router.push("/games");
        }
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsDeleting(false);
    }
  }

  function setWinner(playerId: string) {
    setPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        isWinner: p.id === playerId,
        placement: p.id === playerId ? 1 : p.placement === 1 ? 2 : p.placement,
      }))
    );
  }

  function setFirstOut(playerId: string) {
    setPlayers((prev) =>
      prev.map((p) => ({
        ...p,
        isFirstOut: p.id === playerId,
      }))
    );
  }

  function setPlayerPlacement(playerId: string, placement: number | null) {
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, placement } : p))
    );
  }

  function setPlayerEliminatedTurn(playerId: string, turn: number | null) {
    setPlayers((prev) =>
      prev.map((p) => (p.id === playerId ? { ...p, eliminatedTurn: turn } : p))
    );
  }

  return (
    <div className="space-y-6">
      {error && <AlertMessage variant="error">{error}</AlertMessage>}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Game Details */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Game Details</h2>

          <div className="grid gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Format
              </label>
              <div className="text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg">
                {FORMAT_LABELS[game.format as MtgFormat]}
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                Format cannot be changed after game creation
              </p>
            </div>

            {game.playgroup && (
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Playgroup
                </label>
                <div className="text-zinc-300 bg-zinc-800 px-3 py-2 rounded-lg">
                  {game.playgroup.name}
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Total Turns
              </label>
              <input
                type="number"
                min="0"
                value={totalTurns}
                onChange={(e) => setTotalTurns(parseInt(e.target.value) || 0)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Date Played
              </label>
              <input
                type="datetime-local"
                value={playedAt}
                onChange={(e) => setPlayedAt(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-1">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 resize-none"
                placeholder="Any notes about the game..."
              />
            </div>
          </div>
        </div>

        {/* Player Results */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Player Results</h2>

          <div className="space-y-4">
            {players.map((player) => (
              <div
                key={player.id}
                className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="font-medium">{player.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setWinner(player.id)}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        player.isWinner
                          ? "bg-amber-600 text-white"
                          : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                      }`}
                    >
                      Winner
                    </button>
                    <button
                      type="button"
                      onClick={() => setFirstOut(player.id)}
                      className={`text-xs px-2 py-1 rounded transition-colors ${
                        player.isFirstOut
                          ? "bg-red-600 text-white"
                          : "bg-zinc-700 text-zinc-300 hover:bg-zinc-600"
                      }`}
                    >
                      First Out
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">
                      Placement
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={players.length}
                      value={player.placement || ""}
                      onChange={(e) =>
                        setPlayerPlacement(
                          player.id,
                          e.target.value ? parseInt(e.target.value) : null
                        )
                      }
                      className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">
                      Eliminated Turn
                    </label>
                    <input
                      type="number"
                      min="1"
                      max={totalTurns || undefined}
                      value={player.eliminatedTurn || ""}
                      onChange={(e) =>
                        setPlayerEliminatedTurn(
                          player.id,
                          e.target.value ? parseInt(e.target.value) : null
                        )
                      }
                      className="w-full bg-zinc-700 border border-zinc-600 rounded px-2 py-1 text-sm text-zinc-100 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deck Info */}
        {showDeckSection && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-2">Deck Info</h2>
            <p className="text-xs text-zinc-500 mb-4">
              Update commanders and brackets used in this game.
            </p>

            <div className="space-y-3">
              {game.players.map((gp) => (
                <PlayerDeckFields
                  key={gp.id}
                  playerId={gp.id}
                  playerName={getPlayerName(gp)}
                  format={game.format}
                  deckName={getDeckDisplayName(gp)}
                  edit={
                    deckEdits[gp.id] || {
                      commanderUsed1: "",
                      commanderUsed2: "",
                      bracketUsed: "",
                      saveAsNewDeck: false,
                    }
                  }
                  onChange={(edit) =>
                    setDeckEdits((prev) => ({ ...prev, [gp.id]: edit }))
                  }
                  canSaveDeck={false}
                />
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(true)}
            className="text-red-400 hover:text-red-300 transition-colors"
          >
            Delete Game
          </button>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-4 py-2 text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors"
            >
              {isSubmitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </form>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md mx-4">
            <h3 className="text-xl font-semibold mb-4">Delete Game?</h3>
            <p className="text-zinc-400 mb-6">
              This will permanently delete this game and all associated data including
              player results and power plays. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-red-600 hover:bg-red-500 disabled:bg-red-800 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {isDeleting ? "Deleting..." : "Delete Game"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
