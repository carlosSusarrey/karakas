import { NextRequest, NextResponse } from "next/server";
import {
  autocompleteCards,
  getCardByName,
  getCardImageUrlFromCard,
  searchCommanders,
  type CardSuggestion,
} from "@/lib/scryfall";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const commanderOnly = searchParams.get("commander") === "true";

  if (!query || query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    if (commanderOnly) {
      const cards = await searchCommanders(query);
      const suggestions: CardSuggestion[] = cards.slice(0, 10).map((card) => ({
        name: card.name,
        imageUrl: getCardImageUrlFromCard(card),
      }));
      return NextResponse.json({ suggestions });
    }

    const cardNames = await autocompleteCards(query);
    const limitedNames = cardNames.slice(0, 10);
    const cardPromises = limitedNames.map((name) => getCardByName(name));
    const cards = await Promise.all(cardPromises);

    const suggestions: CardSuggestion[] = cards.map((card, i) => ({
      name: card?.name ?? limitedNames[i],
      imageUrl: card ? getCardImageUrlFromCard(card) : null,
    }));

    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch card suggestions" },
      { status: 500 }
    );
  }
}
