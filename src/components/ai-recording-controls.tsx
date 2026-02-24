"use client";

interface AiRecordingControlsProps {
  isRecording: boolean;
  isSupported: boolean;
  isProcessing: boolean;
  chunksProcessed: number;
  error: string | null;
  onStart: () => void;
  onStop: () => void;
}

export function AiRecordingControls({
  isRecording,
  isSupported,
  isProcessing,
  chunksProcessed,
  error,
  onStart,
  onStop,
}: AiRecordingControlsProps) {
  if (!isSupported) return null;

  return (
    <div className="flex items-center gap-3">
      {isRecording ? (
        <button
          onClick={onStop}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-red-900/30 text-red-400 hover:bg-red-900/50 rounded-lg transition-colors"
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
          Stop AI
        </button>
      ) : (
        <button
          onClick={onStart}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-amber-600/20 text-amber-500 hover:bg-amber-600/30 rounded-lg transition-colors"
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
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
          AI Listen
        </button>
      )}

      {isProcessing && (
        <span className="text-xs text-zinc-400 animate-pulse">
          Processing...
        </span>
      )}

      {chunksProcessed > 0 && !isProcessing && (
        <span className="text-xs text-zinc-500">
          {chunksProcessed} chunk{chunksProcessed !== 1 ? "s" : ""} processed
        </span>
      )}

      {error && (
        <span className="text-xs text-red-400">{error}</span>
      )}
    </div>
  );
}
