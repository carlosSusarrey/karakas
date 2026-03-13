import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ExtractionContext } from "@/types/ai-events";

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
  extractGameEvents,
  validateEvent,
  buildUserMessage,
  EXTRACT_EVENTS_TOOL,
} from "@/lib/game-event-extractor";

// Reusable test fixtures
const defaultContext: ExtractionContext = {
  players: [
    { name: "Alice", commander1: "Atraxa, Praetors' Voice" },
    { name: "Bob", commander1: "Korvold, Fae-Cursed King" },
    { name: "Carlos", commander1: "Tymna the Weaver", commander2: "Thrasios, Triton Hero" },
    { name: "Diana", commander1: "Yuriko, the Tiger's Shadow" },
  ],
  currentTurn: 5,
  format: "commander",
  previousTranscript: "",
};

describe("game-event-extractor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── validateEvent ───────────────────────────────────────────────

  describe("validateEvent", () => {
    it("validates a power_play event with all fields", () => {
      const result = validateEvent({
        type: "power_play",
        playerName: "Alice",
        powerPlayType: "combo",
        description: "Assembled infinite combo with Exquisite Blood and Sanguine Bond",
        cardName: "Exquisite Blood",
        turn: 7,
        confidence: "high",
      });

      expect(result).toEqual({
        type: "power_play",
        playerName: "Alice",
        powerPlayType: "combo",
        description: "Assembled infinite combo with Exquisite Blood and Sanguine Bond",
        cardName: "Exquisite Blood",
        turn: 7,
        confidence: "high",
      });
    });

    it("validates a power_play without optional fields", () => {
      const result = validateEvent({
        type: "power_play",
        playerName: "Bob",
        powerPlayType: "boardwipe",
        description: "Wiped the board",
        confidence: "medium",
      });

      expect(result).toEqual({
        type: "power_play",
        playerName: "Bob",
        powerPlayType: "boardwipe",
        description: "Wiped the board",
        cardName: undefined,
        turn: undefined,
        confidence: "medium",
      });
    });

    it("rejects power_play with invalid powerPlayType", () => {
      expect(
        validateEvent({
          type: "power_play",
          playerName: "Alice",
          powerPlayType: "invalid_type",
          description: "Did something",
          confidence: "high",
        })
      ).toBeNull();
    });

    it("rejects power_play missing playerName", () => {
      expect(
        validateEvent({
          type: "power_play",
          powerPlayType: "combo",
          description: "Did something",
          confidence: "high",
        })
      ).toBeNull();
    });

    it("rejects power_play missing description", () => {
      expect(
        validateEvent({
          type: "power_play",
          playerName: "Alice",
          powerPlayType: "combo",
          confidence: "high",
        })
      ).toBeNull();
    });

    it("validates an elimination event", () => {
      const result = validateEvent({
        type: "elimination",
        playerName: "Diana",
        turn: 9,
        confidence: "high",
      });

      expect(result).toEqual({
        type: "elimination",
        playerName: "Diana",
        turn: 9,
        confidence: "high",
      });
    });

    it("validates elimination without turn", () => {
      const result = validateEvent({
        type: "elimination",
        playerName: "Bob",
        confidence: "medium",
      });

      expect(result).toEqual({
        type: "elimination",
        playerName: "Bob",
        turn: undefined,
        confidence: "medium",
      });
    });

    it("rejects elimination missing playerName", () => {
      expect(
        validateEvent({
          type: "elimination",
          confidence: "high",
        })
      ).toBeNull();
    });

    it("validates a turn_advance event", () => {
      const result = validateEvent({
        type: "turn_advance",
        newTurn: 6,
        confidence: "high",
      });

      expect(result).toEqual({
        type: "turn_advance",
        newTurn: 6,
        confidence: "high",
      });
    });

    it("rejects turn_advance missing newTurn", () => {
      expect(
        validateEvent({
          type: "turn_advance",
          confidence: "high",
        })
      ).toBeNull();
    });

    it("rejects turn_advance with non-number newTurn", () => {
      expect(
        validateEvent({
          type: "turn_advance",
          newTurn: "six",
          confidence: "high",
        })
      ).toBeNull();
    });

    it("rejects events with invalid confidence", () => {
      expect(
        validateEvent({
          type: "elimination",
          playerName: "Alice",
          confidence: "very_high",
        })
      ).toBeNull();
    });

    it("rejects unknown event types", () => {
      expect(
        validateEvent({
          type: "life_change",
          playerName: "Alice",
          confidence: "high",
        })
      ).toBeNull();
    });

    it("validates all power play types", () => {
      const types = [
        "combo", "boardwipe", "theft", "wincon", "removal",
        "counter", "ramp", "fastmana", "draw", "tutor", "lock", "other",
      ];
      for (const ppt of types) {
        const result = validateEvent({
          type: "power_play",
          playerName: "Alice",
          powerPlayType: ppt,
          description: `Did a ${ppt}`,
          confidence: "medium",
        });
        expect(result).not.toBeNull();
        expect(result!.type).toBe("power_play");
      }
    });
  });

  // ─── buildUserMessage ────────────────────────────────────────────

  describe("buildUserMessage", () => {
    it("includes all players with commanders", () => {
      const msg = buildUserMessage("some transcript", defaultContext, false);

      expect(msg).toContain("Alice (Atraxa, Praetors' Voice)");
      expect(msg).toContain("Bob (Korvold, Fae-Cursed King)");
      expect(msg).toContain("Carlos (Tymna the Weaver / Thrasios, Triton Hero)");
      expect(msg).toContain("Diana (Yuriko, the Tiger's Shadow)");
    });

    it("includes format and turn", () => {
      const msg = buildUserMessage("transcript text", defaultContext, false);

      expect(msg).toContain("Format: commander");
      expect(msg).toContain("Current turn: 5");
    });

    it("includes new transcript in normal mode", () => {
      const msg = buildUserMessage("Alice casts Cyclonic Rift", defaultContext, false);

      expect(msg).toContain("NEW TRANSCRIPT TO ANALYZE:");
      expect(msg).toContain("Alice casts Cyclonic Rift");
      expect(msg).not.toContain("SUMMARY MODE");
    });

    it("includes previous transcript when provided", () => {
      const ctx: ExtractionContext = {
        ...defaultContext,
        previousTranscript: "Earlier stuff happened",
      };
      const msg = buildUserMessage("new stuff", ctx, false);

      expect(msg).toContain("PREVIOUS TRANSCRIPT (for context only");
      expect(msg).toContain("Earlier stuff happened");
      expect(msg).toContain("NEW TRANSCRIPT TO ANALYZE:");
      expect(msg).toContain("new stuff");
    });

    it("uses summary mode correctly", () => {
      const msg = buildUserMessage("full game transcript", defaultContext, true);

      expect(msg).toContain("SUMMARY MODE");
      expect(msg).toContain("FULL TRANSCRIPT:");
      expect(msg).toContain("full game transcript");
      expect(msg).not.toContain("NEW TRANSCRIPT TO ANALYZE:");
    });

    it("handles players without commanders", () => {
      const ctx: ExtractionContext = {
        ...defaultContext,
        players: [{ name: "NoCommander" }],
      };
      const msg = buildUserMessage("test", ctx, false);

      expect(msg).toContain("- NoCommander");
      expect(msg).not.toContain("- NoCommander (");
    });
  });

  // ─── EXTRACT_EVENTS_TOOL schema ─────────────────────────────────

  describe("EXTRACT_EVENTS_TOOL", () => {
    it("has the correct tool name", () => {
      expect(EXTRACT_EVENTS_TOOL.name).toBe("extract_events");
    });

    it("requires events array in schema", () => {
      const schema = EXTRACT_EVENTS_TOOL.input_schema as Record<string, unknown>;
      expect(schema.required).toContain("events");
    });

    it("includes all three event types in enum", () => {
      const schema = EXTRACT_EVENTS_TOOL.input_schema as {
        properties: {
          events: {
            items: { properties: { type: { enum: string[] } } };
          };
        };
      };
      const typeEnum = schema.properties.events.items.properties.type.enum;
      expect(typeEnum).toContain("power_play");
      expect(typeEnum).toContain("elimination");
      expect(typeEnum).toContain("turn_advance");
    });
  });

  // ─── extractGameEvents (with mocked Anthropic) ──────────────────

  describe("extractGameEvents", () => {
    it("returns empty array for empty transcript", async () => {
      const result = await extractGameEvents("", defaultContext);
      expect(result).toEqual([]);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("returns empty array for whitespace-only transcript", async () => {
      const result = await extractGameEvents("   \n  ", defaultContext);
      expect(result).toEqual([]);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("passes correct parameters to Anthropic API", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            id: "call_1",
            name: "extract_events",
            input: { events: [] },
          },
        ],
      });

      await extractGameEvents("Alice plays Sol Ring", defaultContext);

      expect(mockCreate).toHaveBeenCalledOnce();
      const call = mockCreate.mock.calls[0][0];
      expect(call.model).toBe("claude-sonnet-4-20250514");
      expect(call.max_tokens).toBe(4096);
      expect(call.tools).toHaveLength(1);
      expect(call.tools[0].name).toBe("extract_events");
      expect(call.tool_choice).toEqual({ type: "tool", name: "extract_events" });
      expect(call.messages).toHaveLength(1);
      expect(call.messages[0].role).toBe("user");
      expect(call.messages[0].content).toContain("Alice plays Sol Ring");
    });

    it("extracts and validates events from Claude response", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            id: "call_1",
            name: "extract_events",
            input: {
              events: [
                {
                  type: "power_play",
                  playerName: "Alice",
                  powerPlayType: "fastmana",
                  description: "Turn 1 Sol Ring into Arcane Signet",
                  cardName: "Sol Ring",
                  turn: 1,
                  confidence: "high",
                },
                {
                  type: "power_play",
                  playerName: "Bob",
                  powerPlayType: "removal",
                  description: "Destroyed Alice's Atraxa with Beast Within",
                  cardName: "Beast Within",
                  turn: 3,
                  confidence: "medium",
                },
              ],
            },
          },
        ],
      });

      const result = await extractGameEvents(
        "Alice plays Sol Ring then Arcane Signet. Later Bob casts Beast Within on Atraxa.",
        defaultContext
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        type: "power_play",
        playerName: "Alice",
        powerPlayType: "fastmana",
        description: "Turn 1 Sol Ring into Arcane Signet",
        cardName: "Sol Ring",
        turn: 1,
        confidence: "high",
      });
      expect(result[1].type).toBe("power_play");
      expect(result[1].confidence).toBe("medium");
    });

    it("filters out invalid events from Claude response", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            id: "call_1",
            name: "extract_events",
            input: {
              events: [
                {
                  type: "power_play",
                  playerName: "Alice",
                  powerPlayType: "combo",
                  description: "Valid event",
                  confidence: "high",
                },
                {
                  // Invalid: missing playerName for elimination
                  type: "elimination",
                  confidence: "high",
                },
                {
                  // Invalid: unknown type
                  type: "unknown_event",
                  confidence: "high",
                },
                {
                  type: "turn_advance",
                  newTurn: 6,
                  confidence: "high",
                },
              ],
            },
          },
        ],
      });

      const result = await extractGameEvents("some game chatter", defaultContext);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe("power_play");
      expect(result[1].type).toBe("turn_advance");
    });

    it("returns empty array when Claude returns no tool_use block", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [{ type: "text", text: "No events found." }],
      });

      const result = await extractGameEvents("just chatting", defaultContext);
      expect(result).toEqual([]);
    });

    it("returns empty array when tool input has no events", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            id: "call_1",
            name: "extract_events",
            input: {},
          },
        ],
      });

      const result = await extractGameEvents("some chatter", defaultContext);
      expect(result).toEqual([]);
    });

    it("handles a complex multi-event game scenario", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            id: "call_1",
            name: "extract_events",
            input: {
              events: [
                {
                  type: "turn_advance",
                  newTurn: 8,
                  confidence: "high",
                },
                {
                  type: "power_play",
                  playerName: "Carlos",
                  powerPlayType: "boardwipe",
                  description: "Cast Cyclonic Rift overloaded, bouncing all opponents' nonland permanents",
                  cardName: "Cyclonic Rift",
                  turn: 8,
                  confidence: "high",
                },
                {
                  type: "power_play",
                  playerName: "Carlos",
                  powerPlayType: "wincon",
                  description: "Swung lethal with Thrasios after clearing the board",
                  turn: 8,
                  confidence: "medium",
                },
                {
                  type: "elimination",
                  playerName: "Diana",
                  turn: 8,
                  confidence: "high",
                },
                {
                  type: "elimination",
                  playerName: "Bob",
                  turn: 8,
                  confidence: "high",
                },
                {
                  type: "elimination",
                  playerName: "Alice",
                  turn: 8,
                  confidence: "medium",
                },
              ],
            },
          },
        ],
      });

      const transcript = `
        Okay we're going to turn 8. Carlos untaps, draws. Oh no, he's got that look.
        Carlos casts Cyclonic Rift with overload! Everything bounces! That's insane.
        He swings with Thrasios for lethal on Diana. Diana's out.
        Bob can't block either, he's dead too. Alice scoops, that's game.
      `;

      const result = await extractGameEvents(transcript, defaultContext);

      expect(result).toHaveLength(6);

      const turnAdvance = result.find((e) => e.type === "turn_advance");
      expect(turnAdvance).toBeDefined();
      if (turnAdvance?.type === "turn_advance") {
        expect(turnAdvance.newTurn).toBe(8);
      }

      const eliminations = result.filter((e) => e.type === "elimination");
      expect(eliminations).toHaveLength(3);

      const powerPlays = result.filter((e) => e.type === "power_play");
      expect(powerPlays).toHaveLength(2);
    });

    it("uses summary mode when isSummary is true", async () => {
      mockCreate.mockResolvedValueOnce({
        content: [
          {
            type: "tool_use",
            id: "call_1",
            name: "extract_events",
            input: { events: [] },
          },
        ],
      });

      await extractGameEvents("full game transcript here", defaultContext, true);

      const userMessage = mockCreate.mock.calls[0][0].messages[0].content;
      expect(userMessage).toContain("SUMMARY MODE");
      expect(userMessage).toContain("FULL TRANSCRIPT:");
    });
  });
});
