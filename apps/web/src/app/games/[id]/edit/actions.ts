"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

type PlayerUpdate = {
  id: string;
  placement: number | null;
  isWinner: boolean;
  isFirstOut: boolean;
  eliminatedTurn: number | null;
  commanderUsed1?: string | null;
  commanderUsed2?: string | null;
  bracketUsed?: number | null;
};

type UpdateGameInput = {
  totalTurns: number;
  notes: string | null;
  playedAt: Date;
  players: PlayerUpdate[];
};

export async function updateGame(
  gameId: string,
  input: UpdateGameInput
): Promise<{ success: true } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  // Get the game and verify ownership
  const game = await db.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });

  if (!game) {
    return { error: "Game not found" };
  }

  if (game.createdById !== user.id) {
    return { error: "You can only edit games you created" };
  }

  // Validate input
  if (input.totalTurns < 0) {
    return { error: "Total turns must be 0 or greater" };
  }

  // Validate exactly one winner (unless it's a draw - all placement 1)
  const winners = input.players.filter((p) => p.isWinner);
  const allFirstPlace = input.players.every((p) => p.placement === 1);

  if (winners.length > 1) {
    return { error: "Only one player can be marked as winner" };
  }

  if (winners.length === 0 && !allFirstPlace) {
    return { error: "A winner must be selected (or mark as draw with all placement 1)" };
  }

  // Validate only one first out
  const firstOuts = input.players.filter((p) => p.isFirstOut);
  if (firstOuts.length > 1) {
    return { error: "Only one player can be marked as first out" };
  }

  try {
    // Update game details
    await db.game.update({
      where: { id: gameId },
      data: {
        totalTurns: input.totalTurns,
        notes: input.notes,
        playedAt: input.playedAt,
      },
    });

    // Update player results
    for (const player of input.players) {
      await db.gamePlayer.update({
        where: { id: player.id },
        data: {
          placement: player.placement,
          isWinner: player.isWinner,
          isFirstOut: player.isFirstOut,
          eliminatedTurn: player.eliminatedTurn,
          ...(player.commanderUsed1 !== undefined && {
            commanderUsed1: player.commanderUsed1,
          }),
          ...(player.commanderUsed2 !== undefined && {
            commanderUsed2: player.commanderUsed2,
          }),
          ...(player.bracketUsed !== undefined && {
            bracketUsed: player.bracketUsed,
          }),
        },
      });
    }

    revalidatePath(`/games/${gameId}`);
    revalidatePath(`/games/${gameId}/edit`);
    revalidatePath("/games");
    if (game.playgroupId) {
      revalidatePath(`/playgroups/${game.playgroupId}`);
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to update game:", error);
    return { error: "Failed to update game" };
  }
}

export async function deleteGame(
  gameId: string
): Promise<{ success: true } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  // Get the game and verify ownership
  const game = await db.game.findUnique({
    where: { id: gameId },
  });

  if (!game) {
    return { error: "Game not found" };
  }

  // Allow deletion by creator or any playgroup member
  if (game.createdById !== user.id) {
    if (game.playgroupId) {
      const membership = await db.playgroupMember.findUnique({
        where: {
          playgroupId_userId: {
            playgroupId: game.playgroupId,
            userId: user.id,
          },
        },
      });
      if (!membership) {
        return { error: "Only playgroup members can delete this game" };
      }
    } else {
      return { error: "You can only delete games you created" };
    }
  }

  const playgroupId = game.playgroupId;

  try {
    // Delete the game (cascade will delete players and power plays)
    await db.game.delete({
      where: { id: gameId },
    });

    revalidatePath("/games");
    if (playgroupId) {
      revalidatePath(`/playgroups/${playgroupId}`);
    }

    return { success: true };
  } catch (error) {
    console.error("Failed to delete game:", error);
    return { error: "Failed to delete game" };
  }
}
