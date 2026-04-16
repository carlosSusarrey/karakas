// MTG types and constants
export {
  MTG_FORMATS,
  FORMAT_LABELS,
  STARTING_LIFE,
  DEFAULT_STARTING_LIFE,
  COMMANDER_DAMAGE_THRESHOLD,
  POISON_THRESHOLD,
  COMMANDER_FORMATS,
  BRACKET_FORMATS,
  EDH_BRACKETS,
  BRACKET_DESCRIPTIONS,
  POWER_PLAY_TYPES,
  POWER_PLAY_LABELS,
  isCommanderFormat,
  hasBrackets,
  getStartingLife,
} from "./types/mtg";

export type {
  MtgFormat,
  EdhBracket,
  PowerPlayType,
} from "./types/mtg";

// AI event types
export type {
  Confidence,
  SuggestedPowerPlay,
  SuggestedElimination,
  SuggestedTurnAdvance,
  SuggestedEvent,
  ExtractionContext,
} from "./types/ai-events";
