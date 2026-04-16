"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPlaygroupPlayer } from "./actions";
import { AlertMessage } from "@/components/alert-message";

type Props = {
  playgroupId: string;
};

export function PlayerForm({ playgroupId }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Player name is required");
      return;
    }

    startTransition(async () => {
      const result = await createPlaygroupPlayer(
        playgroupId,
        name.trim(),
        email.trim() || undefined
      );

      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setName("");
        setEmail("");
        setShowForm(false);
        router.refresh();
      }
    });
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg transition-colors"
      >
        + Add Player
      </button>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h2 className="text-lg font-semibold mb-4">Add New Player</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <AlertMessage variant="error" className="text-sm">
            {error}
          </AlertMessage>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-zinc-300 mb-1"
            >
              Name *
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Player name"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-zinc-300 mb-1"
            >
              Email (optional)
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="For claim invitations"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
        </div>
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            {isPending ? "Adding..." : "Add Player"}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowForm(false);
              setName("");
              setEmail("");
              setError(null);
            }}
            className="text-zinc-400 hover:text-zinc-300 px-4 py-2 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
