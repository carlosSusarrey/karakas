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
