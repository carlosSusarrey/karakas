"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MTG_FORMATS, type MtgFormat } from "@/types/mtg";

export async function createPlaygroupPlayerDeck(
  playerId: string,
  formData: FormData
): Promise<{ success: true; deckId: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  // Get the player and verify user is a member of the playgroup
  const player = await db.playgroupPlayer.findUnique({
    where: { id: playerId },
    select: { id: true, playgroupId: true },
  });

  if (!player) {
    return { error: "Player not found" };
  }

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

  const name = formData.get("name") as string;
  const format = formData.get("format") as string;
  const commander1 = formData.get("commander1") as string | null;
  const commander2 = formData.get("commander2") as string | null;
  const bracketStr = formData.get("bracket") as string | null;
  const decklistUrl = formData.get("decklistUrl") as string | null;

  // Validation
  if (!name || name.trim().length === 0) {
    return { error: "Deck name is required" };
  }

  if (!format || !MTG_FORMATS.includes(format as MtgFormat)) {
    return { error: "Invalid format selected" };
  }

  const bracket = bracketStr ? parseInt(bracketStr, 10) : null;
  if (bracket !== null && (bracket < 1 || bracket > 5)) {
    return { error: "Invalid bracket value" };
  }

  try {
    const deck = await db.playgroupPlayerDeck.create({
      data: {
        playgroupPlayerId: playerId,
        name: name.trim(),
        format,
        commander1: commander1?.trim() || null,
        commander2: commander2?.trim() || null,
        bracket,
        decklistUrl: decklistUrl?.trim() || null,
      },
    });

    revalidatePath(`/playgroups/${player.playgroupId}/players/${playerId}/decks`);
    return { success: true, deckId: deck.id };
  } catch (error) {
    console.error("Failed to create playgroup player deck:", error);
    return { error: "Failed to create deck. Please try again." };
  }
}

export async function updatePlaygroupPlayerDeck(
  deckId: string,
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  // Get the deck and verify user is a member of the playgroup
  const deck = await db.playgroupPlayerDeck.findUnique({
    where: { id: deckId },
    include: {
      playgroupPlayer: {
        select: { playgroupId: true, id: true },
      },
    },
  });

  if (!deck) {
    return { error: "Deck not found" };
  }

  const membership = await db.playgroupMember.findUnique({
    where: {
      playgroupId_userId: {
        playgroupId: deck.playgroupPlayer.playgroupId,
        userId: user.id,
      },
    },
  });

  if (!membership) {
    return { error: "You are not a member of this playgroup" };
  }

  const name = formData.get("name") as string;
  const format = formData.get("format") as string;
  const commander1 = formData.get("commander1") as string | null;
  const commander2 = formData.get("commander2") as string | null;
  const bracketStr = formData.get("bracket") as string | null;
  const decklistUrl = formData.get("decklistUrl") as string | null;

  // Validation
  if (!name || name.trim().length === 0) {
    return { error: "Deck name is required" };
  }

  if (!format || !MTG_FORMATS.includes(format as MtgFormat)) {
    return { error: "Invalid format selected" };
  }

  const bracket = bracketStr ? parseInt(bracketStr, 10) : null;
  if (bracket !== null && (bracket < 1 || bracket > 5)) {
    return { error: "Invalid bracket value" };
  }

  try {
    await db.playgroupPlayerDeck.update({
      where: { id: deckId },
      data: {
        name: name.trim(),
        format,
        commander1: commander1?.trim() || null,
        commander2: commander2?.trim() || null,
        bracket,
        decklistUrl: decklistUrl?.trim() || null,
      },
    });

    revalidatePath(
      `/playgroups/${deck.playgroupPlayer.playgroupId}/players/${deck.playgroupPlayer.id}/decks`
    );
    return { success: true };
  } catch {
    return { error: "Failed to update deck. Please try again." };
  }
}

export async function deletePlaygroupPlayerDeck(
  deckId: string
): Promise<{ success: true } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  // Get the deck and verify user is admin/owner
  const deck = await db.playgroupPlayerDeck.findUnique({
    where: { id: deckId },
    include: {
      playgroupPlayer: {
        select: { playgroupId: true, id: true },
      },
      _count: { select: { gamePlayers: true } },
    },
  });

  if (!deck) {
    return { error: "Deck not found" };
  }

  const membership = await db.playgroupMember.findUnique({
    where: {
      playgroupId_userId: {
        playgroupId: deck.playgroupPlayer.playgroupId,
        userId: user.id,
      },
    },
  });

  if (!membership || membership.role === "member") {
    return { error: "Only admins can delete decks" };
  }

  // Check if deck has game history
  if (deck._count.gamePlayers > 0) {
    return { error: "Cannot delete deck with game history. Consider archiving it instead." };
  }

  try {
    await db.playgroupPlayerDeck.delete({
      where: { id: deckId },
    });

    revalidatePath(
      `/playgroups/${deck.playgroupPlayer.playgroupId}/players/${deck.playgroupPlayer.id}/decks`
    );
    return { success: true };
  } catch {
    return { error: "Failed to delete deck. Please try again." };
  }
}

export async function toggleArchivePlaygroupPlayerDeck(
  deckId: string
): Promise<{ success: true } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  // Get the deck and verify user is a member of the playgroup
  const deck = await db.playgroupPlayerDeck.findUnique({
    where: { id: deckId },
    include: {
      playgroupPlayer: {
        select: { playgroupId: true, id: true },
      },
    },
  });

  if (!deck) {
    return { error: "Deck not found" };
  }

  const membership = await db.playgroupMember.findUnique({
    where: {
      playgroupId_userId: {
        playgroupId: deck.playgroupPlayer.playgroupId,
        userId: user.id,
      },
    },
  });

  if (!membership) {
    return { error: "You are not a member of this playgroup" };
  }

  try {
    await db.playgroupPlayerDeck.update({
      where: { id: deckId },
      data: { isActive: !deck.isActive },
    });

    revalidatePath(
      `/playgroups/${deck.playgroupPlayer.playgroupId}/players/${deck.playgroupPlayer.id}/decks`
    );
    return { success: true };
  } catch {
    return { error: "Failed to update deck. Please try again." };
  }
}

export async function mergePlaygroupPlayerDecks(
  targetDeckId: string,
  sourceDeckIds: string[]
): Promise<{ success: true; mergedGames: number } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  if (sourceDeckIds.length === 0) {
    return { error: "No source decks selected" };
  }

  if (sourceDeckIds.includes(targetDeckId)) {
    return { error: "Target deck cannot be in source decks" };
  }

  // Get the target deck and verify user is admin/owner
  const targetDeck = await db.playgroupPlayerDeck.findUnique({
    where: { id: targetDeckId },
    include: {
      playgroupPlayer: {
        select: { playgroupId: true, id: true },
      },
    },
  });

  if (!targetDeck) {
    return { error: "Target deck not found" };
  }

  const membership = await db.playgroupMember.findUnique({
    where: {
      playgroupId_userId: {
        playgroupId: targetDeck.playgroupPlayer.playgroupId,
        userId: user.id,
      },
    },
  });

  if (!membership || membership.role === "member") {
    return { error: "Only admins can merge decks" };
  }

  // Verify all source decks exist and belong to the same player
  const sourceDecks = await db.playgroupPlayerDeck.findMany({
    where: {
      id: { in: sourceDeckIds },
      playgroupPlayerId: targetDeck.playgroupPlayerId,
    },
  });

  if (sourceDecks.length !== sourceDeckIds.length) {
    return { error: "One or more source decks not found or belong to different player" };
  }

  try {
    let mergedGames = 0;

    await db.$transaction(async (tx) => {
      // Update all game records from source decks to target deck
      for (const sourceDeck of sourceDecks) {
        const updated = await tx.gamePlayer.updateMany({
          where: { playgroupPlayerDeckId: sourceDeck.id },
          data: { playgroupPlayerDeckId: targetDeckId },
        });
        mergedGames += updated.count;
      }

      // Archive the source decks (soft delete)
      await tx.playgroupPlayerDeck.updateMany({
        where: { id: { in: sourceDeckIds } },
        data: { isActive: false },
      });
    });

    revalidatePath(
      `/playgroups/${targetDeck.playgroupPlayer.playgroupId}/players/${targetDeck.playgroupPlayer.id}/decks`
    );
    return { success: true, mergedGames };
  } catch (error) {
    console.error("Failed to merge decks:", error);
    return { error: "Failed to merge decks. Please try again." };
  }
}

export async function getPlayerDecksForMerge(playerId: string) {
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

  const decks = await db.playgroupPlayerDeck.findMany({
    where: { playgroupPlayerId: playerId, isActive: true },
    include: {
      _count: { select: { gamePlayers: true } },
    },
    orderBy: { name: "asc" },
  });

  return { decks };
}
