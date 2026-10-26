"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  buildCompleteGameRequest,
  rematchSetup,
  type CompleteGameResponse,
  type GameState,
} from "@karakas/shared";
import { useGame } from "@/contexts/game-context";
import { isCommanderFormat, hasBrackets } from "@/types/mtg";
import {
  PlayerDeckFields,
  type PlayerDeckEdit,
} from "@/components/player-deck-fields";
import { saveSetupDraft } from "@/lib/setup-draft";

type Saved = {
  gameId: string;
  resultLabel: string;
  finishedState: GameState;
  createdDecks: CompleteGameResponse["createdDecks"];
};

const EMPTY_EDIT: PlayerDeckEdit = {
  commanderUsed1: "",
  commanderUsed2: "",
  bracketUsed: "",
  saveAsNewDeck: false,
};

/** Apply the optional deck-info edits to the finished game state. */
function applyDeckEdits(
  state: GameState,
  edits: Record<string, PlayerDeckEdit>,
): GameState {
  return {
    ...state,
    players: state.players.map((p) => {
      const edit = edits[p.id];
      if (!edit) return p;
      const commanderUsed1 = edit.commanderUsed1 || p.commanderUsed1;
      const commanderUsed2 = edit.commanderUsed2 || p.commanderUsed2;
      const bracketUsed = edit.bracketUsed ? parseInt(edit.bracketUsed) : p.bracketUsed;
      const hasDeck = !!(p.serverDeckId || p.serverPlaygroupPlayerDeckId);
      return {
        ...p,
        commanderUsed1,
        commanderUsed2,
        bracketUsed,
        pendingNewDeck:
          edit.saveAsNewDeck && commanderUsed1 && !hasDeck
            ? { name: commanderUsed1, commander1: commanderUsed1, commander2: commanderUsed2, bracket: bracketUsed }
            : p.pendingNewDeck,
      };
    }),
  };
}

export default function EndGameScreen() {
  const router = useRouter();
  const { state, endActiveGame, hasActiveGame, hydrated } = useGame();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showAllPlayers, setShowAllPlayers] = useState(false);
  const [deckEdits, setDeckEdits] = useState<Record<string, PlayerDeckEdit>>({});

  const showDeckSection =
    isCommanderFormat(state.format) || hasBrackets(state.format);

  useEffect(() => {
    if (hydrated && !hasActiveGame && !saved) {
      router.replace("/games/play/setup");
    }
  }, [hydrated, hasActiveGame, saved, router]);

  if (saved) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <div className="max-w-md mx-auto px-5 py-10 text-center">
          <div className="text-5xl mb-3">🏆</div>
          <h1 className="text-2xl font-bold mb-1">{saved.resultLabel}</h1>
          <p className="text-zinc-400 mb-8">Game saved.</p>

          <button
            type="button"
            onClick={() => {
              saveSetupDraft({
                format: saved.finishedState.format,
                playgroupId: saved.finishedState.playgroupId,
                players: rematchSetup(saved.finishedState, saved.createdDecks),
                rematch: true,
              });
              router.replace("/games/play/setup?rematch=1");
            }}
            className="w-full py-3 rounded-xl bg-amber-500 text-zinc-950 font-bold text-lg hover:bg-amber-400 transition-colors"
          >
            ↻ Rematch
          </button>
          <Link
            href={`/games/${saved.gameId}/edit`}
            className="block w-full mt-3 py-3 rounded-xl border border-zinc-700 text-zinc-200 font-semibold hover:bg-zinc-900"
          >
            Add details or fix result
          </Link>
          <Link
            href={`/games/${saved.gameId}`}
            className="block w-full mt-3 py-3 rounded-xl text-zinc-400 hover:text-zinc-100"
          >
            Done
          </Link>
        </div>
      </div>
    );
  }

  if (!hydrated || !hasActiveGame) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">
        Loading...
      </div>
    );
  }

  const alivePlayers = state.players.filter((p) => !p.isEliminated);
  const winnerCandidates =
    showAllPlayers || alivePlayers.length === 0 ? state.players : alivePlayers;
  const eliminatedPlayers = state.players
    .filter((p) => p.isEliminated)
    .sort((a, b) => (b.eliminatedTurn ?? 0) - (a.eliminatedTurn ?? 0));

  const finish = async (winnerPlayerId: string | null, isDraw: boolean) => {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      const finishedState = applyDeckEdits(state, deckEdits);
      const res = await fetch("/api/v1/games/complete", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildCompleteGameRequest(finishedState, { winnerPlayerId, isDraw }),
        ),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `Failed to save game (${res.status})`);
      }
      const { game, createdDecks } = (await res.json()) as CompleteGameResponse;
      const winner = finishedState.players.find((p) => p.id === winnerPlayerId);
      setSaved({
        gameId: game.id,
        resultLabel: isDraw ? "It's a draw" : `${winner?.name ?? "Winner"} wins!`,
        finishedState,
        createdDecks,
      });
      endActiveGame();
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
          <h1 className="text-2xl font-bold">Who won?</h1>
          <div className="w-16" />
        </div>

        <p className="text-center text-zinc-400 mb-6">
          Turn {state.currentTurn} · {state.format} · tap the winner to save
        </p>

        <div className="space-y-2 mb-3">
          {winnerCandidates.map((player) => (
            <button
              key={player.id}
              type="button"
              disabled={saving}
              onClick={() => finish(player.id, false)}
              className="w-full flex items-center p-4 rounded-lg border border-zinc-800 bg-zinc-900 hover:border-amber-500 hover:bg-amber-700/10 transition-colors text-left disabled:opacity-60"
            >
              <span className="flex-1 text-zinc-100 text-lg font-semibold">
                {player.name}
              </span>
              <span className="text-zinc-400 text-sm">
                {player.isEliminated ? "eliminated" : `${player.lifeTotal} life`}
              </span>
            </button>
          ))}
        </div>

        <div className="flex gap-2 mb-6">
          <button
            type="button"
            disabled={saving}
            onClick={() => finish(null, true)}
            className="flex-1 p-3 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 disabled:opacity-60"
          >
            Draw
          </button>
          {!showAllPlayers && eliminatedPlayers.length > 0 && alivePlayers.length > 0 && (
            <button
              type="button"
              onClick={() => setShowAllPlayers(true)}
              className="flex-1 p-3 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            >
              Someone else won
            </button>
          )}
        </div>

        {saving && <p className="text-center text-amber-400 mb-4">Saving…</p>}

        {error && (
          <div className="mb-4 p-3 bg-red-900/30 border border-red-500 rounded-lg text-red-400 text-sm">
            {error} — tap the winner again to retry.
          </div>
        )}

        {eliminatedPlayers.length > 0 && (
          <section className="mb-6">
            <h2 className="text-sm font-bold text-zinc-500 uppercase tracking-wider mb-2">
              Eliminated
            </h2>
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
          </section>
        )}

        {showDeckSection && (
          <section className="mb-6">
            <button
              type="button"
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-zinc-400 hover:text-zinc-100"
            >
              {showDetails ? "▾" : "▸"} Add deck info before saving (optional)
            </button>
            {showDetails && (
              <div className="space-y-2 mt-3">
                {state.players.map((player) => (
                  <PlayerDeckFields
                    key={player.id}
                    playerId={player.id}
                    playerName={player.name}
                    format={state.format}
                    deckName={
                      player.serverDeckId || player.serverPlaygroupPlayerDeckId
                        ? player.commanderUsed1 || "Selected deck"
                        : player.pendingNewDeck
                          ? `New: ${player.pendingNewDeck.name}`
                          : null
                    }
                    edit={
                      deckEdits[player.id] ?? {
                        ...EMPTY_EDIT,
                        commanderUsed1: player.commanderUsed1 || "",
                        commanderUsed2: player.commanderUsed2 || "",
                        bracketUsed: player.bracketUsed?.toString() || "",
                      }
                    }
                    onChange={(edit) =>
                      setDeckEdits((prev) => ({ ...prev, [player.id]: edit }))
                    }
                    canSaveDeck={
                      !!state.playgroupId &&
                      !!(player.serverUserId || player.serverPlaygroupPlayerId)
                    }
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
