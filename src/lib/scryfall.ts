// Scryfall API client for card data

export interface ScryfallAutocompleteResponse {
  object: "catalog";
  total_values: number;
  data: string[];
}

export interface ScryfallCard {
  id: string;
  name: string;
  image_uris?: {
    small: string;
    normal: string;
    art_crop: string;
  };
  card_faces?: Array<{
    name: string;
    oracle_text?: string;
    image_uris?: {
      small: string;
      normal: string;
      art_crop: string;
    };
  }>;
  mana_cost?: string;
  type_line: string;
  oracle_text?: string;
  legalities: Record<string, string>;
}

export interface CardSuggestion {
  name: string;
  imageUrl: string | null;
}

const SCRYFALL_API_BASE = "https://api.scryfall.com";
const USER_AGENT = "Karakas/1.0";

// Simple in-memory cache
const autocompleteCache = new Map<string, { data: string[]; timestamp: number }>();
const cardCache = new Map<string, { data: ScryfallCard | null; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function isCacheValid(timestamp: number): boolean {
  return Date.now() - timestamp < CACHE_TTL;
}

export async function autocompleteCards(query: string): Promise<string[]> {
  if (query.length < 2) {
    return [];
  }

  const cacheKey = query.toLowerCase();
  const cached = autocompleteCache.get(cacheKey);
  if (cached && isCacheValid(cached.timestamp)) {
    return cached.data;
  }

  try {
    const response = await fetch(
      `${SCRYFALL_API_BASE}/cards/autocomplete?q=${encodeURIComponent(query)}`,
      {
        headers: {
          "User-Agent": USER_AGENT,
        },
      }
    );

    if (!response.ok) {
      console.error(`Scryfall API error: ${response.status}`);
      return [];
    }

    const data: ScryfallAutocompleteResponse = await response.json();
    autocompleteCache.set(cacheKey, { data: data.data, timestamp: Date.now() });
    return data.data;
  } catch (error) {
    console.error("Scryfall autocomplete error:", error);
    return [];
  }
}

export async function getCardByName(name: string): Promise<ScryfallCard | null> {
  const cacheKey = name.toLowerCase();
  const cached = cardCache.get(cacheKey);
  if (cached && isCacheValid(cached.timestamp)) {
    return cached.data;
  }

  try {
    const response = await fetch(
      `${SCRYFALL_API_BASE}/cards/named?exact=${encodeURIComponent(name)}`,
      {
        headers: {
          "User-Agent": USER_AGENT,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        cardCache.set(cacheKey, { data: null, timestamp: Date.now() });
        return null;
      }
      console.error(`Scryfall API error: ${response.status}`);
      return null;
    }

    const data: ScryfallCard = await response.json();
    cardCache.set(cacheKey, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error("Scryfall getCardByName error:", error);
    return null;
  }
}

export function getCardImageUrlFromCard(card: ScryfallCard, size: "small" | "normal" | "art_crop" = "small"): string | null {
  // Handle double-faced cards
  if (card.card_faces && card.card_faces[0]?.image_uris) {
    return card.card_faces[0].image_uris[size];
  }
  // Handle normal cards
  if (card.image_uris) {
    return card.image_uris[size];
  }
  return null;
}

export function isLegendaryCreature(card: ScryfallCard): boolean {
  const typeLine = card.type_line.toLowerCase();
  return typeLine.includes("legendary") && typeLine.includes("creature");
}

export function canBeCommander(card: ScryfallCard): boolean {
  const typeLine = card.type_line.toLowerCase();
  // Standard legendary creatures
  if (typeLine.includes("legendary") && typeLine.includes("creature")) {
    return true;
  }
  // Any card with "can be your commander" in oracle text (planeswalkers, backgrounds, etc.)
  const oracleText = (
    card.oracle_text ||
    card.card_faces?.[0]?.oracle_text ||
    ""
  ).toLowerCase();
  if (oracleText.includes("can be your commander")) {
    return true;
  }
  return false;
}

export async function getCardImageUrl(cardName: string): Promise<string | null> {
  const card = await getCardByName(cardName);
  if (!card) return null;

  // Handle double-faced cards
  if (card.card_faces && card.card_faces[0]?.image_uris) {
    return card.card_faces[0].image_uris.normal;
  }
  // Handle normal cards
  if (card.image_uris) {
    return card.image_uris.normal;
  }
  return null;
}
