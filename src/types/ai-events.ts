import type { PowerPlayType } from "./mtg";

export type Confidence = "high" | "medium" | "low";

export interface SuggestedPowerPlay {
  type: "power_play";
  playerName: string;
  powerPlayType: PowerPlayType;
  description: string;
  cardName?: string;
  turn?: number;
  confidence: Confidence;
}

export interface SuggestedElimination {
  type: "elimination";
  playerName: string;
  turn?: number;
  confidence: Confidence;
}

export interface SuggestedTurnAdvance {
  type: "turn_advance";
  newTurn: number;
  confidence: Confidence;
}

export type SuggestedEvent =
  | SuggestedPowerPlay
  | SuggestedElimination
  | SuggestedTurnAdvance;

export interface ExtractionContext {
  players: { name: string; commander1?: string; commander2?: string }[];
  currentTurn: number;
  format: string;
  previousTranscript: string;
}

// ─── Play Log Extraction Types ──────────────────────────────────────

export interface ExtractedPlayLog {
  playerName: string;
  turnNumber: number;
  activePlayerName?: string; // Set when acting on someone else's turn
  lifeTotal?: number;
  lifeDelta?: number;
  landsPlayed?: number;
  spellsCast?: number;
  creaturesAttacked?: number;
  commanderDamageDealt?: number;
  manaSpent?: number;
  cardsPlayed?: string[];
  attackedPlayerNames?: string[];
  eliminatedPlayerNames?: string[];
  summary?: string;
  confidence: Confidence;
}

export interface PlayLogExtractionContext {
  players: { name: string; commander1?: string; commander2?: string }[];
  totalTurns: number;
  format: string;
}
