"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { claimPlayer } from "@/app/playgroups/[id]/players/actions";

type Props = {
  token: string;
};

export function ClaimForm({ token }: Props) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    playgroupId: string;
    playgroupName: string;
    gamesLinked: number;
    decksLinked: number;
  } | null>(null);

  async function handleClaim() {
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await claimPlayer(token);

      if ("error" in result) {
        if ("requiresAuth" in result && result.requiresAuth) {
          router.push(`/login?redirect=/claim/${token}`);
          return;
        }
        setError(result.error || "An error occurred");
      } else if ("success" in result) {
        setSuccess({
          playgroupId: result.playgroupId,
          playgroupName: result.playgroupName,
          gamesLinked: result.gamesLinked,
          decksLinked: result.decksLinked,
        });
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="text-center">
        <div className="text-4xl mb-4">🎉</div>
        <h2 className="text-xl font-bold text-green-400 mb-2">Success!</h2>
        <p className="text-zinc-400 mb-4">
          Your account has been linked to your player profile in{" "}
          <span className="text-zinc-200">{success.playgroupName}</span>.
        </p>
        <div className="bg-zinc-800/50 rounded-lg p-3 mb-6 text-sm">
          <div className="flex justify-between mb-1">
            <span className="text-zinc-400">Games linked</span>
            <span>{success.gamesLinked}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Decks linked</span>
            <span>{success.decksLinked}</span>
          </div>
        </div>
        <button
          onClick={() => router.push(`/playgroups/${success.playgroupId}`)}
          className="w-full bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg transition-colors"
        >
          Go to Playgroup
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      <p className="text-center text-zinc-400 text-sm">
        Claiming this player will link all their game history to your account.
      </p>

      <button
        onClick={handleClaim}
        disabled={isSubmitting}
        className="w-full bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 disabled:cursor-not-allowed text-white px-4 py-3 rounded-lg transition-colors font-medium"
      >
        {isSubmitting ? "Claiming..." : "Claim Player"}
      </button>
    </div>
  );
}
