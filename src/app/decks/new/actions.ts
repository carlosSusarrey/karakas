"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MTG_FORMATS, type MtgFormat } from "@/types/mtg";

export async function createDeck(
  formData: FormData
): Promise<{ success: true; deckId: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
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
    const deck = await db.deck.create({
      data: {
        userId: user.id,
        name: name.trim(),
        format,
        commander1: commander1?.trim() || null,
        commander2: commander2?.trim() || null,
        bracket,
        decklistUrl: decklistUrl?.trim() || null,
      },
    });

    return { success: true, deckId: deck.id };
  } catch {
    return { error: "Failed to create deck. Please try again." };
  }
}
