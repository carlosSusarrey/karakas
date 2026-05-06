"use client";

import { useEffect, type Dispatch } from "react";
import { isCommanderFormat } from "@karakas/shared";
import type { GameAction, PlayerState } from "@/lib/game-reducer";

type Props = {
  player: PlayerState;
  allPlayers: PlayerState[];
  format: string;
  dispatch: Dispatch<GameAction>;
  onClose: () => void;
};

function CounterRow({
  label,
  value,
  color,
  onIncrement,
  onDecrement,
}: {
  label: string;
  value: number;
  color?: string;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-base font-medium" style={color ? { color } : {}}>
        {label}
      </span>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onDecrement}
          className="w-10 h-10 rounded-full bg-zinc-700 text-zinc-100 text-xl font-bold flex items-center justify-center hover:bg-zinc-600"
        >
          −
        </button>
        <span
          className="text-xl font-bold min-w-[2ch] text-center"
          style={color ? { color } : {}}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={onIncrement}
          className="w-10 h-10 rounded-full bg-zinc-700 text-zinc-100 text-xl font-bold flex items-center justify-center hover:bg-zinc-600"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function PlayerDetailModal({
  player,
  allPlayers,
  format,
  dispatch,
  onClose,
}: Props) {
  const opponents = allPlayers.filter((p) => p.id !== player.id);
  const showCommander = isCommanderFormat(format);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 flex items-end sm:items-center sm:justify-center"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <h2 className="text-xl font-bold text-zinc-100">{player.name}</h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-6">
          {/* Counters */}
          <section>
            <h3 className="text-base font-bold text-zinc-400 uppercase tracking-wider mb-3">
              Counters
            </h3>
            <CounterRow
              label="☠ Poison"
              value={player.poisonCounters}
              color="#22c55e"
              onIncrement={() =>
                dispatch({ type: "CHANGE_POISON", playerId: player.id, amount: 1 })
              }
              onDecrement={() =>
                dispatch({ type: "CHANGE_POISON", playerId: player.id, amount: -1 })
              }
            />
            <CounterRow
              label="⚡ Energy"
              value={player.energyCounters}
              color="#facc15"
              onIncrement={() =>
                dispatch({ type: "CHANGE_ENERGY", playerId: player.id, amount: 1 })
              }
              onDecrement={() =>
                dispatch({ type: "CHANGE_ENERGY", playerId: player.id, amount: -1 })
              }
            />
            <CounterRow
              label="★ Experience"
              value={player.experienceCounters}
              color="#c084fc"
              onIncrement={() =>
                dispatch({ type: "CHANGE_EXPERIENCE", playerId: player.id, amount: 1 })
              }
              onDecrement={() =>
                dispatch({ type: "CHANGE_EXPERIENCE", playerId: player.id, amount: -1 })
              }
            />
          </section>

          {/* Designations */}
          <section>
            <h3 className="text-base font-bold text-zinc-400 uppercase tracking-wider mb-3">
              Designations
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() =>
                  dispatch(
                    player.isMonarch
                      ? { type: "CLEAR_MONARCH" }
                      : { type: "SET_MONARCH", playerId: player.id },
                  )
                }
                className={[
                  "flex-1 py-3 rounded-lg flex items-center justify-center gap-2 font-semibold transition-colors",
                  player.isMonarch
                    ? "bg-amber-700/40 border border-amber-500 text-zinc-100"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
                ].join(" ")}
              >
                <span className="text-lg">👑</span>
                <span>Monarch{player.isMonarch ? " ✓" : ""}</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  dispatch(
                    player.hasInitiative
                      ? { type: "CLEAR_INITIATIVE" }
                      : { type: "SET_INITIATIVE", playerId: player.id },
                  )
                }
                className={[
                  "flex-1 py-3 rounded-lg flex items-center justify-center gap-2 font-semibold transition-colors",
                  player.hasInitiative
                    ? "bg-blue-700/40 border border-blue-400 text-zinc-100"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700",
                ].join(" ")}
              >
                <span className="text-lg">⚔</span>
                <span>Initiative{player.hasInitiative ? " ✓" : ""}</span>
              </button>
            </div>
          </section>

          {/* Commander damage */}
          {showCommander && (
            <section>
              <h3 className="text-base font-bold text-zinc-400 uppercase tracking-wider mb-3">
                Commander Damage
              </h3>
              {opponents.map((opp) => {
                const damage = player.commanderDamage[opp.id] ?? 0;
                return (
                  <CounterRow
                    key={opp.id}
                    label={`From ${opp.name}`}
                    value={damage}
                    color="#ef4444"
                    onIncrement={() =>
                      dispatch({
                        type: "SET_COMMANDER_DAMAGE",
                        playerId: player.id,
                        sourceId: opp.id,
                        amount: damage + 1,
                      })
                    }
                    onDecrement={() =>
                      dispatch({
                        type: "SET_COMMANDER_DAMAGE",
                        playerId: player.id,
                        sourceId: opp.id,
                        amount: Math.max(0, damage - 1),
                      })
                    }
                  />
                );
              })}
            </section>
          )}

          {/* Eliminate */}
          <section>
            <button
              type="button"
              onClick={() =>
                dispatch({
                  type: player.isEliminated ? "REINSTATE_PLAYER" : "ELIMINATE_PLAYER",
                  playerId: player.id,
                })
              }
              className={[
                "w-full py-3 rounded-lg font-bold border transition-colors",
                player.isEliminated
                  ? "bg-green-900/30 border-green-500 text-zinc-100 hover:bg-green-900/50"
                  : "bg-red-900/30 border-red-500 text-zinc-100 hover:bg-red-900/50",
              ].join(" ")}
            >
              {player.isEliminated ? "Reinstate Player" : "Eliminate Player"}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
