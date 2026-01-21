"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { MtgFormat } from "@/types/mtg";

export type PlayerSetup = {
  id: string;
  type: "user" | "guest";
  userId?: string;
  guestName?: string;
  deckId?: string;
  commanderUsed1?: string;
  commanderUsed2?: string;
  bracketUsed?: number;
};

export type CreateGameInput = {
  format: MtgFormat;
  players: PlayerSetup[];
};

export async function createGame(
  input: CreateGameInput
): Promise<{ success: true; gameId: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Validate input
  if (!input.format) {
    return { error: "Format is required" };
  }

  if (!input.players || input.players.length < 2) {
    return { error: "At least 2 players are required" };
  }

  // Validate each player has identification
  for (const player of input.players) {
    if (player.type === "user" && !player.userId) {
      return { error: "Registered players must have a user ID" };
    }
    if (player.type === "guest" && !player.guestName?.trim()) {
      return { error: "Guest players must have a name" };
    }
  }

  try {
    // Create the game with players in a transaction
    const game = await db.game.create({
      data: {
        createdById: user.id,
        format: input.format,
        totalTurns: 0,
        players: {
          create: input.players.map((player) => ({
            userId: player.type === "user" ? player.userId : null,
            guestName: player.type === "guest" ? player.guestName : null,
            deckId: player.deckId || null,
            commanderUsed1: player.commanderUsed1 || null,
            commanderUsed2: player.commanderUsed2 || null,
            bracketUsed: player.bracketUsed || null,
          })),
        },
      },
    });

    return { success: true, gameId: game.id };
  } catch (error) {
    console.error("Failed to create game:", error);
    return { error: "Failed to create game. Please try again." };
  }
}

export async function getUserDecks(format?: string) {
  const user = await getCurrentUser();
  if (!user) {
    return [];
  }

  const decks = await db.deck.findMany({
    where: {
      userId: user.id,
      isActive: true,
      ...(format && { format }),
    },
    orderBy: { name: "asc" },
  });

  return decks;
}
