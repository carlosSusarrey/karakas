"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { PowerPlayType } from "@/types/mtg";
import type { ExtractedPlayLog } from "@/types/ai-events";

export async function getGameForPlay(gameId: string) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const game = await db.game.findUnique({
    where: { id: gameId },
    include: {
      players: {
        include: {
          deck: true,
        },
      },
      powerPlays: {
        include: {
          gamePlayer: true,
        },
        orderBy: { turn: "asc" },
      },
    },
  });

  if (!game) {
    redirect("/games");
  }

  return game;
}

export async function updateTurnCount(
  gameId: string,
  turns: number
): Promise<{ success: true } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    await db.game.update({
      where: { id: gameId },
      data: { totalTurns: turns },
    });

    revalidatePath(`/games/${gameId}/play`);
    return { success: true };
  } catch (error) {
    console.error("Failed to update turn count:", error);
    return { error: "Failed to update turn count" };
  }
}

export async function eliminatePlayer(
  gameId: string,
  gamePlayerId: string,
  turn: number,
  isFirstOut: boolean
): Promise<{ success: true } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    await db.gamePlayer.update({
      where: { id: gamePlayerId },
      data: {
        eliminatedTurn: turn,
        isFirstOut,
      },
    });

    revalidatePath(`/games/${gameId}/play`);
    return { success: true };
  } catch (error) {
    console.error("Failed to eliminate player:", error);
    return { error: "Failed to eliminate player" };
  }
}

export async function reinstatePlayer(
  gameId: string,
  gamePlayerId: string
): Promise<{ success: true } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    await db.gamePlayer.update({
      where: { id: gamePlayerId },
      data: {
        eliminatedTurn: null,
        isFirstOut: false,
      },
    });

    revalidatePath(`/games/${gameId}/play`);
    return { success: true };
  } catch (error) {
    console.error("Failed to reinstate player:", error);
    return { error: "Failed to reinstate player" };
  }
}

export async function addPowerPlay(
  gameId: string,
  gamePlayerId: string,
  userId: string | null,
  turn: number,
  type: PowerPlayType,
  description: string,
  cardName?: string
): Promise<{ success: true; id: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    const powerPlay = await db.powerPlay.create({
      data: {
        gameId,
        gamePlayerId,
        userId,
        turn,
        type,
        description,
        cardName: cardName || null,
      },
    });

    revalidatePath(`/games/${gameId}/play`);
    return { success: true, id: powerPlay.id };
  } catch (error) {
    console.error("Failed to add power play:", error);
    return { error: "Failed to add power play" };
  }
}

export async function removePowerPlay(
  gameId: string,
  powerPlayId: string
): Promise<{ success: true } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    await db.powerPlay.delete({
      where: { id: powerPlayId },
    });

    revalidatePath(`/games/${gameId}/play`);
    return { success: true };
  } catch (error) {
    console.error("Failed to remove power play:", error);
    return { error: "Failed to remove power play" };
  }
}

export async function endGame(
  gameId: string,
  winnerId: string | null,
  isDraw: boolean
): Promise<{ success: true } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    // Get all players
    const game = await db.game.findUnique({
      where: { id: gameId },
      include: { players: true },
    });

    if (!game) {
      return { error: "Game not found" };
    }

    // Calculate placements
    const eliminatedPlayers = game.players
      .filter((p) => p.eliminatedTurn !== null)
      .sort((a, b) => (b.eliminatedTurn || 0) - (a.eliminatedTurn || 0));

    const activePlayers = game.players.filter((p) => p.eliminatedTurn === null);

    // Update placements
    let placement = 1;

    if (isDraw) {
      // All remaining players share placement 1 (draw)
      for (const player of activePlayers) {
        await db.gamePlayer.update({
          where: { id: player.id },
          data: {
            placement: 1,
            isWinner: false, // Draw, no winner
          },
        });
      }
      placement = activePlayers.length + 1;
    } else if (winnerId) {
      // Winner gets placement 1
      await db.gamePlayer.update({
        where: { id: winnerId },
        data: {
          placement: 1,
          isWinner: true,
        },
      });

      // Other active players get placement 2
      for (const player of activePlayers) {
        if (player.id !== winnerId) {
          await db.gamePlayer.update({
            where: { id: player.id },
            data: {
              placement: 2,
              isWinner: false,
            },
          });
        }
      }
      placement = 3;
    }

    // Eliminated players get descending placements (last eliminated = better placement)
    for (const player of eliminatedPlayers) {
      await db.gamePlayer.update({
        where: { id: player.id },
        data: {
          placement,
          isWinner: false,
        },
      });
      placement++;
    }

    // Update game timestamp
    await db.game.update({
      where: { id: gameId },
      data: {
        playedAt: new Date(),
      },
    });

    revalidatePath(`/games/${gameId}`);
    revalidatePath("/games");
    return { success: true };
  } catch (error) {
    console.error("Failed to end game:", error);
    return { error: "Failed to end game" };
  }
}

export async function savePlayLogs(
  gameId: string,
  playLogs: ExtractedPlayLog[]
): Promise<{ success: true; count: number } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  if (playLogs.length === 0) {
    return { success: true, count: 0 };
  }

  try {
    const game = await db.game.findUnique({
      where: { id: gameId },
      include: {
        players: {
          include: {
            user: { select: { username: true } },
            playgroupPlayer: { select: { name: true } },
          },
        },
      },
    });

    if (!game) {
      return { error: "Game not found" };
    }

    // Build name → gamePlayerId map
    const playerMap = new Map<string, string>();
    for (const p of game.players) {
      const name = p.user?.username ?? p.playgroupPlayer?.name ?? p.guestName ?? "";
      if (name) playerMap.set(name.toLowerCase(), p.id);
    }

    function resolvePlayerId(name: string): string | null {
      return playerMap.get(name.toLowerCase()) ?? null;
    }

    // Build all create operations
    const creates = [];
    for (const log of playLogs) {
      const gamePlayerId = resolvePlayerId(log.playerName);
      if (!gamePlayerId) continue;

      const activeGamePlayerId = log.activePlayerName
        ? resolvePlayerId(log.activePlayerName)
        : null;

      // Map attackedPlayerNames to IDs
      const attackedPlayerIds = log.attackedPlayerNames
        ?.map((n) => resolvePlayerId(n))
        .filter((id): id is string => id !== null)
        .join(",") || null;

      // Map eliminatedPlayerNames to IDs
      const eliminatedPlayerIds = log.eliminatedPlayerNames
        ?.map((n) => resolvePlayerId(n))
        .filter((id): id is string => id !== null)
        .join(",") || null;

      creates.push({
        gameId,
        gamePlayerId,
        turnNumber: log.turnNumber,
        activeGamePlayerId,
        lifeTotal: log.lifeTotal ?? null,
        lifeDelta: log.lifeDelta ?? null,
        landsPlayed: log.landsPlayed ?? null,
        spellsCast: log.spellsCast ?? null,
        creaturesAttacked: log.creaturesAttacked ?? null,
        commanderDamageDealt: log.commanderDamageDealt ?? null,
        manaSpent: log.manaSpent ?? null,
        attackedPlayerIds,
        eliminatedPlayerIds,
        cardsPlayed: log.cardsPlayed?.join(",") || null,
        summary: log.summary ?? null,
      });
    }

    if (creates.length === 0) {
      return { error: "No valid play logs to save" };
    }

    // Delete existing play logs for this game before inserting new ones
    await db.gamePlayLog.deleteMany({ where: { gameId } });

    // Bulk create
    const result = await db.gamePlayLog.createMany({ data: creates });

    revalidatePath(`/games/${gameId}`);
    return { success: true, count: result.count };
  } catch (error) {
    console.error("Failed to save play logs:", error);
    return { error: "Failed to save play logs" };
  }
}
