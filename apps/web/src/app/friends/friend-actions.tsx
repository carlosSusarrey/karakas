"use client";

import { useState } from "react";
import {
  acceptFriendRequest,
  declineFriendRequest,
  removeFriend,
  cancelFriendRequest,
} from "./actions";

type Props = {
  friendshipId: string;
  type: "received" | "sent" | "friend";
};

export function FriendActions({ friendshipId, type }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    setIsLoading(true);
    setError(null);
    const result = await acceptFriendRequest(friendshipId);
    if ("error" in result) {
      setError(result.error || "An error occurred");
    }
    setIsLoading(false);
  }

  async function handleDecline() {
    setIsLoading(true);
    setError(null);
    const result = await declineFriendRequest(friendshipId);
    if ("error" in result) {
      setError(result.error || "An error occurred");
    }
    setIsLoading(false);
  }

  async function handleRemove() {
    if (!confirm("Are you sure you want to remove this friend?")) {
      return;
    }
    setIsLoading(true);
    setError(null);
    const result = await removeFriend(friendshipId);
    if ("error" in result) {
      setError(result.error || "An error occurred");
    }
    setIsLoading(false);
  }

  async function handleCancel() {
    setIsLoading(true);
    setError(null);
    const result = await cancelFriendRequest(friendshipId);
    if ("error" in result) {
      setError(result.error || "An error occurred");
    }
    setIsLoading(false);
  }

  if (error) {
    return <span className="text-red-400 text-sm">{error}</span>;
  }

  if (type === "received") {
    return (
      <div className="flex gap-2">
        <button
          onClick={handleAccept}
          disabled={isLoading}
          className="bg-green-600 hover:bg-green-500 disabled:bg-green-800 text-white px-4 py-1.5 rounded-lg text-sm transition-colors"
        >
          Accept
        </button>
        <button
          onClick={handleDecline}
          disabled={isLoading}
          className="bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 text-white px-4 py-1.5 rounded-lg text-sm transition-colors"
        >
          Decline
        </button>
      </div>
    );
  }

  if (type === "sent") {
    return (
      <button
        onClick={handleCancel}
        disabled={isLoading}
        className="bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 text-white px-4 py-1.5 rounded-lg text-sm transition-colors"
      >
        Cancel
      </button>
    );
  }

  return (
    <button
      onClick={handleRemove}
      disabled={isLoading}
      className="text-zinc-500 hover:text-red-400 text-sm transition-colors"
    >
      Remove
    </button>
  );
}
