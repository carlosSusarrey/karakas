"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  removeMember,
  updateMemberRole,
  leavePlaygroup,
  transferOwnership,
} from "../../actions";

type Props = {
  playgroupId: string;
  userId: string;
  username: string;
  currentRole: string;
  canChangeRole: boolean;
  canRemove: boolean;
  isOwner: boolean;
  showLeaveButton?: boolean;
};

export function MemberActions({
  playgroupId,
  userId,
  username,
  currentRole,
  canChangeRole,
  canRemove,
  isOwner,
  showLeaveButton,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  async function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeMember(playgroupId, userId);
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setShowConfirm(null);
        router.refresh();
      }
    });
  }

  async function handleRoleChange(newRole: string) {
    setError(null);
    startTransition(async () => {
      const result = await updateMemberRole(playgroupId, userId, newRole);
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        router.refresh();
      }
    });
  }

  async function handleLeave() {
    setError(null);
    startTransition(async () => {
      const result = await leavePlaygroup(playgroupId);
      if (result && "error" in result && result.error) {
        setError(result.error);
      }
    });
  }

  async function handleTransferOwnership() {
    setError(null);
    startTransition(async () => {
      const result = await transferOwnership(playgroupId, userId);
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setShowConfirm(null);
        router.refresh();
      }
    });
  }

  if (showLeaveButton) {
    return (
      <div>
        {error && (
          <p className="text-red-400 text-sm mb-2">{error}</p>
        )}
        {showConfirm === "leave" ? (
          <div className="flex items-center gap-2">
            <span className="text-zinc-400 text-sm">Leave this playgroup?</span>
            <button
              onClick={handleLeave}
              disabled={isPending}
              className="text-red-400 hover:text-red-300 text-sm font-medium disabled:opacity-50"
            >
              {isPending ? "Leaving..." : "Yes, leave"}
            </button>
            <button
              onClick={() => setShowConfirm(null)}
              className="text-zinc-400 hover:text-zinc-300 text-sm"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowConfirm("leave")}
            className="text-red-400 hover:text-red-300 text-sm font-medium"
          >
            Leave Playgroup
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span className="text-red-400 text-xs">{error}</span>
      )}

      {/* Role Change Dropdown */}
      {canChangeRole && (
        <select
          value={currentRole}
          onChange={(e) => handleRoleChange(e.target.value)}
          disabled={isPending}
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none focus:border-amber-500"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </select>
      )}

      {/* Transfer Ownership */}
      {isOwner && showConfirm === "transfer" ? (
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 text-xs">Make {username} the owner?</span>
          <button
            onClick={handleTransferOwnership}
            disabled={isPending}
            className="text-amber-400 hover:text-amber-300 text-xs font-medium disabled:opacity-50"
          >
            {isPending ? "..." : "Confirm"}
          </button>
          <button
            onClick={() => setShowConfirm(null)}
            className="text-zinc-400 hover:text-zinc-300 text-xs"
          >
            Cancel
          </button>
        </div>
      ) : isOwner && !showConfirm ? (
        <button
          onClick={() => setShowConfirm("transfer")}
          className="text-amber-400 hover:text-amber-300 text-xs"
          title="Transfer ownership"
        >
          Transfer
        </button>
      ) : null}

      {/* Remove Member */}
      {canRemove && showConfirm === "remove" ? (
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 text-xs">Remove {username}?</span>
          <button
            onClick={handleRemove}
            disabled={isPending}
            className="text-red-400 hover:text-red-300 text-xs font-medium disabled:opacity-50"
          >
            {isPending ? "..." : "Yes"}
          </button>
          <button
            onClick={() => setShowConfirm(null)}
            className="text-zinc-400 hover:text-zinc-300 text-xs"
          >
            No
          </button>
        </div>
      ) : canRemove && !showConfirm ? (
        <button
          onClick={() => setShowConfirm("remove")}
          className="text-red-400 hover:text-red-300 text-xs"
        >
          Remove
        </button>
      ) : null}
    </div>
  );
}
