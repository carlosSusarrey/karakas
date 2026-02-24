"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, useCallback, useRef } from "react";
import type { Game, GamePlayer, Deck, PowerPlay } from "@/generated/prisma/client";
import {
  FORMAT_LABELS,
  POWER_PLAY_TYPES,
  POWER_PLAY_LABELS,
  type MtgFormat,
  type PowerPlayType,
} from "@/types/mtg";
import type { SuggestedEvent } from "@/types/ai-events";
import {
  updateTurnCount,
  eliminatePlayer,
  reinstatePlayer,
  addPowerPlay,
  removePowerPlay,
  endGame,
} from "./actions";
import { Header } from "@/components/header";
import { CardAutocomplete } from "@/components/card-autocomplete";
import { useAudioRecorder } from "@/hooks/use-audio-recorder";
import { AiRecordingControls } from "@/components/ai-recording-controls";
import { AiSuggestionsPanel } from "@/components/ai-suggestions-panel";

type PlayerUser = { id: string; username: string } | null;
type PlayerPlaygroupPlayer = { id: string; name: string } | null;

type GamePlayerWithRelations = GamePlayer & {
  deck: Deck | null;
  user: PlayerUser;
  playgroupPlayer: PlayerPlaygroupPlayer;
};

type PowerPlayGamePlayer = GamePlayer & {
  user: { username: string } | null;
  playgroupPlayer: { name: string } | null;
};

type GameWithRelations = Game & {
  playgroup: { id: string; name: string } | null;
  players: GamePlayerWithRelations[];
  powerPlays: (PowerPlay & { gamePlayer: PowerPlayGamePlayer })[];
};

export function GameTracker({ game, username }: { game: GameWithRelations; username?: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [turns, setTurns] = useState(game.totalTurns || 1);
  const [showEndGameModal, setShowEndGameModal] = useState(false);
  const [showPowerPlayModal, setShowPowerPlayModal] = useState(false);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [powerPlayForm, setPowerPlayForm] = useState({
    type: "combo" as PowerPlayType,
    description: "",
    cardName: "",
  });

  // AI state
  const [aiSuggestions, setAiSuggestions] = useState<SuggestedEvent[]>([]);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiChunksProcessed, setAiChunksProcessed] = useState(0);
  const cumulativeTranscriptRef = useRef("");
  const turnsRef = useRef(turns);
  turnsRef.current = turns;

  const processAudioChunk = useCallback(
    async (chunk: Blob) => {
      setAiProcessing(true);
      setAiError(null);
      try {
        // Transcribe
        const formData = new FormData();
        formData.append("audio", chunk);
        const transcribeRes = await fetch(
          `/api/games/${game.id}/transcribe`,
          { method: "POST", body: formData }
        );
        if (!transcribeRes.ok) {
          const err = await transcribeRes.json();
          throw new Error(err.error || "Transcription failed");
        }
        const { transcript } = await transcribeRes.json();
        if (!transcript?.trim()) {
          setAiChunksProcessed((n) => n + 1);
          return;
        }

        // Extract events
        const extractRes = await fetch(
          `/api/games/${game.id}/extract-events`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transcript,
              previousTranscript: cumulativeTranscriptRef.current,
              currentTurn: turnsRef.current,
            }),
          }
        );
        const { events } = await extractRes.json();
        cumulativeTranscriptRef.current += "\n" + transcript;
        if (events?.length) {
          setAiSuggestions((prev) => [...prev, ...events]);
        }
        setAiChunksProcessed((n) => n + 1);
      } catch (err) {
        setAiError(err instanceof Error ? err.message : "Processing failed");
      } finally {
        setAiProcessing(false);
      }
    },
    [game.id]
  );

  const { isRecording, isSupported, startRecording, stopRecording } =
    useAudioRecorder({
      chunkIntervalMs: 5 * 60 * 1000,
      onChunkReady: processAudioChunk,
      onError: setAiError,
    });

  const activePlayers = game.players.filter((p) => p.eliminatedTurn === null);
  const eliminatedPlayers = game.players
    .filter((p) => p.eliminatedTurn !== null)
    .sort((a, b) => (b.eliminatedTurn || 0) - (a.eliminatedTurn || 0));

  function getPlayerName(player: GamePlayerWithRelations | PowerPlayGamePlayer) {
    if (player.user) {
      return player.user.username;
    }
    if (player.playgroupPlayer) {
      return player.playgroupPlayer.name;
    }
    return player.guestName || "Unknown Player";
  }

  function resolvePlayerByName(name: string) {
    return game.players.find((p) => {
      const pName = getPlayerName(p).toLowerCase();
      return pName === name.toLowerCase() || pName.includes(name.toLowerCase()) || name.toLowerCase().includes(pName);
    });
  }

  const playerNames = game.players.map((p) => getPlayerName(p));

  function handleAcceptSuggestion(event: SuggestedEvent, resolvedPlayerName?: string) {
    const playerName = resolvedPlayerName || (event.type !== "turn_advance" ? event.playerName : "");
    const player = playerName ? resolvePlayerByName(playerName) : undefined;

    if (event.type === "turn_advance") {
      const newTurns = event.newTurn;
      setTurns(newTurns);
      startTransition(async () => {
        await updateTurnCount(game.id, newTurns);
      });
    } else if (event.type === "elimination" && player) {
      handleEliminate(player.id);
    } else if (event.type === "power_play" && player) {
      startTransition(async () => {
        await addPowerPlay(
          game.id,
          player.id,
          player.userId || null,
          event.turn ?? turns,
          event.powerPlayType,
          event.description,
          event.cardName
        );
        router.refresh();
      });
    }

    setAiSuggestions((prev) =>
      prev.filter((s) => s !== event)
    );
  }

  function handleDismissSuggestion(index: number) {
    setAiSuggestions((prev) => prev.filter((_, i) => i !== index));
  }

  function handleTurnChange(delta: number) {
    const newTurns = Math.max(1, turns + delta);
    setTurns(newTurns);
    startTransition(async () => {
      await updateTurnCount(game.id, newTurns);
    });
  }

  function handleEliminate(playerId: string) {
    const isFirstElimination = eliminatedPlayers.length === 0;
    startTransition(async () => {
      await eliminatePlayer(game.id, playerId, turns, isFirstElimination);
      router.refresh();
    });
  }

  function handleReinstate(playerId: string) {
    startTransition(async () => {
      await reinstatePlayer(game.id, playerId);
      router.refresh();
    });
  }

  function openPowerPlayModal(playerId: string) {
    setSelectedPlayerId(playerId);
    setPowerPlayForm({ type: "combo", description: "", cardName: "" });
    setShowPowerPlayModal(true);
  }

  function handleAddPowerPlay() {
    if (!selectedPlayerId || !powerPlayForm.description.trim()) return;

    const player = game.players.find((p) => p.id === selectedPlayerId);

    startTransition(async () => {
      await addPowerPlay(
        game.id,
        selectedPlayerId,
        player?.userId || null,
        turns,
        powerPlayForm.type,
        powerPlayForm.description.trim(),
        powerPlayForm.cardName.trim() || undefined
      );
      setShowPowerPlayModal(false);
      router.refresh();
    });
  }

  function handleRemovePowerPlay(powerPlayId: string) {
    startTransition(async () => {
      await removePowerPlay(game.id, powerPlayId);
      router.refresh();
    });
  }

  const [showSummaryLoading, setShowSummaryLoading] = useState(false);

  async function handleRequestEndGame() {
    // If AI was used, stop recording and run a final summary pass
    if (cumulativeTranscriptRef.current.trim()) {
      if (isRecording) stopRecording();
      setShowSummaryLoading(true);
      try {
        const extractRes = await fetch(
          `/api/games/${game.id}/extract-events`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              transcript: cumulativeTranscriptRef.current,
              currentTurn: turns,
              isSummary: true,
            }),
          }
        );
        const { events } = await extractRes.json();
        if (events?.length) {
          setAiSuggestions((prev) => [...prev, ...events]);
        }
      } catch {
        // Summary failed — continue to end game anyway
      } finally {
        setShowSummaryLoading(false);
      }
    }
    setShowEndGameModal(true);
  }

  function handleEndGame(winnerId: string | null, isDraw: boolean) {
    startTransition(async () => {
      await endGame(game.id, winnerId, isDraw);
      router.push(`/games/${game.id}`);
    });
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950">
      <Header username={username} activeTab="games" />

      {/* Main Content */}
      <main className="flex-1 px-6 py-6">
        <div className="max-w-4xl mx-auto">
          {/* Turn Counter - Prominent at top */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6 text-center">
            <div className="text-zinc-400 text-sm uppercase tracking-wide mb-2">
              Current Turn
            </div>
            <div className="flex items-center justify-center gap-6">
              <button
                onClick={() => handleTurnChange(-1)}
                disabled={isPending || turns <= 1}
                className="w-12 h-12 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-2xl font-bold transition-colors"
              >
                -
              </button>
              <span className="text-6xl font-bold text-amber-500 tabular-nums min-w-[100px]">
                {turns}
              </span>
              <button
                onClick={() => handleTurnChange(1)}
                disabled={isPending}
                className="w-12 h-12 rounded-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-2xl font-bold transition-colors"
              >
                +
              </button>
            </div>
            <div className="mt-4 flex justify-center">
              <AiRecordingControls
                isRecording={isRecording}
                isSupported={isSupported}
                isProcessing={aiProcessing}
                chunksProcessed={aiChunksProcessed}
                error={aiError}
                onStart={startRecording}
                onStop={stopRecording}
              />
            </div>
          </div>

          {/* Active Players */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Active Players ({activePlayers.length})
            </h2>
            <div className="grid gap-3">
              {activePlayers.map((player) => (
                <div
                  key={player.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-lg">
                        {getPlayerName(player)}
                      </div>
                      {player.commanderUsed1 && (
                        <div className="text-zinc-400 text-sm">
                          {player.commanderUsed1}
                          {player.commanderUsed2 && ` / ${player.commanderUsed2}`}
                        </div>
                      )}
                      {player.deck && (
                        <div className="text-zinc-500 text-xs mt-1">
                          Deck: {player.deck.name}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openPowerPlayModal(player.id)}
                        disabled={isPending}
                        className="px-3 py-1.5 text-sm bg-amber-600/20 text-amber-500 hover:bg-amber-600/30 rounded-lg transition-colors disabled:opacity-50"
                      >
                        + Play
                      </button>
                      <button
                        onClick={() => handleEliminate(player.id)}
                        disabled={isPending}
                        className="px-3 py-1.5 text-sm bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded-lg transition-colors disabled:opacity-50"
                      >
                        Eliminate
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Eliminated Players */}
          {eliminatedPlayers.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                Eliminated ({eliminatedPlayers.length})
              </h2>
              <div className="grid gap-2">
                {eliminatedPlayers.map((player) => (
                  <div
                    key={player.id}
                    className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3 opacity-60"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-medium">{getPlayerName(player)}</span>
                        <span className="text-zinc-500 text-sm ml-2">
                          Turn {player.eliminatedTurn}
                          {player.isFirstOut && " (First Out)"}
                        </span>
                      </div>
                      <button
                        onClick={() => handleReinstate(player.id)}
                        disabled={isPending}
                        className="text-zinc-400 hover:text-zinc-200 text-sm disabled:opacity-50"
                      >
                        Undo
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Suggestions */}
          <AiSuggestionsPanel
            suggestions={aiSuggestions}
            playerNames={playerNames}
            onAccept={handleAcceptSuggestion}
            onDismiss={handleDismissSuggestion}
          />

          {/* Power Plays Log */}
          {game.powerPlays.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3">Notable Plays</h2>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
                {game.powerPlays.map((play) => (
                  <div key={play.id} className="p-3 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                          T{play.turn}
                        </span>
                        <span className="text-xs bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded">
                          {POWER_PLAY_LABELS[play.type as PowerPlayType]}
                        </span>
                        <span className="text-zinc-400 text-sm">
                          {getPlayerName(play.gamePlayer)}
                        </span>
                      </div>
                      <div className="text-sm mt-1">
                        {play.description}
                        {play.cardName && (
                          <span className="text-amber-500 ml-1">({play.cardName})</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemovePowerPlay(play.id)}
                      disabled={isPending}
                      className="text-zinc-500 hover:text-red-400 text-sm disabled:opacity-50"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* End Game Button */}
          <div className="mt-8">
            <button
              onClick={handleRequestEndGame}
              disabled={isPending || showSummaryLoading}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 text-white py-4 rounded-xl font-semibold text-lg transition-colors"
            >
              {showSummaryLoading ? "Running AI Summary..." : "End Game"}
            </button>
          </div>
        </div>
      </main>

      {/* End Game Modal */}
      {showEndGameModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">End Game</h2>
            <p className="text-zinc-400 mb-6">
              Select the winner or declare a draw.
            </p>

            <div className="space-y-3 mb-6">
              {activePlayers.map((player) => (
                <button
                  key={player.id}
                  onClick={() => handleEndGame(player.id, false)}
                  disabled={isPending}
                  className="w-full text-left bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-amber-500 p-4 rounded-lg transition-colors disabled:opacity-50"
                >
                  <div className="font-semibold">{getPlayerName(player)}</div>
                  {player.commanderUsed1 && (
                    <div className="text-zinc-400 text-sm">{player.commanderUsed1}</div>
                  )}
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => handleEndGame(null, true)}
                disabled={isPending}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 py-3 rounded-lg transition-colors disabled:opacity-50"
              >
                Declare Draw
              </button>
              <button
                onClick={() => setShowEndGameModal(false)}
                className="flex-1 border border-zinc-700 hover:border-zinc-500 text-zinc-300 py-3 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Power Play Modal */}
      {showPowerPlayModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Add Notable Play</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Type</label>
                <select
                  value={powerPlayForm.type}
                  onChange={(e) =>
                    setPowerPlayForm({
                      ...powerPlayForm,
                      type: e.target.value as PowerPlayType,
                    })
                  }
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
                >
                  {POWER_PLAY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {POWER_PLAY_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Description *
                </label>
                <input
                  type="text"
                  value={powerPlayForm.description}
                  onChange={(e) =>
                    setPowerPlayForm({
                      ...powerPlayForm,
                      description: e.target.value,
                    })
                  }
                  placeholder="What happened?"
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">
                  Card Name (optional)
                </label>
                <CardAutocomplete
                  id="powerplay-card"
                  name="powerplay-card"
                  value={powerPlayForm.cardName}
                  onChange={(value) =>
                    setPowerPlayForm({
                      ...powerPlayForm,
                      cardName: value,
                    })
                  }
                  placeholder="Primary card involved"
                  commanderOnly={false}
                  showPreview={true}
                  className="bg-zinc-800"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleAddPowerPlay}
                disabled={isPending || !powerPlayForm.description.trim()}
                className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 disabled:cursor-not-allowed text-white py-3 rounded-lg transition-colors"
              >
                Add Play
              </button>
              <button
                onClick={() => setShowPowerPlayModal(false)}
                className="flex-1 border border-zinc-700 hover:border-zinc-500 text-zinc-300 py-3 rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
