// Re-export everything from the shared package
// This allows existing @/types/mtg imports to continue working
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
} from "@karakas/shared";

export type {
  MtgFormat,
  EdhBracket,
  PowerPlayType,
} from "@karakas/shared";
