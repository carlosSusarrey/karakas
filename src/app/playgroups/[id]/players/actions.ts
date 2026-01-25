"use server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function createPlaygroupPlayer(
  playgroupId: string,
  name: string,
  email?: string
) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  // Check if user is a member
  const membership = await db.playgroupMember.findUnique({
    where: {
      playgroupId_userId: {
        playgroupId,
        userId: user.id,
      },
    },
  });

  if (!membership) {
    return { error: "You are not a member of this playgroup" };
  }

  if (!name || name.trim().length === 0) {
    return { error: "Player name is required" };
  }

  try {
    const player = await db.playgroupPlayer.create({
      data: {
        playgroupId,
        name: name.trim(),
        email: email?.trim() || null,
      },
    });

    return { playerId: player.id };
  } catch {
    return { error: "Failed to create player" };
  }
}

export async function updatePlaygroupPlayer(
  playerId: string,
  name: string,
  email?: string
) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const player = await db.playgroupPlayer.findUnique({
    where: { id: playerId },
    select: { playgroupId: true },
  });

  if (!player) {
    return { error: "Player not found" };
  }

  // Check if user is a member
  const membership = await db.playgroupMember.findUnique({
    where: {
      playgroupId_userId: {
        playgroupId: player.playgroupId,
        userId: user.id,
      },
    },
  });

  if (!membership) {
    return { error: "You are not a member of this playgroup" };
  }

  if (!name || name.trim().length === 0) {
    return { error: "Player name is required" };
  }

  try {
    await db.playgroupPlayer.update({
      where: { id: playerId },
      data: {
        name: name.trim(),
        email: email?.trim() || null,
      },
    });

    return { success: true };
  } catch {
    return { error: "Failed to update player" };
  }
}

export async function deletePlaygroupPlayer(playerId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const player = await db.playgroupPlayer.findUnique({
    where: { id: playerId },
    include: {
      _count: { select: { gamePlayers: true } },
    },
  });

  if (!player) {
    return { error: "Player not found" };
  }

  // Check if user is admin or owner
  const membership = await db.playgroupMember.findUnique({
    where: {
      playgroupId_userId: {
        playgroupId: player.playgroupId,
        userId: user.id,
      },
    },
  });

  if (!membership || membership.role === "member") {
    return { error: "Only admins can delete players" };
  }

  // Check if player has game history
  if (player._count.gamePlayers > 0) {
    return { error: "Cannot delete player with game history. Consider linking them to an account instead." };
  }

  try {
    await db.playgroupPlayer.delete({
      where: { id: playerId },
    });

    return { success: true };
  } catch {
    return { error: "Failed to delete player" };
  }
}

export async function getPlaygroupPlayerStats(playerId: string) {
  const player = await db.playgroupPlayer.findUnique({
    where: { id: playerId },
    include: {
      gamePlayers: {
        include: {
          game: true,
        },
      },
    },
  });

  if (!player) {
    return null;
  }

  const gamesPlayed = player.gamePlayers.length;
  const wins = player.gamePlayers.filter((gp) => gp.isWinner).length;
  const firstOuts = player.gamePlayers.filter((gp) => gp.isFirstOut).length;

  return {
    gamesPlayed,
    wins,
    winRate: gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0,
    firstOuts,
    firstOutRate: gamesPlayed > 0 ? Math.round((firstOuts / gamesPlayed) * 100) : 0,
  };
}
