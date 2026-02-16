"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MTG_FORMATS, type MtgFormat } from "@/types/mtg";

export async function deleteDeck(
  deckId: string
): Promise<{ success: true } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const deck = await db.deck.findUnique({
    where: { id: deckId },
  });

  if (!deck || deck.userId !== user.id) {
    return { error: "Deck not found" };
  }

  try {
    await db.deck.delete({
      where: { id: deckId },
    });

    revalidatePath("/decks");
    return { success: true };
  } catch {
    return { error: "Failed to delete deck" };
  }
}

export async function toggleArchiveDeck(
  deckId: string
): Promise<{ success: true } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const deck = await db.deck.findUnique({
    where: { id: deckId },
  });

  if (!deck || deck.userId !== user.id) {
    return { error: "Deck not found" };
  }

  try {
    await db.deck.update({
      where: { id: deckId },
      data: { isActive: !deck.isActive },
    });

    revalidatePath("/decks");
    revalidatePath(`/decks/${deckId}`);
    return { success: true };
  } catch {
    return { error: "Failed to update deck" };
  }
}

export async function updateDeck(
  deckId: string,
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const deck = await db.deck.findUnique({
    where: { id: deckId },
  });

  if (!deck || deck.userId !== user.id) {
    return { error: "Deck not found" };
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
    await db.deck.update({
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

    revalidatePath("/decks");
    revalidatePath(`/decks/${deckId}`);
    return { success: true };
  } catch {
    return { error: "Failed to update deck" };
  }
}
