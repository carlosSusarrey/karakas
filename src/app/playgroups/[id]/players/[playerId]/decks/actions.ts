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
  if (bracket !== null && (bracket < 1 || bracket > 4)) {
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
  if (bracket !== null && (bracket < 1 || bracket > 4)) {
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
