"use client";

import { useState } from "react";
import { sendFriendRequest } from "./actions";

export function AddFriendForm() {
  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const result = await sendFriendRequest(usernameOrEmail);

      if ("error" in result) {
        setError(result.error || "An error occurred");
      } else if ("success" in result) {
        setSuccess("message" in result ? result.message || "Friend request sent!" : "Friend request sent!");
        setUsernameOrEmail("");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-900/50 border border-green-700 text-green-200 px-4 py-3 rounded-lg text-sm">
          {success}
        </div>
      )}

      <div className="flex gap-3">
        <input
          type="text"
          value={usernameOrEmail}
          onChange={(e) => setUsernameOrEmail(e.target.value)}
          placeholder="Enter username or email"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 focus:outline-none focus:border-amber-500"
        />
        <button
          type="submit"
          disabled={isSubmitting || !usernameOrEmail.trim()}
          className="bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 disabled:cursor-not-allowed text-white px-6 py-2 rounded-lg transition-colors"
        >
          {isSubmitting ? "Sending..." : "Send Request"}
        </button>
      </div>
    </form>
  );
}
