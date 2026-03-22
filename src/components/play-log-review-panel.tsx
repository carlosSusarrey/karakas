"use client";

import { useState, useTransition } from "react";
import type { ExtractedPlayLogFromApi } from "./play-log-text-input";

interface PlayLogReviewPanelProps {
  playLogs: ExtractedPlayLogFromApi[];
  playerNames: string[];
  onSave: (playLogs: ExtractedPlayLogFromApi[]) => Promise<void>;
  onDismissAll: () => void;
}

function ConfidenceBadge({ confidence }: { confidence: string }) {
  const styles = {
    high: "bg-green-900/50 text-green-400",
    medium: "bg-yellow-900/50 text-yellow-400",
    low: "bg-zinc-800 text-zinc-400",
  };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded ${styles[confidence as keyof typeof styles] ?? styles.low}`}>
      {confidence}
    </span>
  );
}

function PlayLogEntry({
  log,
  onDismiss,
}: {
  log: ExtractedPlayLogFromApi;
  onDismiss: () => void;
}) {
  const isOutOfTurn = !!log.activePlayerName;

  return (
    <div className="p-3 flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
            T{log.turnNumber}
          </span>
          <span className="text-sm font-medium text-zinc-200">
            {log.playerName}
          </span>
          {isOutOfTurn && (
            <span className="text-xs bg-purple-900/50 text-purple-400 px-2 py-0.5 rounded">
              on {log.activePlayerName}&apos;s turn
            </span>
          )}
          <ConfidenceBadge confidence={log.confidence} />
        </div>
        {log.summary && (
          <p className="text-sm text-zinc-400 mt-1">{log.summary}</p>
        )}
        <div className="flex items-center gap-3 mt-1.5 flex-wrap">
          {log.cardsPlayed && log.cardsPlayed.length > 0 && (
            <span className="text-xs text-amber-500">
              {log.cardsPlayed.join(", ")}
            </span>
          )}
          {log.spellsCast != null && log.spellsCast > 0 && (
            <span className="text-xs text-zinc-500">{log.spellsCast} spell{log.spellsCast !== 1 ? "s" : ""}</span>
          )}
          {log.creaturesAttacked != null && log.creaturesAttacked > 0 && (
            <span className="text-xs text-red-400">{log.creaturesAttacked} attacker{log.creaturesAttacked !== 1 ? "s" : ""}</span>
          )}
          {log.lifeDelta != null && log.lifeDelta !== 0 && (
            <span className={`text-xs ${log.lifeDelta > 0 ? "text-green-400" : "text-red-400"}`}>
              {log.lifeDelta > 0 ? "+" : ""}{log.lifeDelta} life
            </span>
          )}
        </div>
      </div>
      <button
        onClick={onDismiss}
        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors shrink-0"
        title="Dismiss"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export function PlayLogReviewPanel({
  playLogs,
  playerNames,
  onSave,
  onDismissAll,
}: PlayLogReviewPanelProps) {
  const [logs, setLogs] = useState(playLogs);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);

  if (logs.length === 0 && !saved) return null;

  // Group logs by turn number
  const groupedByTurn = new Map<number, ExtractedPlayLogFromApi[]>();
  for (const log of logs) {
    const existing = groupedByTurn.get(log.turnNumber) ?? [];
    existing.push(log);
    groupedByTurn.set(log.turnNumber, existing);
  }
  const sortedTurns = [...groupedByTurn.keys()].sort((a, b) => a - b);

  function handleDismiss(index: number) {
    setLogs((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave() {
    startTransition(async () => {
      await onSave(logs);
      setSaved(true);
    });
  }

  if (saved) {
    return (
      <div className="bg-green-900/20 border border-green-800 rounded-xl p-4 mb-6 text-center">
        <p className="text-green-400 text-sm font-medium">
          Play logs saved successfully!
        </p>
      </div>
    );
  }

  // Calculate flat index for dismiss
  let flatIndex = 0;
  const turnEntries: { turn: number; log: ExtractedPlayLogFromApi; flatIdx: number }[] = [];
  for (const turn of sortedTurns) {
    const turnLogs = groupedByTurn.get(turn)!;
    for (const log of turnLogs) {
      turnEntries.push({ turn, log, flatIdx: flatIndex });
      flatIndex++;
    }
  }

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <span className="w-2 h-2 bg-blue-500 rounded-full" />
        Play Logs ({logs.length} entries, {sortedTurns.length} turns)
      </h2>

      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        {sortedTurns.map((turn) => {
          const turnLogs = groupedByTurn.get(turn)!;
          return (
            <div key={turn}>
              <div className="bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-400 font-medium border-b border-zinc-800">
                Turn {turn}
              </div>
              <div className="divide-y divide-zinc-800/50">
                {turnLogs.map((log) => {
                  const entry = turnEntries.find(
                    (e) => e.log === log
                  )!;
                  return (
                    <PlayLogEntry
                      key={`${log.playerName}-${log.turnNumber}-${log.activePlayerName ?? "active"}`}
                      log={log}
                      onDismiss={() => handleDismiss(entry.flatIdx)}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 mt-3">
        <button
          onClick={handleSave}
          disabled={isPending || logs.length === 0}
          className="flex-1 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 disabled:cursor-not-allowed text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {isPending ? "Saving..." : `Save ${logs.length} Play Logs`}
        </button>
        <button
          onClick={() => {
            setLogs([]);
            onDismissAll();
          }}
          disabled={isPending}
          className="px-4 py-2.5 border border-zinc-700 hover:border-zinc-500 text-zinc-300 rounded-lg text-sm transition-colors disabled:opacity-50"
        >
          Discard All
        </button>
      </div>
    </div>
  );
}
