import { describe, it, expect, vi, beforeEach } from "vitest";
import type { PlayLogExtractionContext } from "@/types/ai-events";

// Mock Anthropic before importing the module
const { mockCreate } = vi.hoisted(() => {
  const mockCreate = vi.fn();
  return { mockCreate };
});
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(() => ({
    messages: { create: mockCreate },
  })),
}));

import {
  extractPlayLogs,
  validatePlayLog,
  buildPlayLogUserMessage,
  EXTRACT_PLAY_LOGS_TOOL,
} from "@/lib/play-log-extractor";

// Reusable test fixtures
const defaultContext: PlayLogExtractionContext = {
  players: [
    { name: "Alice", commander1: "Atraxa, Praetors' Voice" },
    { name: "Bob", commander1: "Korvold, Fae-Cursed King" },
    { name: "Carlos", commander1: "Tymna the Weaver", commander2: "Thrasios, Triton Hero" },
    { name: "Diana", commander1: "Yuriko, the Tiger's Shadow" },
  ],
  totalTurns: 10,
  format: "commander",
};

const playerNames = defaultContext.players.map((p) => p.name);

describe("play-log-extractor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── validatePlayLog ─────────────────────────────────────────────

  describe("validatePlayLog", () => {
    it("validates a complete play log entry", () => {
      const result = validatePlayLog(
        {
          playerName: "Alice",
          turnNumber: 3,
          lifeTotal: 38,
          lifeDelta: -2,
          landsPlayed: 1,
          spellsCast: 2,
          creaturesAttacked: 0,
          manaSpent: 5,
          cardsPlayed: ["Sol Ring", "Rhystic Study"],
          summary: "Played Sol Ring into Rhystic Study",
          confidence: "high",
        },
        playerNames
      );

      expect(result).toEqual({
        playerName: "Alice",
        turnNumber: 3,
        lifeTotal: 38,
        lifeDelta: -2,
        landsPlayed: 1,
        spellsCast: 2,
        creaturesAttacked: 0,
        manaSpent: 5,
        cardsPlayed: ["Sol Ring", "Rhystic Study"],
        summary: "Played Sol Ring into Rhystic Study",
        confidence: "high",
      });
    });

    it("validates a minimal play log entry", () => {
      const result = validatePlayLog(
        {
          playerName: "Bob",
          turnNumber: 1,
          confidence: "medium",
        },
        playerNames
      );

      expect(result).toEqual({
        playerName: "Bob",
        turnNumber: 1,
        confidence: "medium",
      });
    });

    it("validates an out-of-turn play log entry", () => {
      const result = validatePlayLog(
        {
          playerName: "Bob",
          turnNumber: 5,
          activePlayerName: "Alice",
          spellsCast: 1,
          cardsPlayed: ["Swords to Plowshares"],
          summary: "Cast Swords to Plowshares on Alice's Tarmogoyf",
          confidence: "high",
        },
        playerNames
      );

      expect(result).not.toBeNull();
      expect(result!.activePlayerName).toBe("Alice");
      expect(result!.playerName).toBe("Bob");
    });

    it("rejects entry with unknown playerName", () => {
      expect(
        validatePlayLog(
          { playerName: "Unknown", turnNumber: 1, confidence: "high" },
          playerNames
        )
      ).toBeNull();
    });

    it("rejects entry with unknown activePlayerName", () => {
      expect(
        validatePlayLog(
          {
            playerName: "Alice",
            turnNumber: 1,
            activePlayerName: "Unknown",
            confidence: "high",
          },
          playerNames
        )
      ).toBeNull();
    });

    it("rejects entry where activePlayerName equals playerName", () => {
      expect(
        validatePlayLog(
          {
            playerName: "Alice",
            turnNumber: 1,
            activePlayerName: "Alice",
            confidence: "high",
          },
          playerNames
        )
      ).toBeNull();
    });

    it("rejects entry with missing playerName", () => {
      expect(
        validatePlayLog(
          { turnNumber: 1, confidence: "high" },
          playerNames
        )
      ).toBeNull();
    });

    it("rejects entry with invalid turnNumber", () => {
      expect(
        validatePlayLog(
          { playerName: "Alice", turnNumber: 0, confidence: "high" },
          playerNames
        )
      ).toBeNull();

      expect(
        validatePlayLog(
          { playerName: "Alice", turnNumber: -1, confidence: "high" },
          playerNames
        )
      ).toBeNull();
    });

    it("rejects entry with non-number turnNumber", () => {
      expect(
        validatePlayLog(
          { playerName: "Alice", turnNumber: "one", confidence: "high" },
          playerNames
        )
      ).toBeNull();
    });

    it("rejects entry with invalid confidence", () => {
      expect(
        validatePlayLog(
          { playerName: "Alice", turnNumber: 1, confidence: "very_high" },
          playerNames
        )
      ).toBeNull();
    });

    it("handles case-insensitive player name matching", () => {
      const result = validatePlayLog(
        { playerName: "alice", turnNumber: 1, confidence: "high" },
        playerNames
      );
      expect(result).not.toBeNull();
    });

    it("filters non-string values from cardsPlayed array", () => {
      const result = validatePlayLog(
        {
          playerName: "Alice",
          turnNumber: 1,
          cardsPlayed: ["Sol Ring", 42, null, "Mana Crypt"],
          confidence: "high",
        },
        playerNames
      );

      expect(result).not.toBeNull();
      expect(result!.cardsPlayed).toEqual(["Sol Ring", "Mana Crypt"]);
    });

    it("includes combat tracking fields", () => {
      const result = validatePlayLog(
        {
          playerName: "Alice",
          turnNumber: 5,
          creaturesAttacked: 3,
          commanderDamageDealt: 6,
          attackedPlayerNames: ["Bob", "Carlos"],
          eliminatedPlayerNames: ["Diana"],
          confidence: "high",
        },
        playerNames
      );

      expect(result).not.toBeNull();
      expect(result!.creaturesAttacked).toBe(3);
      expect(result!.commanderDamageDealt).toBe(6);
      expect(result!.attackedPlayerNames).toEqual(["Bob", "Carlos"]);
      expect(result!.eliminatedPlayerNames).toEqual(["Diana"]);
    });

    it("omits summary when empty string", () => {
      const result = validatePlayLog(
        {
          playerName: "Alice",
          turnNumber: 1,
          summary: "   ",
          confidence: "high",
        },
        playerNames
      );

      expect(result).not.toBeNull();
      expect(result!.summary).toBeUndefined();
    });
  });

  // ─── buildPlayLogUserMessage ──────────────────────────────────────

  describe("buildPlayLogUserMessage", () => {
    it("includes all players with commanders", () => {
      const msg = buildPlayLogUserMessage("some transcript", defaultContext);

      expect(msg).toContain("Alice (Atraxa, Praetors' Voice)");
      expect(msg).toContain("Bob (Korvold, Fae-Cursed King)");
      expect(msg).toContain("Carlos (Tymna the Weaver / Thrasios, Triton Hero)");
      expect(msg).toContain("Diana (Yuriko, the Tiger's Shadow)");
    });

    it("includes format and total turns", () => {
      const msg = buildPlayLogUserMessage("transcript text", defaultContext);

      expect(msg).toContain("Format: commander");
      expect(msg).toContain("Total turns played: 10");
    });

    it("includes full transcript", () => {
      const msg = buildPlayLogUserMessage("Turn 1: Alice plays Sol Ring", defaultContext);

      expect(msg).toContain("FULL GAME TRANSCRIPT:");
      expect(msg).toContain("Turn 1: Alice plays Sol Ring");
    });

    it("handles players without commanders", () => {
      const ctx: PlayLogExtractionContext = {
        ...defaultContext,
        players: [{ name: "NoCommander" }],
      };
      const msg = buildPlayLogUserMessage("test", ctx);

      expect(msg).toContain("- NoCommander");
      expect(msg).not.toContain("- NoCommander (");
    });
  });

  // ─── EXTRACT_PLAY_LOGS_TOOL schema ───────────────────────────────

  describe("EXTRACT_PLAY_LOGS_TOOL", () => {
    it("has the correct tool name", () => {
      expect(EXTRACT_PLAY_LOGS_TOOL.name).toBe("extract_play_logs");
    });

    it("requires playLogs array in schema", () => {
      const schema = EXTRACT_PLAY_LOGS_TOOL.input_schema as Record<string, unknown>;
      expect(schema.required).toContain("playLogs");
    });

    it("has required fields: playerName, turnNumber, confidence", () => {
      const schema = EXTRACT_PLAY_LOGS_TOOL.input_schema as {
        properties: {
          playLogs: { items: { required: string[] } };
        };
      };
      expect(schema.properties.playLogs.items.required).toContain("playerName");
      expect(schema.properties.playLogs.items.required).toContain("turnNumber");
      expect(schema.properties.playLogs.items.required).toContain("confidence");
    });
  });

  // ─── extractPlayLogs (integration with mock API) ─────────────────

  describe("extractPlayLogs", () => {
    it("returns empty array for empty transcript", async () => {
      const result = await extractPlayLogs("", defaultContext);
      expect(result).toEqual([]);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("returns empty array for whitespace-only transcript", async () => {
      const result = await extractPlayLogs("   ", defaultContext);
      expect(result).toEqual([]);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("extracts play logs from a valid API response", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            id: "test",
            name: "extract_play_logs",
            input: {
              playLogs: [
                {
                  playerName: "Alice",
                  turnNumber: 1,
                  landsPlayed: 1,
                  spellsCast: 1,
                  cardsPlayed: ["Sol Ring"],
                  summary: "Played Sol Ring and passed",
                  confidence: "high",
                },
                {
                  playerName: "Bob",
                  turnNumber: 1,
                  landsPlayed: 1,
                  spellsCast: 0,
                  summary: "Played a land and passed",
                  confidence: "medium",
                },
              ],
            },
          },
        ],
      });

      const result = await extractPlayLogs(
        "Turn 1: Alice plays Sol Ring. Bob plays a land.",
        defaultContext
      );

      expect(result).toHaveLength(2);
      expect(result[0].playerName).toBe("Alice");
      expect(result[0].cardsPlayed).toEqual(["Sol Ring"]);
      expect(result[1].playerName).toBe("Bob");
    });

    it("extracts out-of-turn plays correctly", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            id: "test",
            name: "extract_play_logs",
            input: {
              playLogs: [
                {
                  playerName: "Alice",
                  turnNumber: 3,
                  spellsCast: 1,
                  cardsPlayed: ["Cyclonic Rift"],
                  summary: "Cast overloaded Cyclonic Rift",
                  confidence: "high",
                },
                {
                  playerName: "Bob",
                  turnNumber: 3,
                  activePlayerName: "Alice",
                  spellsCast: 1,
                  cardsPlayed: ["Counterspell"],
                  summary: "Countered Alice's Cyclonic Rift",
                  confidence: "high",
                },
              ],
            },
          },
        ],
      });

      const result = await extractPlayLogs(
        "Turn 3: Alice casts Cyclonic Rift. Bob counters it.",
        defaultContext
      );

      expect(result).toHaveLength(2);
      expect(result[0].activePlayerName).toBeUndefined();
      expect(result[1].activePlayerName).toBe("Alice");
    });

    it("filters out invalid play logs", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            id: "test",
            name: "extract_play_logs",
            input: {
              playLogs: [
                {
                  playerName: "Alice",
                  turnNumber: 1,
                  confidence: "high",
                },
                {
                  playerName: "UnknownPlayer",
                  turnNumber: 1,
                  confidence: "high",
                },
                {
                  // Missing playerName
                  turnNumber: 2,
                  confidence: "high",
                },
              ],
            },
          },
        ],
      });

      const result = await extractPlayLogs("some transcript", defaultContext);

      expect(result).toHaveLength(1);
      expect(result[0].playerName).toBe("Alice");
    });

    it("returns empty array when API returns no tool use", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: "I could not extract any events" }],
      });

      const result = await extractPlayLogs("some transcript", defaultContext);
      expect(result).toEqual([]);
    });

    it("returns empty array when API returns empty playLogs", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            id: "test",
            name: "extract_play_logs",
            input: { playLogs: [] },
          },
        ],
      });

      const result = await extractPlayLogs("some transcript", defaultContext);
      expect(result).toEqual([]);
    });

    it("calls Anthropic API with correct parameters", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            id: "test",
            name: "extract_play_logs",
            input: { playLogs: [] },
          },
        ],
      });

      await extractPlayLogs("test transcript", defaultContext);

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const call = mockCreate.mock.calls[0][0];
      expect(call.model).toBe("claude-sonnet-4-20250514");
      expect(call.max_tokens).toBe(8192);
      expect(call.tools).toEqual([EXTRACT_PLAY_LOGS_TOOL]);
      expect(call.tool_choice).toEqual({ type: "tool", name: "extract_play_logs" });
      expect(call.messages[0].content).toContain("test transcript");
    });

    it("handles complex multi-player, multi-turn scenario", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            id: "test",
            name: "extract_play_logs",
            input: {
              playLogs: [
                {
                  playerName: "Alice",
                  turnNumber: 5,
                  spellsCast: 1,
                  cardsPlayed: ["Craterhoof Behemoth"],
                  creaturesAttacked: 5,
                  attackedPlayerNames: ["Bob", "Carlos", "Diana"],
                  eliminatedPlayerNames: ["Diana"],
                  summary: "Cast Craterhoof Behemoth and swung at everyone, eliminating Diana",
                  confidence: "high",
                },
                {
                  playerName: "Carlos",
                  turnNumber: 5,
                  activePlayerName: "Alice",
                  spellsCast: 1,
                  cardsPlayed: ["Fog"],
                  summary: "Cast Fog to prevent combat damage",
                  confidence: "high",
                },
                {
                  playerName: "Bob",
                  turnNumber: 5,
                  activePlayerName: "Alice",
                  lifeDelta: -21,
                  lifeTotal: 19,
                  summary: "Took 21 damage from Alice's attack",
                  confidence: "medium",
                },
              ],
            },
          },
        ],
      });

      const result = await extractPlayLogs(
        "Turn 5: Alice casts Craterhoof and attacks everyone. Carlos fogs. Diana dies.",
        defaultContext
      );

      expect(result).toHaveLength(3);
      // Active player entry
      expect(result[0].playerName).toBe("Alice");
      expect(result[0].activePlayerName).toBeUndefined();
      expect(result[0].eliminatedPlayerNames).toEqual(["Diana"]);
      // Out-of-turn responses
      expect(result[1].playerName).toBe("Carlos");
      expect(result[1].activePlayerName).toBe("Alice");
      expect(result[2].playerName).toBe("Bob");
      expect(result[2].activePlayerName).toBe("Alice");
      expect(result[2].lifeDelta).toBe(-21);
    });
  });
});
