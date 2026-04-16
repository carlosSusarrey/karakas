"use client";

import { useState } from "react";

type Player = {
  name: string;
  commander?: string | null;
  placement?: number | null;
  isWinner: boolean;
};

type Props = {
  gameId: string;
  format: string;
  turns: number | null;
  playedAt: Date;
  winner?: Player;
  players: Player[];
  playgroupName?: string;
};

export function ShareButton({
  gameId,
  format,
  turns,
  playedAt,
  winner,
  players,
  playgroupName,
}: Props) {
  const [showModal, setShowModal] = useState(false);
  const [copied, setCopied] = useState(false);

  const gameUrl = typeof window !== "undefined"
    ? `${window.location.origin}/games/${gameId}`
    : `/games/${gameId}`;

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(date));
  };

  const generateTextSummary = () => {
    let summary = `MTG Game - ${format}`;
    if (playgroupName) {
      summary += ` (${playgroupName})`;
    }
    summary += `\n${formatDate(playedAt)}`;
    if (turns) {
      summary += ` - ${turns} turns`;
    }
    summary += "\n\n";

    if (winner) {
      summary += `Winner: ${winner.name}`;
      if (winner.commander) {
        summary += ` (${winner.commander})`;
      }
      summary += "\n\n";
    }

    summary += "Results:\n";
    const sortedPlayers = [...players].sort((a, b) => (a.placement || 99) - (b.placement || 99));
    sortedPlayers.forEach((player, index) => {
      const placement = player.placement || index + 1;
      summary += `${placement}. ${player.name}`;
      if (player.commander) {
        summary += ` - ${player.commander}`;
      }
      if (player.isWinner) {
        summary += " (Winner)";
      }
      summary += "\n";
    });

    summary += `\nTracked with Karakas: ${gameUrl}`;

    return summary;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `MTG Game - ${format}`,
          text: generateTextSummary(),
          url: gameUrl,
        });
      } catch {
        // User cancelled or error
      }
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        onClick={shareNative}
        className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors flex items-center gap-1"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
          />
        </svg>
        Share
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-lg w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Share Game Results</h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-zinc-400 hover:text-zinc-200"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Text Summary */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-400 mb-2">
                Game Summary
              </label>
              <pre className="bg-zinc-800 rounded-lg p-3 text-sm text-zinc-300 whitespace-pre-wrap overflow-x-auto max-h-48 overflow-y-auto">
                {generateTextSummary()}
              </pre>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => copyToClipboard(generateTextSummary())}
                className="flex-1 bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {copied ? "Copied!" : "Copy Summary"}
              </button>
              <button
                onClick={() => copyToClipboard(gameUrl)}
                className="flex-1 bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Copy Link
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
