import Anthropic from "@anthropic-ai/sdk";
import type { ExtractedPlayLog, PlayLogExtractionContext } from "@/types/ai-events";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are an MTG (Magic: The Gathering) game analyst. You read transcripts of game conversations and extract structured turn-by-turn play logs for every player.

YOUR TASK:
Parse the transcript into per-player, per-turn structured data. Each turn should have an entry for the active player, PLUS separate entries for any other players who acted during that turn.

OUT-OF-TURN ACTIONS:
When a player acts during another player's turn (casting instants, using flash creatures, activating abilities, responding to spells), create a SEPARATE entry with:
- playerName: the player who acted
- activePlayerName: the player whose turn it actually is
- Only include what that out-of-turn player did (not the active player's actions)

Common out-of-turn scenarios in MTG:
- Casting counterspells or removal in response
- Flash creatures
- Activated abilities (especially in response to threats)
- Blocking decisions are part of combat but notable blocks can be mentioned in summary

WHAT TO TRACK PER ENTRY:
- turnNumber: Which game turn (1, 2, 3, ...)
- playerName: Who acted
- activePlayerName: Only set if acting on someone else's turn (omit for the active player)
- lifeTotal: Player's life total at end of this turn action (if mentioned)
- lifeDelta: Life change (negative = damage taken, positive = life gained)
- landsPlayed: Number of lands played (0-1 normally, more with extra land effects)
- spellsCast: Number of spells cast
- creaturesAttacked: Number of creatures that attacked
- commanderDamageDealt: Commander damage dealt (commander formats only)
- manaSpent: Approximate total mana spent
- cardsPlayed: Array of exact MTG card names played/cast
- attackedPlayerNames: Array of player names attacked
- eliminatedPlayerNames: Array of player names eliminated
- summary: 1-2 sentence summary of what happened

SPEAKER IDENTIFICATION:
- The transcript may not identify speakers. Infer from context.
- Players say "I'll cast...", refer to others by name, or context makes it clear.
- Use EXACT player names from the provided list.

CONFIDENCE LEVELS:
- high: Clear actions with identifiable players and cards
- medium: Actions mentioned but some details fuzzy
- low: Inferred from context, not explicitly stated

IMPORTANT:
- Be conservative with numeric estimates — only include numbers you're confident about.
- Card names should be exact MTG card names when possible.
- Keep summaries concise (1-2 sentences).
- Include mundane turns too (e.g., "Played a land and passed") — we want complete logs.
- If turn order or active player is unclear, use your best guess with lower confidence.`;

export function buildPlayLogUserMessage(
  transcript: string,
  context: PlayLogExtractionContext
): string {
  const playerList = context.players
    .map((p) => {
      let line = `- ${p.name}`;
      if (p.commander1) line += ` (${p.commander1}${p.commander2 ? ` / ${p.commander2}` : ""})`;
      return line;
    })
    .join("\n");

  return `GAME CONTEXT:
- Format: ${context.format}
- Total turns played: ${context.totalTurns}
- Players:
${playerList}

Parse the following game transcript into structured turn-by-turn play logs. Create entries for EVERY turn for the active player, and additional entries for any players who acted out of turn (instants, flash, abilities, responses).

FULL GAME TRANSCRIPT:
${transcript}`;
}

export const EXTRACT_PLAY_LOGS_TOOL: Anthropic.Messages.Tool = {
  name: "extract_play_logs",
  description: "Extract structured turn-by-turn play logs from an MTG game transcript",
  input_schema: {
    type: "object" as const,
    properties: {
      playLogs: {
        type: "array",
        items: {
          type: "object",
          properties: {
            playerName: { type: "string", description: "Exact player name from the game context" },
            turnNumber: { type: "number", description: "Turn number (1, 2, 3, ...)" },
            activePlayerName: {
              type: "string",
              description: "Only set when this player acted on someone else's turn. The name of the player whose turn it actually is.",
            },
            lifeTotal: { type: "number", description: "Player's life total at end of this action" },
            lifeDelta: { type: "number", description: "Life change this turn (negative = damage)" },
            landsPlayed: { type: "number", description: "Number of lands played" },
            spellsCast: { type: "number", description: "Number of spells cast" },
            creaturesAttacked: { type: "number", description: "Number of creatures that attacked" },
            commanderDamageDealt: { type: "number", description: "Commander damage dealt" },
            manaSpent: { type: "number", description: "Approximate total mana spent" },
            cardsPlayed: {
              type: "array",
              items: { type: "string" },
              description: "Exact MTG card names played/cast",
            },
            attackedPlayerNames: {
              type: "array",
              items: { type: "string" },
              description: "Player names attacked this turn",
            },
            eliminatedPlayerNames: {
              type: "array",
              items: { type: "string" },
              description: "Player names eliminated this turn",
            },
            summary: { type: "string", description: "1-2 sentence summary of what happened" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["playerName", "turnNumber", "confidence"],
        },
      },
    },
    required: ["playLogs"],
  },
};

export function validatePlayLog(
  raw: Record<string, unknown>,
  playerNames: string[]
): ExtractedPlayLog | null {
  const playerName = raw.playerName as string;
  const turnNumber = raw.turnNumber as number;
  const confidence = raw.confidence as "high" | "medium" | "low";

  if (!playerName || typeof turnNumber !== "number" || turnNumber < 1) return null;
  if (!["high", "medium", "low"].includes(confidence)) return null;

  // Validate playerName exists in game
  const nameMatch = playerNames.some(
    (n) => n.toLowerCase() === playerName.toLowerCase()
  );
  if (!nameMatch) return null;

  // Validate activePlayerName if present
  const activePlayerName = raw.activePlayerName as string | undefined;
  if (activePlayerName) {
    const activeMatch = playerNames.some(
      (n) => n.toLowerCase() === activePlayerName.toLowerCase()
    );
    if (!activeMatch) return null;
    // activePlayerName shouldn't be the same as playerName
    if (activePlayerName.toLowerCase() === playerName.toLowerCase()) return null;
  }

  const result: ExtractedPlayLog = {
    playerName,
    turnNumber,
    confidence,
  };

  if (activePlayerName) result.activePlayerName = activePlayerName;
  if (typeof raw.lifeTotal === "number") result.lifeTotal = raw.lifeTotal;
  if (typeof raw.lifeDelta === "number") result.lifeDelta = raw.lifeDelta;
  if (typeof raw.landsPlayed === "number") result.landsPlayed = raw.landsPlayed;
  if (typeof raw.spellsCast === "number") result.spellsCast = raw.spellsCast;
  if (typeof raw.creaturesAttacked === "number") result.creaturesAttacked = raw.creaturesAttacked;
  if (typeof raw.commanderDamageDealt === "number") result.commanderDamageDealt = raw.commanderDamageDealt;
  if (typeof raw.manaSpent === "number") result.manaSpent = raw.manaSpent;
  if (Array.isArray(raw.cardsPlayed)) result.cardsPlayed = raw.cardsPlayed.filter((c): c is string => typeof c === "string");
  if (Array.isArray(raw.attackedPlayerNames)) result.attackedPlayerNames = raw.attackedPlayerNames.filter((n): n is string => typeof n === "string");
  if (Array.isArray(raw.eliminatedPlayerNames)) result.eliminatedPlayerNames = raw.eliminatedPlayerNames.filter((n): n is string => typeof n === "string");
  if (typeof raw.summary === "string" && raw.summary.trim()) result.summary = raw.summary;

  return result;
}

export async function extractPlayLogs(
  transcript: string,
  context: PlayLogExtractionContext
): Promise<ExtractedPlayLog[]> {
  if (!transcript.trim()) return [];

  const playerNames = context.players.map((p) => p.name);

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 8192,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildPlayLogUserMessage(transcript, context),
      },
    ],
    tools: [EXTRACT_PLAY_LOGS_TOOL],
    tool_choice: { type: "tool", name: "extract_play_logs" },
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.Messages.ToolUseBlock => block.type === "tool_use"
  );

  if (!toolUse) return [];

  const input = toolUse.input as { playLogs?: Record<string, unknown>[] };
  if (!input.playLogs || !Array.isArray(input.playLogs)) return [];

  return input.playLogs
    .map((raw) => validatePlayLog(raw, playerNames))
    .filter((e): e is ExtractedPlayLog => e !== null);
}
