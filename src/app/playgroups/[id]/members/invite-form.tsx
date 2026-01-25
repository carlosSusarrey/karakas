"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { inviteMember } from "../../actions";

type Props = {
  playgroupId: string;
  isOwner: boolean;
};

export function InviteForm({ playgroupId, isOwner }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    startTransition(async () => {
      const result = await inviteMember(playgroupId, email.trim(), role);
      if ("error" in result && result.error) {
        setError(result.error);
      } else if ("pending" in result && result.pending) {
        setSuccess(`Invitation sent to ${email}. They'll be able to join when they sign up.`);
        setEmail("");
      } else {
        setSuccess(`${email} has been added to the playgroup.`);
        setEmail("");
        router.refresh();
      }
    });
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <h2 className="text-lg font-semibold mb-4">Invite Member</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-900/50 border border-red-800 text-red-200 px-3 py-2 rounded-lg text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="bg-green-900/50 border border-green-800 text-green-200 px-3 py-2 rounded-lg text-sm">
            {success}
          </div>
        )}
        <div className="flex gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email address"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
          {isOwner && (
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-zinc-100 focus:outline-none focus:border-amber-500 transition-colors"
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          )}
          <button
            type="submit"
            disabled={isPending}
            className="bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors font-medium"
          >
            {isPending ? "..." : "Invite"}
          </button>
        </div>
        <p className="text-zinc-500 text-sm">
          If the user already has an account, they&apos;ll be added immediately.
          Otherwise, they&apos;ll receive an invitation when they sign up.
        </p>
      </form>
    </div>
  );
}
