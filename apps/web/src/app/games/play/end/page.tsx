"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/contexts/game-context";
import { isCommanderFormat, hasBrackets } from "@/types/mtg";
import {
  PlayerDeckFields,
  type PlayerDeckEdit,
} from "@/components/player-deck-fields";
import { saveNewDeckFromGame } from "@/app/games/new/actions";
import type { MtgFormat } from "@/types/mtg";

export default function EndGameScreen() {
  const router = useRouter();
  const { state, endActiveGame, startNewGame, hasActiveGame, hydrated } = useGame();
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [isDraw, setIsDraw] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showDeckSection =
    isCommanderFormat(state.format) || hasBrackets(state.format);

  // Initialize deck edits from game state
  const [deckEdits, setDeckEdits] = useState<Record<string, PlayerDeckEdit>>(
    {}
  );

  useEffect(() => {
    if (hydrated && hasActiveGame && Object.keys(deckEdits).length === 0) {
      const initial: Record<string, PlayerDeckEdit> = {};
      for (const p of state.players) {
        initial[p.id] = {
          commanderUsed1: p.commanderUsed1 || "",
          commanderUsed2: p.commanderUsed2 || "",
          bracketUsed: p.bracketUsed?.toString() || "",
          saveAsNewDeck: false,
        };
      }
      setDeckEdits(initial);
    }
  }, [hydrated, hasActiveGame, state.players, deckEdits]);

  useEffect(() => {
    if (hydrated && !hasActiveGame) {
      router.replace("/games/play/setup");
    }
  }, [hydrated, hasActiveGame, router]);

  if (!hydrated || !hasActiveGame) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">
        Loading...
      </div>
    );
  }

  const alivePlayers = state.players.filter((p) => !p.isEliminated);
  const eliminatedPlayers = state.players
    .filter((p) => p.isEliminated)
    .sort((a, b) => (b.eliminatedTurn ?? 0) - (a.eliminatedTurn ?? 0));

  const handleRematch = () => {
    const players = state.players.map((p) => ({
      name: p.name,
      userId: p.serverUserId,
      playgroupPlayerId: p.serverPlaygroupPlayerId,
      deckId: p.serverDeckId,
      commanderUsed1: p.commanderUsed1,
      commanderUsed2: p.commanderUsed2,
      bracketUsed: p.bracketUsed,
    }));
    startNewGame(state.format, players, state.playgroupId);
    router.replace("/games/play");
  };

  const handleEndGame = async () => {
    setError(null);
    if (!isDraw && !winnerId) {
      setError("Choose a winner or declare a draw.");
      return;
    }

    setSaving(true);
    try {
      // Build per-player deck overrides and handle "save as new deck"
      const playerOverrides: Record<
        string,
        {
          commanderUsed1?: string;
          commanderUsed2?: string;
          bracketUsed?: number;
          deckId?: string;
          playgroupPlayerDeckId?: string;
        }
      > = {};

      for (const p of state.players) {
        const edit = deckEdits[p.id];
        if (!edit) continue;

        const overrides: (typeof playerOverrides)[string] = {};

        if (edit.commanderUsed1)
          overrides.commanderUsed1 = edit.commanderUsed1;
        if (edit.commanderUsed2)
          overrides.commanderUsed2 = edit.commanderUsed2;
        if (edit.bracketUsed)
          overrides.bracketUsed = parseInt(edit.bracketUsed);

        // Save as new deck if requested
        if (
          edit.saveAsNewDeck &&
          edit.commanderUsed1 &&
          !p.serverDeckId &&
          state.playgroupId &&
          (p.serverUserId || p.serverPlaygroupPlayerId)
        ) {
          const saveResult = await saveNewDeckFromGame({
            playgroupId: state.playgroupId,
            playerType: p.serverUserId
              ? "playgroup_member"
              : "playgroup_player",
            userId: p.serverUserId,
            playgroupPlayerId: p.serverPlaygroupPlayerId,
            format: state.format as MtgFormat,
            commander1: edit.commanderUsed1,
            commander2: edit.commanderUsed2 || undefined,
            bracket: edit.bracketUsed
              ? parseInt(edit.bracketUsed)
              : undefined,
          });

          if ("error" in saveResult) {
            setError(
              `Failed to save deck for ${p.name}: ${saveResult.error}`
            );
            setSaving(false);
            return;
          }

          if (saveResult.deckType === "deck") {
            overrides.deckId = saveResult.deckId;
          } else {
            overrides.playgroupPlayerDeckId = saveResult.deckId;
          }
        }

        playerOverrides[p.id] = overrides;
      }

      const createRes = await fetch("/api/v1/games", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          format: state.format,
          playgroupId: state.playgroupId,
          players: state.players.map((p) => {
            const ov = playerOverrides[p.id] || {};
            return {
              userId: p.serverUserId || undefined,
              playgroupPlayerId: p.serverPlaygroupPlayerId || undefined,
              deckId: ov.deckId || p.serverDeckId || undefined,
              playgroupPlayerDeckId: ov.playgroupPlayerDeckId || undefined,
              guestName:
                !p.serverUserId && !p.serverPlaygroupPlayerId
                  ? p.name
                  : undefined,
              commanderUsed1:
                ov.commanderUsed1 || p.commanderUsed1 || undefined,
              commanderUsed2:
                ov.commanderUsed2 || p.commanderUsed2 || undefined,
              bracketUsed: ov.bracketUsed ?? p.bracketUsed ?? undefined,
            };
          }),
        }),
      });
      if (!createRes.ok)
        throw new Error(`Failed to create game (${createRes.status})`);
      const { game } = (await createRes.json()) as {
        game: { id: string; players: { id: string }[] };
      };

      let serverWinnerId: string | null = null;
      if (!isDraw && winnerId) {
        const winnerIndex = state.players.findIndex(
          (p) => p.id === winnerId
        );
        if (winnerIndex >= 0 && game.players[winnerIndex]) {
          serverWinnerId = game.players[winnerIndex].id;
        }
      }

      const endRes = await fetch(`/api/v1/games/${game.id}/end`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winnerId: serverWinnerId,
          isDraw,
          totalTurns: state.currentTurn,
        }),
      });
      if (!endRes.ok)
        throw new Error(`Failed to save result (${endRes.status})`);

      endActiveGame();
      router.replace(`/games/${game.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save game.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-2xl mx-auto px-5 py-6">
        <div className="flex items-center justify-between mb-6">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-zinc-400 hover:text-zinc-100"
          >
            ← Back
          </button>
          <h1 className="text-2xl font-bold">End Game</h1>
          <div className="w-16" />
        </div>

        <p className="text-center text-zinc-400 mb-6">
          Turn {state.currentTurn} · {state.format}
        </p>

        <button
          type="button"
          onClick={() => {
            setIsDraw(!isDraw);
            setWinnerId(null);
          }}
          className={[
            "w-full p-4 rounded-lg border mb-6 transition-colors",
            isDraw
              ? "border-amber-500 bg-amber-700/20 text-amber-400 font-bold"
              : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800",
          ].join(" ")}
        >
          Declare Draw {isDraw ? "✓" : ""}
        </button>

        {!isDraw && (
          <section className="mb-6">
            <h2 className="text-base font-bold text-zinc-400 uppercase tracking-wider mb-3">
              Select Winner
            </h2>
            <div className="space-y-2">
              {alivePlayers.map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => setWinnerId(player.id)}
                  className={[
                    "w-full flex items-center p-4 rounded-lg border transition-colors text-left",
                    winnerId === player.id
                      ? "border-amber-500 bg-amber-700/20"
                      : "border-zinc-800 bg-zinc-900 hover:bg-zinc-800",
                  ].join(" ")}
                >
                  <span className="flex-1 text-zinc-100 text-base">
                    {player.name}
                  </span>
                  <span className="text-zinc-400 text-sm mr-3">
                    {player.lifeTotal} life
                  </span>
                  {winnerId === player.id && (
                    <span className="text-amber-500 text-xl">✓</span>
                  )}
                </button>
              ))}
            </div>
          </section>
        )}

        {eliminatedPlayers.length > 0 && (
          <section className="mb-6">
            <h2 className="text-base font-bold text-zinc-400 uppercase tracking-wider mb-3">
              Eliminated
            </h2>
            <div>
              {eliminatedPlayers.map((player) => (
                <div
                  key={player.id}
                  className="flex justify-between p-3 border-b border-zinc-800"
                >
                  <span className="text-zinc-500">{player.name}</span>
                  <span className="text-zinc-500 text-sm">
                    Turn {player.eliminatedTurn}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Deck Info Section */}
        {showDeckSection && Object.keys(deckEdits).length > 0 && (
          <section className="mb-6">
            <h2 className="text-base font-bold text-zinc-400 uppercase tracking-wider mb-3">
              Deck Info
            </h2>
            <p className="text-xs text-zinc-500 mb-3">
              Add or update the decks used in this game before saving.
            </p>
            <div className="space-y-2">
              {state.players.map((player) => (
                <PlayerDeckFields
                  key={player.id}
                  playerId={player.id}
                  playerName={player.name}
                  format={state.format}
                  deckName={
                    player.serverDeckId
                      ? player.commanderUsed1 || "Selected deck"
                      : null
                  }
                  edit={
                    deckEdits[player.id] || {
                      commanderUsed1: "",
                      commanderUsed2: "",
                      bracketUsed: "",
                      saveAsNewDeck: false,
                    }
                  }
                  onChange={(edit) =>
                    setDeckEdits((prev) => ({
                      ...prev,
                      [player.id]: edit,
                    }))
                  }
                  canSaveDeck={
                    !!state.playgroupId &&
                    !!(player.serverUserId || player.serverPlaygroupPlayerId)
                  }
                />
              ))}
            </div>
          </section>
        )}

        {error && (
          <div className="mb-3 p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleEndGame}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-amber-500 text-zinc-950 font-bold text-lg disabled:opacity-60 hover:bg-amber-400 transition-colors"
        >
          {saving ? "Saving..." : "Save & End Game"}
        </button>

        <button
          type="button"
          onClick={handleRematch}
          className="w-full mt-3 py-3 rounded-xl border-2 border-amber-500 text-amber-400 font-bold flex items-center justify-center gap-2 hover:bg-amber-700/10"
        >
          ↻ Rematch — Same Players
        </button>
      </div>
    </div>
  );
}
