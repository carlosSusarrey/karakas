"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGame } from "@/contexts/game-context";
import { PLAYER_PALETTE } from "@/lib/game-reducer";
import { PlayerPanel } from "@/components/game/player-panel";
import { PlayerDetailModal } from "@/components/game/player-detail-modal";

export default function PlayScreen() {
  const router = useRouter();
  const { state, dispatch, canUndo, canRedo, hasActiveGame, hydrated } = useGame();
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [swapSourceId, setSwapSourceId] = useState<string | null>(null);

  // Try to keep screen awake during play
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    type WakeLockSentinel = { release: () => Promise<void> };
    type NavigatorWithWakeLock = Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
    };
    const nav = typeof navigator !== "undefined" ? (navigator as NavigatorWithWakeLock) : null;
    if (nav?.wakeLock) {
      nav.wakeLock.request("screen").then((s) => (wakeLock = s)).catch(() => {});
    }
    return () => {
      wakeLock?.release().catch(() => {});
    };
  }, []);

  // Redirect to setup if no active game (but only after hydration so we don't bounce on refresh)
  useEffect(() => {
    if (hydrated && !hasActiveGame) {
      router.replace("/games/play/setup");
    }
  }, [hydrated, hasActiveGame, router]);

  const playerCount = state.players.length;

  const handleLifeChange = useCallback(
    (playerId: string, amount: number) => dispatch({ type: "CHANGE_LIFE", playerId, amount }),
    [dispatch],
  );

  const handleAdvanceTurn = useCallback(() => dispatch({ type: "ADVANCE_TURN" }), [dispatch]);
  const handleUndo = useCallback(() => canUndo && dispatch({ type: "UNDO" }), [canUndo, dispatch]);
  const handleRedo = useCallback(() => canRedo && dispatch({ type: "REDO" }), [canRedo, dispatch]);

  const handleResetGame = useCallback(() => {
    if (confirm("Reset all life totals and counters?")) {
      dispatch({ type: "RESET_GAME" });
    }
  }, [dispatch]);

  const handlePanelPress = useCallback(
    (playerId: string) => {
      if (reorderMode) {
        if (!swapSourceId) {
          setSwapSourceId(playerId);
        } else if (swapSourceId !== playerId) {
          const ids = state.players.map((p) => p.id);
          const fromIdx = ids.indexOf(swapSourceId);
          const toIdx = ids.indexOf(playerId);
          const newOrder = [...ids];
          [newOrder[fromIdx], newOrder[toIdx]] = [newOrder[toIdx], newOrder[fromIdx]];
          dispatch({ type: "REORDER_PLAYERS", playerIds: newOrder });
          setSwapSourceId(null);
        } else {
          setSwapSourceId(null);
        }
      } else {
        setSelectedPlayerId(playerId);
      }
    },
    [reorderMode, swapSourceId, state.players, dispatch],
  );

  const handlePanelLongPress = useCallback((playerId: string) => {
    setReorderMode(true);
    setSwapSourceId(playerId);
  }, []);

  const exitReorderMode = useCallback(() => {
    setReorderMode(false);
    setSwapSourceId(null);
  }, []);

  const selectedPlayer = selectedPlayerId
    ? (state.players.find((p) => p.id === selectedPlayerId) ?? null)
    : null;

  if (!hydrated || !hasActiveGame) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">
        Loading…
      </div>
    );
  }

  const renderPanel = (player: typeof state.players[number], index: number, rotated: boolean, compact: boolean) => (
    <PlayerPanel
      key={player.id}
      player={player}
      color={PLAYER_PALETTE[(player.colorIndex ?? index) % PLAYER_PALETTE.length]}
      isActive={!reorderMode && state.activePlayerIndex === index}
      rotated={!reorderMode && rotated}
      compact={compact}
      isSwapSource={swapSourceId === player.id}
      isSwapTarget={reorderMode && swapSourceId !== null && swapSourceId !== player.id}
      onLifeChange={(amt) => handleLifeChange(player.id, amt)}
      onPress={() => handlePanelPress(player.id)}
      onLongPress={() => handlePanelLongPress(player.id)}
    />
  );

  const renderLayout = () => {
    if (playerCount === 2) {
      return (
        <div className="flex flex-col flex-1">
          {renderPanel(state.players[0], 0, true, false)}
          {renderPanel(state.players[1], 1, false, false)}
        </div>
      );
    }
    const rows: React.ReactNode[] = [];
    for (let i = 0; i < playerCount; i += 2) {
      const rowPlayers = state.players.slice(i, Math.min(i + 2, playerCount));
      rows.push(
        <div key={i} className="flex flex-row flex-1">
          {rowPlayers.map((p, j) => renderPanel(p, i + j, i === 0 && playerCount > 2, playerCount > 2))}
        </div>,
      );
    }
    return <div className="flex flex-col flex-1">{rows}</div>;
  };

  const aliveCount = state.players.filter((p) => !p.isEliminated).length;
  const aliveBeforeIdx = state.players.filter(
    (p, i) => !p.isEliminated && i <= state.activePlayerIndex,
  ).length;

  return (
    <div className="fixed inset-0 flex flex-col bg-zinc-950 overscroll-none">
      {reorderMode && (
        <div className="flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/10 border-b border-amber-500">
          <span className="text-amber-400 text-lg">⇅</span>
          <span className="flex-1 text-amber-400 font-semibold text-sm">
            {swapSourceId ? "Tap another player to swap" : "Tap a player to pick up"}
          </span>
          <button
            type="button"
            onClick={exitReorderMode}
            className="flex items-center gap-1 bg-amber-500 text-zinc-950 px-3 py-1 rounded-full text-sm font-bold"
          >
            ✓ Done
          </button>
        </div>
      )}

      <div className="flex-1 flex flex-col">{renderLayout()}</div>

      <div className="flex items-center justify-center gap-1 px-3 py-2 bg-zinc-900 border-t border-zinc-800">
        <button
          type="button"
          onClick={handleUndo}
          disabled={!canUndo}
          className="w-10 h-10 rounded-full bg-zinc-800 text-zinc-100 flex items-center justify-center disabled:opacity-30 hover:bg-zinc-700"
          aria-label="Undo"
        >
          ↶
        </button>

        <button
          type="button"
          onClick={handleResetGame}
          className="w-10 h-10 rounded-full bg-zinc-800 text-zinc-100 flex items-center justify-center hover:bg-zinc-700"
          aria-label="Reset"
        >
          ⟳
        </button>

        <button
          type="button"
          onClick={() => (reorderMode ? exitReorderMode() : setReorderMode(true))}
          className={[
            "w-10 h-10 rounded-full flex items-center justify-center",
            reorderMode
              ? "bg-amber-700/30 border border-amber-500 text-amber-400"
              : "bg-zinc-800 text-zinc-100 hover:bg-zinc-700",
          ].join(" ")}
          aria-label="Reorder"
        >
          ⇅
        </button>

        <button
          type="button"
          onClick={handleAdvanceTurn}
          className="flex-1 px-3 py-1 flex flex-col items-center"
        >
          <span className="text-amber-400 text-base font-bold leading-none">
            Turn {state.currentTurn}
          </span>
          <span className="text-zinc-400 text-xs mt-0.5">
            {state.players[state.activePlayerIndex]?.name} ({aliveBeforeIdx}/{aliveCount})
          </span>
        </button>

        <button
          type="button"
          onClick={() => router.push("/games/play/end")}
          className="px-3 h-10 rounded-full bg-red-900/30 border border-red-500 text-red-400 flex items-center justify-center"
          aria-label="End game"
        >
          ⏹
        </button>

        <button
          type="button"
          onClick={handleRedo}
          disabled={!canRedo}
          className="w-10 h-10 rounded-full bg-zinc-800 text-zinc-100 flex items-center justify-center disabled:opacity-30 hover:bg-zinc-700"
          aria-label="Redo"
        >
          ↷
        </button>
      </div>

      {selectedPlayer && (
        <PlayerDetailModal
          player={selectedPlayer}
          allPlayers={state.players}
          format={state.format}
          dispatch={dispatch}
          onClose={() => setSelectedPlayerId(null)}
        />
      )}
    </div>
  );
}
