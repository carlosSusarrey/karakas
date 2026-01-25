import { NextResponse } from "next/server";
import {
  autocompleteCards,
  getCardByName,
  getCardImageUrlFromCard,
  canBeCommander,
  type CardSuggestion,
} from "@/lib/scryfall";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const commanderOnly = searchParams.get("commander") === "true";

  if (!query || query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const cardNames = await autocompleteCards(query);

    // Limit to 10 suggestions
    const limitedNames = cardNames.slice(0, 10);

    // If commander filtering is requested, we need to fetch card details
    // and filter to only legendary creatures/planeswalkers
    if (commanderOnly) {
      const suggestions: CardSuggestion[] = [];

      // Fetch card details in parallel (limited batch)
      const cardPromises = limitedNames.map((name) => getCardByName(name));
      const cards = await Promise.all(cardPromises);

      for (let i = 0; i < cards.length; i++) {
        const card = cards[i];
        if (card && canBeCommander(card)) {
          suggestions.push({
            name: card.name,
            imageUrl: getCardImageUrlFromCard(card),
          });
        }
      }

      return NextResponse.json({ suggestions });
    }

    // For non-commander fields, fetch image URLs for all suggestions
    const suggestions: CardSuggestion[] = [];
    const cardPromises = limitedNames.map((name) => getCardByName(name));
    const cards = await Promise.all(cardPromises);

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      if (card) {
        suggestions.push({
          name: card.name,
          imageUrl: getCardImageUrlFromCard(card),
        });
      } else {
        // Fallback if card details couldn't be fetched
        suggestions.push({
          name: limitedNames[i],
          imageUrl: null,
        });
      }
    }

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Card autocomplete error:", error);
    return NextResponse.json(
      { error: "Failed to fetch card suggestions" },
      { status: 500 }
    );
  }
}
