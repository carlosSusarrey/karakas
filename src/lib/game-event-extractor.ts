import Anthropic from "@anthropic-ai/sdk";
import { POWER_PLAY_TYPES, POWER_PLAY_LABELS, type PowerPlayType } from "@/types/mtg";
import type { SuggestedEvent, ExtractionContext } from "@/types/ai-events";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an MTG (Magic: The Gathering) game analyst. You listen to transcripts of game audio and extract notable game events.

WHAT TO EXTRACT:

1. Power Plays — Notable game actions:
${POWER_PLAY_TYPES.map((t) => `   - ${t}: ${POWER_PLAY_LABELS[t]}`).join("\n")}

2. Eliminations — When a player is knocked out or loses.

3. Turn Advances — When players explicitly mention the turn number changing (e.g., "going to turn 5", "my turn 6").

SPEAKER IDENTIFICATION:
- The transcript does not identify speakers. Infer who is speaking/acting from context.
- Players often say "I'll cast...", refer to others by name, or context makes it clear whose turn it is.
- Map speakers to the player list provided. Use EXACT player names from the list.
- If you cannot determine who made a play, use your best guess with low confidence.

CONFIDENCE LEVELS:
- high: Clear mention of a card name + action, speaker is identifiable
- medium: Action is mentioned but details are fuzzy (card name unclear, speaker somewhat ambiguous)
- low: Inferred from context, not explicitly stated

IMPORTANT:
- Only extract events you are reasonably confident about.
- Card names should be exact MTG card names when possible.
- Keep descriptions concise (1 sentence).
- Do NOT extract mundane actions (drawing for turn, playing a basic land) unless notably impactful.
- Do NOT re-extract events from the previous transcript — only extract from the NEW transcript.`;

function buildUserMessage(
  transcript: string,
  context: ExtractionContext,
  isSummary: boolean
): string {
  const playerList = context.players
    .map((p) => {
      let line = `- ${p.name}`;
      if (p.commander1) line += ` (${p.commander1}${p.commander2 ? ` / ${p.commander2}` : ""})`;
      return line;
    })
    .join("\n");

  let message = `GAME CONTEXT:
- Format: ${context.format}
- Current turn: ${context.currentTurn}
- Players:
${playerList}`;

  if (isSummary) {
    message += `\n\nSUMMARY MODE: Review the COMPLETE game transcript below. Look for events that may have been missed in earlier analysis. Focus on the overall game narrative, key turning points, eliminations, and the final plays leading to the game ending.\n\nFULL TRANSCRIPT:\n${transcript}`;
  } else {
    if (context.previousTranscript) {
      message += `\n\nPREVIOUS TRANSCRIPT (for context only — do not extract from this):\n${context.previousTranscript}`;
    }
    message += `\n\nNEW TRANSCRIPT TO ANALYZE:\n${transcript}`;
  }

  return message;
}

const EXTRACT_EVENTS_TOOL: Anthropic.Messages.Tool = {
  name: "extract_events",
  description: "Extract notable MTG game events from the transcript",
  input_schema: {
    type: "object" as const,
    properties: {
      events: {
        type: "array",
        items: {
          type: "object",
          properties: {
            type: {
              type: "string",
              enum: ["power_play", "elimination", "turn_advance"],
            },
            playerName: { type: "string", description: "Exact player name from the game context" },
            powerPlayType: {
              type: "string",
              enum: [...POWER_PLAY_TYPES],
              description: "Only for power_play events",
            },
            description: { type: "string", description: "Concise description of what happened" },
            cardName: { type: "string", description: "Exact MTG card name if identifiable" },
            turn: { type: "number", description: "Turn number when this happened" },
            newTurn: { type: "number", description: "Only for turn_advance events" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["type", "confidence"],
        },
      },
    },
    required: ["events"],
  },
};

function validateEvent(raw: Record<string, unknown>): SuggestedEvent | null {
  const type = raw.type as string;
  const confidence = raw.confidence as "high" | "medium" | "low";

  if (!["high", "medium", "low"].includes(confidence)) return null;

  if (type === "power_play") {
    const powerPlayType = raw.powerPlayType as string;
    if (!POWER_PLAY_TYPES.includes(powerPlayType as PowerPlayType)) return null;
    if (!raw.playerName || !raw.description) return null;
    return {
      type: "power_play",
      playerName: raw.playerName as string,
      powerPlayType: powerPlayType as PowerPlayType,
      description: raw.description as string,
      cardName: (raw.cardName as string) || undefined,
      turn: (raw.turn as number) || undefined,
      confidence,
    };
  }

  if (type === "elimination") {
    if (!raw.playerName) return null;
    return {
      type: "elimination",
      playerName: raw.playerName as string,
      turn: (raw.turn as number) || undefined,
      confidence,
    };
  }

  if (type === "turn_advance") {
    if (!raw.newTurn || typeof raw.newTurn !== "number") return null;
    return {
      type: "turn_advance",
      newTurn: raw.newTurn as number,
      confidence,
    };
  }

  return null;
}

export async function extractGameEvents(
  transcript: string,
  context: ExtractionContext,
  isSummary = false
): Promise<SuggestedEvent[]> {
  if (!transcript.trim()) return [];

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserMessage(transcript, context, isSummary),
      },
    ],
    tools: [EXTRACT_EVENTS_TOOL],
    tool_choice: { type: "tool", name: "extract_events" },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use"
  );

  if (!toolUse) return [];

  const input = toolUse.input as { events?: Record<string, unknown>[] };
  if (!input.events || !Array.isArray(input.events)) return [];

  return input.events
    .map((raw) => validateEvent(raw))
    .filter((e): e is SuggestedEvent => e !== null);
}
