// The live game reducer is shared between web and mobile.
export {
  generateId,
  toPlayerSetupData,
  createPlayer,
  createInitialState,
  gameReducer,
  PLAYER_PALETTE,
} from "@karakas/shared";

export type {
  PendingNewDeck,
  PlayerState,
  LocalPowerPlay,
  GameState,
  GameAction,
  PlayerSetupData,
} from "@karakas/shared";
