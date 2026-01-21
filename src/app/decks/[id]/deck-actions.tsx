"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Deck } from "@/generated/prisma/client";
import { deleteDeck, toggleArchiveDeck } from "./actions";

export function DeckActions({ deck }: { deck: Deck }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  async function handleArchive() {
    startTransition(async () => {
      await toggleArchiveDeck(deck.id);
      router.refresh();
    });
  }

  async function handleDelete() {
    startTransition(async () => {
      const result = await deleteDeck(deck.id);
      if ("success" in result) {
        router.push("/decks");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/decks/${deck.id}/edit`}
        className="text-zinc-400 hover:text-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 transition-colors text-sm"
      >
        Edit
      </Link>
      <button
        onClick={handleArchive}
        disabled={isPending}
        className="text-zinc-400 hover:text-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-700 hover:border-zinc-500 transition-colors text-sm disabled:opacity-50"
      >
        {deck.isActive ? "Archive" : "Restore"}
      </button>
      {showDeleteConfirm ? (
        <div className="flex items-center gap-2">
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-800 hover:border-red-600 transition-colors text-sm disabled:opacity-50"
          >
            Confirm Delete
          </button>
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="text-zinc-400 hover:text-zinc-100 px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg border border-red-800/50 hover:border-red-800 transition-colors text-sm"
        >
          Delete
        </button>
      )}
    </div>
  );
}
