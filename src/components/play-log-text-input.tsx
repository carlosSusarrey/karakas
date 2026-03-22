"use client";

import { useState } from "react";

interface PlayLogTextInputProps {
  gameId: string;
  onExtracted: (playLogs: ExtractedPlayLogFromApi[]) => void;
  disabled?: boolean;
}

// Matches the API response shape
export interface ExtractedPlayLogFromApi {
  playerName: string;
  turnNumber: number;
  activePlayerName?: string;
  lifeTotal?: number;
  lifeDelta?: number;
  landsPlayed?: number;
  spellsCast?: number;
  creaturesAttacked?: number;
  commanderDamageDealt?: number;
  manaSpent?: number;
  cardsPlayed?: string[];
  attackedPlayerNames?: string[];
  eliminatedPlayerNames?: string[];
  summary?: string;
  confidence: "high" | "medium" | "low";
}

export function PlayLogTextInput({ gameId, onExtracted, disabled }: PlayLogTextInputProps) {
  const [transcript, setTranscript] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!transcript.trim()) return;

    setIsAnalyzing(true);
    setError(null);

    try {
      const res = await fetch(`/api/games/${gameId}/extract-play-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Extraction failed");
      }

      if (data.playLogs?.length) {
        onExtracted(data.playLogs);
      } else {
        setError("No play logs could be extracted from the transcript.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-zinc-300 mb-2">
        Game Transcript
      </h3>
      <p className="text-xs text-zinc-500 mb-3">
        Paste your game notes, chat log, or describe what happened each turn. The AI will extract structured play logs.
      </p>
      <textarea
        value={transcript}
        onChange={(e) => setTranscript(e.target.value)}
        placeholder={"Turn 1: Alice plays Sol Ring, passes. Bob plays Arcane Signet.\nTurn 2: Alice casts Rhystic Study. Bob responds with Swan Song..."}
        rows={6}
        disabled={disabled || isAnalyzing}
        className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500 resize-y disabled:opacity-50"
      />
      {error && (
        <p className="text-red-400 text-xs mt-2">{error}</p>
      )}
      <button
        onClick={handleAnalyze}
        disabled={disabled || isAnalyzing || !transcript.trim()}
        className="mt-3 w-full bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 disabled:cursor-not-allowed text-white py-2 rounded-lg text-sm font-medium transition-colors"
      >
        {isAnalyzing ? "Analyzing..." : "Analyze Game"}
      </button>
    </div>
  );
}
