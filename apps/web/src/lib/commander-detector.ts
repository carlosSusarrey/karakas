import Anthropic from "@anthropic-ai/sdk";
import { normalizeCardName, type DetectedCommander } from "@karakas/shared";
import type { Confidence } from "@/types/ai-events";
import {
  autocompleteCards,
  canBeCommander,
  getCardByName,
  getCardFuzzy,
  getCardImageUrlFromCard,
} from "@/lib/scryfall";

const client = new Anthropic();

export const VISION_MODEL = process.env.AI_VISION_MODEL || "claude-opus-5-5";

export type ImageMediaType = "image/jpeg" | "image/png" | "image/webp";

const SYSTEM_PROMPT = `You identify Magic: The Gathering commander cards in a photo of a Commander game.

Each player places their commander (or a pair of partner/background commanders) on the table. Read each card's name from its title bar. Cards may be showcase, borderless, extended-art, foil, sleeved, glared, rotated or non-English printings — always report the official English card name.

Report partner, "Friends forever", "Choose a Background" and similar pairs: if two commanders sit together as one player's pair, set partner_index on one of them to the other's index.

Ignore anything that isn't a commander: tokens, lands, other cards, playmats, deck boxes, dice and life counters.

Never invent a card. If you can't read a name fully, give your best partial reading with low confidence. Positions are the card's center as fractions of the image width (x) and height (y).`;

/** Structured output: the model's reading of the photo */
const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    commanders: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string", description: "Official English card name, or best partial reading" },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          partner_index: {
            type: ["integer", "null"],
            description: "Index of the commander this one is paired with, if any",
          },
          x: { type: "number" },
          y: { type: "number" },
        },
        required: ["name", "confidence", "partner_index", "x", "y"],
        additionalProperties: false,
      },
    },
  },
  required: ["commanders"],
  additionalProperties: false,
} as const;

type RawCommander = {
  name: string;
  confidence: Confidence;
  partner_index: number | null;
  x: number;
  y: number;
};

export class DetectionError extends Error {}

export function buildDetectionPrompt(playerCount: number, knownCommanders: string[]): string {
  const lines = [`There are ${playerCount} players in this game, so expect about ${playerCount} decks — but report what you actually see.`];
  if (knownCommanders.length > 0) {
    lines.push(
      "",
      "Commanders registered in this playgroup (likely, but not guaranteed, to appear). Use one of these exact names only when the card clearly matches it:",
      ...knownCommanders.slice(0, 150).map((n) => `- ${n}`),
    );
  }
  return lines.join("\n");
}

export function parseDetection(text: string): RawCommander[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new DetectionError("Model returned invalid JSON");
  }
  const list = (parsed as { commanders?: unknown })?.commanders;
  if (!Array.isArray(list)) throw new DetectionError("Model response is missing commanders");
  return list
    .filter((c): c is RawCommander => typeof c?.name === "string" && c.name.trim().length > 0)
    .map((c) => ({
      name: c.name.trim(),
      confidence: (["high", "medium", "low"] as const).includes(c.confidence) ? c.confidence : "low",
      partner_index: Number.isInteger(c.partner_index) ? c.partner_index : null,
      x: clamp01(c.x),
      y: clamp01(c.y),
    }));
}

function clamp01(n: unknown): number {
  return typeof n === "number" && Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5;
}

/** Edit distance, for snapping small misreads to registered names */
export function levenshtein(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

export function snapToKnown(name: string, knownCommanders: string[]): string | null {
  const target = normalizeCardName(name);
  let best: { name: string; distance: number } | null = null;
  for (const known of knownCommanders) {
    const distance = levenshtein(target, normalizeCardName(known));
    if (distance <= 2 && (!best || distance < best.distance)) best = { name: known, distance };
  }
  return best?.name ?? null;
}

/** Resolve the model's readings to real card names via known names and Scryfall. */
export async function canonicalize(
  raw: RawCommander[],
  knownCommanders: string[],
): Promise<DetectedCommander[]> {
  const ids = raw.map((_, i) => `c${i + 1}`);

  return Promise.all(
    raw.map(async (c, i): Promise<DetectedCommander> => {
      let confidence = c.confidence;
      const known = snapToKnown(c.name, knownCommanders);
      const card = known ? await getCardByName(known) : await getCardFuzzy(c.name);
      const name = known ?? card?.name ?? null;
      let suggestions: string[] = [];

      if (!name) {
        suggestions = (await autocompleteCards(c.name.slice(0, 20))).slice(0, 3);
        confidence = "low";
      } else if (card && !canBeCommander(card)) {
        confidence = "low";
      } else if (!known && confidence !== "high" && normalizeCardName(name) !== normalizeCardName(c.name)) {
        // Scryfall corrected an uncertain reading: worth a confirmation
        confidence = "low";
      }

      const partnerIndex = c.partner_index;
      return {
        id: ids[i],
        rawName: c.name,
        name,
        partnerOf:
          partnerIndex !== null && partnerIndex !== i && ids[partnerIndex] ? ids[partnerIndex] : undefined,
        confidence,
        position: { x: c.x, y: c.y },
        suggestions,
        imageUrl: card ? getCardImageUrlFromCard(card, "art_crop") ?? undefined : undefined,
      };
    }),
  );
}

/**
 * Identify the commanders in a photo of a game. The image is only sent to
 * the model — it is never logged or stored.
 */
export async function detectCommanders({
  image,
  mediaType,
  playerCount,
  knownCommanders,
}: {
  image: string;
  mediaType: ImageMediaType;
  playerCount: number;
  knownCommanders: string[];
}): Promise<DetectedCommander[]> {
  const response = await client.messages.create({
    model: VISION_MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: OUTPUT_SCHEMA as unknown as Record<string, unknown> },
    },
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
          { type: "text", text: buildDetectionPrompt(playerCount, knownCommanders) },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new DetectionError("The model declined to read this photo");
  if (response.stop_reason === "max_tokens") throw new DetectionError("The model response was cut off");

  const text = response.content.find((b): b is Anthropic.TextBlock => b.type === "text")?.text;
  if (!text) throw new DetectionError("Model returned no result");

  console.info(
    `[commander-detector] model=${response.model} in=${response.usage.input_tokens} out=${response.usage.output_tokens}`,
  );
  return canonicalize(parseDetection(text), knownCommanders);
}
