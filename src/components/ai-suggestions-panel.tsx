"use client";

import { useState } from "react";
import { POWER_PLAY_LABELS, type PowerPlayType } from "@/types/mtg";
import type { SuggestedEvent } from "@/types/ai-events";

interface AiSuggestionsPanelProps {
  suggestions: SuggestedEvent[];
  playerNames: string[];
  onAccept: (event: SuggestedEvent, resolvedPlayerName?: string) => void;
  onDismiss: (index: number) => void;
}

function ConfidenceDot({ confidence }: { confidence: string }) {
  const colors = {
    high: "bg-green-500",
    medium: "bg-yellow-500",
    low: "bg-zinc-500",
  };
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${colors[confidence as keyof typeof colors] ?? colors.low}`}
      title={`${confidence} confidence`}
    />
  );
}

function EventTypeBadge({ event }: { event: SuggestedEvent }) {
  if (event.type === "power_play") {
    return (
      <span className="text-xs bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded">
        {POWER_PLAY_LABELS[event.powerPlayType]}
      </span>
    );
  }
  if (event.type === "elimination") {
    return (
      <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded">
        Elimination
      </span>
    );
  }
  return (
    <span className="text-xs bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded">
      Turn {event.newTurn}
    </span>
  );
}

function SuggestionCard({
  event,
  index,
  playerNames,
  onAccept,
  onDismiss,
}: {
  event: SuggestedEvent;
  index: number;
  playerNames: string[];
  onAccept: (event: SuggestedEvent, resolvedPlayerName?: string) => void;
  onDismiss: (index: number) => void;
}) {
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");

  const needsPlayerResolution =
    event.type !== "turn_advance" &&
    !playerNames.some(
      (n) => n.toLowerCase() === event.playerName.toLowerCase()
    );

  const description =
    event.type === "power_play"
      ? event.description
      : event.type === "elimination"
        ? `${event.playerName} eliminated${event.turn ? ` on turn ${event.turn}` : ""}`
        : `Advance to turn ${event.newTurn}`;

  const playerLabel =
    event.type === "turn_advance" ? null : event.playerName;

  const turnLabel =
    event.type === "power_play" && event.turn ? `T${event.turn}` : null;

  return (
    <div className="p-3 flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <ConfidenceDot confidence={event.confidence} />
          {turnLabel && (
            <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
              {turnLabel}
            </span>
          )}
          <EventTypeBadge event={event} />
          {playerLabel && (
            <span className="text-zinc-400 text-sm">{playerLabel}</span>
          )}
        </div>
        <div className="text-sm mt-1 text-zinc-200">
          {description}
          {event.type === "power_play" && event.cardName && (
            <span className="text-amber-500 ml-1">({event.cardName})</span>
          )}
        </div>
        {needsPlayerResolution && (
          <select
            value={selectedPlayer}
            onChange={(e) => setSelectedPlayer(e.target.value)}
            className="mt-2 text-sm bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-200"
          >
            <option value="">Select player...</option>
            {playerNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() =>
            onAccept(event, needsPlayerResolution ? selectedPlayer : undefined)
          }
          disabled={needsPlayerResolution && !selectedPlayer}
          className="p-1.5 text-green-400 hover:bg-green-900/30 rounded disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          title="Accept"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </button>
        <button
          onClick={() => onDismiss(index)}
          className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
          title="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function AiSuggestionsPanel({
  suggestions,
  playerNames,
  onAccept,
  onDismiss,
}: AiSuggestionsPanelProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (suggestions.length === 0) return null;

  return (
    <div className="mb-6">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="text-lg font-semibold mb-3 flex items-center gap-2 hover:text-amber-400 transition-colors"
      >
        <span className="w-2 h-2 bg-amber-500 rounded-full" />
        AI Suggestions ({suggestions.length})
        <svg
          className={`w-4 h-4 transition-transform ${collapsed ? "-rotate-90" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {!collapsed && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
          {suggestions.map((event, i) => (
            <SuggestionCard
              key={i}
              event={event}
              index={i}
              playerNames={playerNames}
              onAccept={onAccept}
              onDismiss={onDismiss}
            />
          ))}
        </div>
      )}
    </div>
  );
}
