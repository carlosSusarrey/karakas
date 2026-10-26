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

// API types
export type {
  AuthUser,
  LoginRequest,
  SignupRequest,
  AuthResponse,
  RefreshRequest,
  RefreshResponse,
  PlaygroupSummary,
  DeckSummary,
  ApiError,
  AuthFeatures,
  DeckKind,
  CompleteGameSeat,
  CompleteGamePowerPlay,
  CompleteGameRequest,
  CompleteGameResponse,
} from "./types/api";

// Live game state (life counter)
export {
  generateId,
  toPlayerSetupData,
  createPlayer,
  createInitialState,
  gameReducer,
  PLAYER_PALETTE,
} from "./game/reducer";

export type {
  PendingNewDeck,
  PlayerState,
  LocalPowerPlay,
  GameState,
  GameAction,
  PlayerSetupData,
} from "./game/reducer";

export { computePlacements } from "./game/placements";
export type { PlacementInput, PlacementResult } from "./game/placements";

export { buildCompleteGameRequest, rematchSetup } from "./game/complete";
export type { SetupDraft } from "./game/complete";

// Photo-based setup: detection types + deck matching
export type {
  PlayerIdentity,
  SetupPlayer,
  DeckRef,
  CandidateDeck,
  DetectedCommander,
  PodGroup,
  SeatStatus,
  SeatProposal,
  Pin,
  QuestionType,
  QuestionOption,
  PodQuestion,
  MatchInput,
  MatchResult,
} from "./types/pod-setup";

export { matchPod, defaultPins, normalizeCardName, deckRefKey } from "./pod-setup/matcher";
export { seatsToPlayerSetup } from "./pod-setup/to-player-setup";
