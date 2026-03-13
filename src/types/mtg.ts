// MTG Game Formats
export const MTG_FORMATS = [
  "commander",
  "standard",
  "modern",
  "legacy",
  "vintage",
  "pioneer",
  "pauper",
  "draft",
  "sealed",
  "oathbreaker",
  "brawl",
  "historic",
  "alchemy",
  "explorer",
  "timeless",
] as const;

export type MtgFormat = (typeof MTG_FORMATS)[number];

// Format display names
export const FORMAT_LABELS: Record<MtgFormat, string> = {
  commander: "Commander (EDH)",
  standard: "Standard",
  modern: "Modern",
  legacy: "Legacy",
  vintage: "Vintage",
  pioneer: "Pioneer",
  pauper: "Pauper",
  draft: "Draft",
  sealed: "Sealed",
  oathbreaker: "Oathbreaker",
  brawl: "Brawl",
  historic: "Historic",
  alchemy: "Alchemy",
  explorer: "Explorer",
  timeless: "Timeless",
};

// Formats that use commanders
export const COMMANDER_FORMATS: MtgFormat[] = [
  "commander",
  "oathbreaker",
  "brawl",
];

// Formats that use EDH brackets
export const BRACKET_FORMATS: MtgFormat[] = ["commander"];

// EDH Brackets (1-5)
export const EDH_BRACKETS = [1, 2, 3, 4, 5] as const;
export type EdhBracket = (typeof EDH_BRACKETS)[number];

export const BRACKET_DESCRIPTIONS: Record<EdhBracket, string> = {
  1: "Exhibition - Theme and creativity over power",
  2: "Core - Unoptimized, straightforward, social",
  3: "Upgraded - Strong synergy, effective disruption",
  4: "Optimized - Fast, lethal, consistent",
  5: "cEDH - Competitive metagame excellence",
};

// Power Play Types
export const POWER_PLAY_TYPES = [
  "combo",
  "boardwipe",
  "theft",
  "wincon",
  "removal",
  "counter",
  "ramp",
  "fastmana",
  "draw",
  "tutor",
  "lock",
  "other",
] as const;

export type PowerPlayType = (typeof POWER_PLAY_TYPES)[number];

export const POWER_PLAY_LABELS: Record<PowerPlayType, string> = {
  combo: "Combo",
  boardwipe: "Board Wipe",
  theft: "Theft/Control Magic",
  wincon: "Win Condition",
  removal: "Removal",
  counter: "Counterspell",
  ramp: "Big Ramp",
  fastmana: "Fast Mana",
  draw: "Card Draw",
  tutor: "Tutor",
  lock: "Stax/Lock",
  other: "Other",
};

// Helper functions
export function isCommanderFormat(format: string): boolean {
  return COMMANDER_FORMATS.includes(format as MtgFormat);
}

export function hasBrackets(format: string): boolean {
  return BRACKET_FORMATS.includes(format as MtgFormat);
}
