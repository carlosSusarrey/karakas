"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePlaygroupPlayer, deletePlaygroupPlayer, sendClaimInvitation } from "./actions";

type Player = {
  id: string;
  name: string;
  email: string | null;
  linkedUserId: string | null;
};

type Props = {
  player: Player;
  canDelete: boolean;
  canEdit: boolean;
  canInvite?: boolean;
};

export function PlayerActions({ player, canDelete, canEdit, canInvite = false }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "edit" | "delete" | "invite">("view");
  const [name, setName] = useState(player.name);
  const [email, setEmail] = useState(player.email || "");
  const [inviteEmail, setInviteEmail] = useState(player.email || "");

  async function handleUpdate() {
    setError(null);
    startTransition(async () => {
      const result = await updatePlaygroupPlayer(
        player.id,
        name.trim(),
        email.trim() || undefined
      );

      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setMode("view");
        router.refresh();
      }
    });
  }

  async function handleDelete() {
    setError(null);
    startTransition(async () => {
      const result = await deletePlaygroupPlayer(player.id);

      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  if (mode === "edit") {
    return (
      <div className="flex flex-col gap-2">
        {error && (
          <span className="text-red-400 text-xs">{error}</span>
        )}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 w-28 focus:outline-none focus:border-amber-500"
          />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 w-36 focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={handleUpdate}
            disabled={isPending}
            className="text-amber-400 hover:text-amber-300 text-xs font-medium disabled:opacity-50"
          >
            {isPending ? "..." : "Save"}
          </button>
          <button
            onClick={() => {
              setMode("view");
              setName(player.name);
              setEmail(player.email || "");
              setError(null);
            }}
            className="text-zinc-400 hover:text-zinc-300 text-xs"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (mode === "delete") {
    return (
      <div className="flex items-center gap-2">
        {error && (
          <span className="text-red-400 text-xs">{error}</span>
        )}
        <span className="text-zinc-400 text-xs">Delete {player.name}?</span>
        <button
          onClick={handleDelete}
          disabled={isPending}
          className="text-red-400 hover:text-red-300 text-xs font-medium disabled:opacity-50"
        >
          {isPending ? "..." : "Yes"}
        </button>
        <button
          onClick={() => {
            setMode("view");
            setError(null);
          }}
          className="text-zinc-400 hover:text-zinc-300 text-xs"
        >
          No
        </button>
      </div>
    );
  }

  if (mode === "invite") {
    async function handleSendInvite() {
      if (!inviteEmail.trim()) {
        setError("Email is required");
        return;
      }
      setError(null);
      setSuccessMessage(null);
      startTransition(async () => {
        const result = await sendClaimInvitation(player.id, inviteEmail.trim());

        if ("error" in result && result.error) {
          setError(result.error);
        } else if ("success" in result && result.claimUrl) {
          setSuccessMessage(`Claim link: ${result.claimUrl}`);
          setTimeout(() => {
            setMode("view");
            setSuccessMessage(null);
            router.refresh();
          }, 5000);
        }
      });
    }

    return (
      <div className="flex flex-col gap-2">
        {error && (
          <span className="text-red-400 text-xs">{error}</span>
        )}
        {successMessage && (
          <span className="text-green-400 text-xs break-all">{successMessage}</span>
        )}
        {!successMessage && (
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="Email address"
              className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-zinc-100 w-44 focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={handleSendInvite}
              disabled={isPending}
              className="text-amber-400 hover:text-amber-300 text-xs font-medium disabled:opacity-50"
            >
              {isPending ? "..." : "Send"}
            </button>
            <button
              onClick={() => {
                setMode("view");
                setError(null);
              }}
              className="text-zinc-400 hover:text-zinc-300 text-xs"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    );
  }

  // View mode - show buttons if user is not linked
  if (player.linkedUserId) {
    return null; // Can't edit linked players
  }

  return (
    <div className="flex items-center gap-2">
      {canInvite && (
        <button
          onClick={() => setMode("invite")}
          className="text-green-400 hover:text-green-300 text-xs"
        >
          Send Invite
        </button>
      )}
      {canEdit && (
        <button
          onClick={() => setMode("edit")}
          className="text-zinc-400 hover:text-zinc-300 text-xs"
        >
          Edit
        </button>
      )}
      {canDelete && (
        <button
          onClick={() => setMode("delete")}
          className="text-red-400 hover:text-red-300 text-xs"
        >
          Delete
        </button>
      )}
    </div>
  );
}
