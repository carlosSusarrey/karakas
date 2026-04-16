"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteGame } from "./edit/actions";

export function DeleteGameButton({ gameId, redirectTo }: { gameId: string; redirectTo: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteGame(gameId);
      if ("error" in result) {
        setError(result.error);
        setShowConfirm(false);
      } else {
        router.push(redirectTo);
        router.refresh();
      }
    });
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="text-zinc-500 hover:text-red-400 text-sm transition-colors"
      >
        Delete
      </button>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md mx-4">
            <h3 className="text-xl font-semibold mb-4">Delete Game?</h3>
            <p className="text-zinc-400 mb-6">
              This will permanently delete this game and all associated data including
              player results and power plays. This action cannot be undone.
            </p>
            {error && (
              <p className="text-red-400 text-sm mb-4">{error}</p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isPending}
                className="px-4 py-2 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={isPending}
                className="bg-red-600 hover:bg-red-500 disabled:bg-red-800 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {isPending ? "Deleting..." : "Delete Game"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
