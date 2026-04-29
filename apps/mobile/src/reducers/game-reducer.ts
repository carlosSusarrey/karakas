import {
  getStartingLife,
  COMMANDER_DAMAGE_THRESHOLD,
  POISON_THRESHOLD,
  isCommanderFormat,
} from "@karakas/shared";

// --- Types ---

export type PlayerState = {
  id: string;
  name: string;
  lifeTotal: number;
  commanderDamage: Record<string, number>; // sourcePlayerId → damage
  poisonCounters: number;
  energyCounters: number;
  experienceCounters: number;
  isMonarch: boolean;
  hasInitiative: boolean;
  isEliminated: boolean;
  eliminatedTurn: number | null;
  // Server-side metadata (for syncing)
  serverUserId?: string;
  serverPlaygroupPlayerId?: string;
  serverDeckId?: string;
  commanderUsed1?: string;
  commanderUsed2?: string;
  bracketUsed?: number;
};

export type LocalPowerPlay = {
  id: string;
  gamePlayerId: string;
  turn: number;
  type: string;
  description: string;
  cardName?: string;
};

export type GameState = {
  players: PlayerState[];
  currentTurn: number;
  activePlayerIndex: number;
  format: string;
  startingLife: number;
  history: GameAction[];
  historyIndex: number;
  gameStartedAt: string; // ISO string for serialization
  powerPlays: LocalPowerPlay[];
  serverId: string | null;
  playgroupId: string | null;
};

// --- Actions ---

export type GameAction =
  | { type: "CHANGE_LIFE"; playerId: string; amount: number }
  | { type: "SET_COMMANDER_DAMAGE"; playerId: string; sourceId: string; amount: number }
  | { type: "CHANGE_POISON"; playerId: string; amount: number }
  | { type: "CHANGE_ENERGY"; playerId: string; amount: number }
  | { type: "CHANGE_EXPERIENCE"; playerId: string; amount: number }
  | { type: "SET_MONARCH"; playerId: string }
  | { type: "CLEAR_MONARCH" }
  | { type: "SET_INITIATIVE"; playerId: string }
  | { type: "CLEAR_INITIATIVE" }
  | { type: "ELIMINATE_PLAYER"; playerId: string }
  | { type: "REINSTATE_PLAYER"; playerId: string }
  | { type: "ADVANCE_TURN" }
  | { type: "SET_TURN"; turn: number }
  | { type: "REORDER_PLAYERS"; playerIds: string[] }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "RESET_GAME" }
  | { type: "RESTORE_STATE"; state: GameState };

// --- Helpers ---

let _idCounter = 0;
export function generateId(): string {
  return `${Date.now()}-${++_idCounter}`;
}

export type PlayerSetupData = {
  name: string;
  userId?: string;
  playgroupPlayerId?: string;
  deckId?: string;
  commanderUsed1?: string;
  commanderUsed2?: string;
  bracketUsed?: number;
};

export function createPlayer(name: string, startingLife: number, setup?: Partial<PlayerSetupData>): PlayerState {
  return {
    id: generateId(),
    name,
    lifeTotal: startingLife,
    commanderDamage: {},
    poisonCounters: 0,
    energyCounters: 0,
    experienceCounters: 0,
    isMonarch: false,
    hasInitiative: false,
    isEliminated: false,
    eliminatedTurn: null,
    serverUserId: setup?.userId,
    serverPlaygroupPlayerId: setup?.playgroupPlayerId,
    serverDeckId: setup?.deckId,
    commanderUsed1: setup?.commanderUsed1,
    commanderUsed2: setup?.commanderUsed2,
    bracketUsed: setup?.bracketUsed,
  };
}

export function createInitialState(
  format: string,
  playerData: PlayerSetupData[],
  playgroupId?: string | null
): GameState {
  const startingLife = getStartingLife(format);
  return {
    players: playerData.map((p) => createPlayer(p.name, startingLife, p)),
    currentTurn: 1,
    activePlayerIndex: 0,
    format,
    startingLife,
    history: [],
    historyIndex: -1,
    gameStartedAt: new Date().toISOString(),
    powerPlays: [],
    serverId: null,
    playgroupId: playgroupId ?? null,
  };
}

// Check if a player should be eliminated based on game rules
function checkElimination(player: PlayerState, format: string): boolean {
  if (player.isEliminated) return true;
  if (player.lifeTotal <= 0) return true;
  if (player.poisonCounters >= POISON_THRESHOLD) return true;
  if (isCommanderFormat(format)) {
    for (const damage of Object.values(player.commanderDamage)) {
      if (damage >= COMMANDER_DAMAGE_THRESHOLD) return true;
    }
  }
  return false;
}

// --- Reducer ---

// Apply an action WITHOUT recording it to history (used internally)
function applyAction(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case "CHANGE_LIFE": {
      return {
        ...state,
        players: state.players.map((p) => {
          if (p.id !== action.playerId) return p;
          const updated = { ...p, lifeTotal: p.lifeTotal + action.amount };
          if (checkElimination(updated, state.format) && !p.isEliminated) {
            return { ...updated, isEliminated: true, eliminatedTurn: state.currentTurn };
          }
          return updated;
        }),
      };
    }

    case "SET_COMMANDER_DAMAGE": {
      return {
        ...state,
        players: state.players.map((p) => {
          if (p.id !== action.playerId) return p;
          const prevDamage = p.commanderDamage[action.sourceId] ?? 0;
          const diff = action.amount - prevDamage;
          const updated = {
            ...p,
            commanderDamage: { ...p.commanderDamage, [action.sourceId]: action.amount },
            lifeTotal: p.lifeTotal - diff,
          };
          if (checkElimination(updated, state.format) && !p.isEliminated) {
            return { ...updated, isEliminated: true, eliminatedTurn: state.currentTurn };
          }
          return updated;
        }),
      };
    }

    case "CHANGE_POISON": {
      return {
        ...state,
        players: state.players.map((p) => {
          if (p.id !== action.playerId) return p;
          const updated = {
            ...p,
            poisonCounters: Math.max(0, p.poisonCounters + action.amount),
          };
          if (checkElimination(updated, state.format) && !p.isEliminated) {
            return { ...updated, isEliminated: true, eliminatedTurn: state.currentTurn };
          }
          return updated;
        }),
      };
    }

    case "CHANGE_ENERGY": {
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === action.playerId
            ? { ...p, energyCounters: Math.max(0, p.energyCounters + action.amount) }
            : p
        ),
      };
    }

    case "CHANGE_EXPERIENCE": {
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === action.playerId
            ? { ...p, experienceCounters: Math.max(0, p.experienceCounters + action.amount) }
            : p
        ),
      };
    }

    case "SET_MONARCH": {
      return {
        ...state,
        players: state.players.map((p) => ({
          ...p,
          isMonarch: p.id === action.playerId,
        })),
      };
    }

    case "CLEAR_MONARCH": {
      return {
        ...state,
        players: state.players.map((p) => ({ ...p, isMonarch: false })),
      };
    }

    case "SET_INITIATIVE": {
      return {
        ...state,
        players: state.players.map((p) => ({
          ...p,
          hasInitiative: p.id === action.playerId,
        })),
      };
    }

    case "CLEAR_INITIATIVE": {
      return {
        ...state,
        players: state.players.map((p) => ({ ...p, hasInitiative: false })),
      };
    }

    case "ELIMINATE_PLAYER": {
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === action.playerId
            ? { ...p, isEliminated: true, eliminatedTurn: state.currentTurn }
            : p
        ),
      };
    }

    case "REINSTATE_PLAYER": {
      return {
        ...state,
        players: state.players.map((p) =>
          p.id === action.playerId
            ? { ...p, isEliminated: false, eliminatedTurn: null }
            : p
        ),
      };
    }

    case "ADVANCE_TURN": {
      // Move to next non-eliminated player
      let nextIndex = (state.activePlayerIndex + 1) % state.players.length;
      let attempts = 0;
      while (state.players[nextIndex].isEliminated && attempts < state.players.length) {
        nextIndex = (nextIndex + 1) % state.players.length;
        attempts++;
      }
      // A "turn" is a full round. Only increment when wrapping back to the first active player.
      const firstActiveIndex = state.players.findIndex((p) => !p.isEliminated);
      const newTurn = nextIndex === firstActiveIndex
        ? state.currentTurn + 1
        : state.currentTurn;
      return {
        ...state,
        currentTurn: newTurn,
        activePlayerIndex: nextIndex,
      };
    }

    case "SET_TURN": {
      return { ...state, currentTurn: action.turn };
    }

    case "REORDER_PLAYERS": {
      const reordered = action.playerIds.map(
        (id) => state.players.find((p) => p.id === id)!
      );
      // Adjust activePlayerIndex to follow the same player
      const activePlayer = state.players[state.activePlayerIndex];
      const newActiveIndex = reordered.findIndex((p) => p.id === activePlayer.id);
      return {
        ...state,
        players: reordered,
        activePlayerIndex: newActiveIndex >= 0 ? newActiveIndex : 0,
      };
    }

    case "RESET_GAME": {
      return createInitialState(
        state.format,
        state.players.map((p) => ({
          name: p.name,
          userId: p.serverUserId,
          playgroupPlayerId: p.serverPlaygroupPlayerId,
          deckId: p.serverDeckId,
          commanderUsed1: p.commanderUsed1,
          commanderUsed2: p.commanderUsed2,
          bracketUsed: p.bracketUsed,
        })),
        state.playgroupId
      );
    }

    default:
      return state;
  }
}

// Actions that should be recorded in history for undo/redo
const RECORDABLE_ACTIONS = new Set([
  "CHANGE_LIFE",
  "SET_COMMANDER_DAMAGE",
  "CHANGE_POISON",
  "CHANGE_ENERGY",
  "CHANGE_EXPERIENCE",
  "SET_MONARCH",
  "CLEAR_MONARCH",
  "SET_INITIATIVE",
  "CLEAR_INITIATIVE",
  "ELIMINATE_PLAYER",
  "REINSTATE_PLAYER",
  "ADVANCE_TURN",
  "SET_TURN",
]);

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (action.type === "UNDO") {
    if (state.historyIndex < 0) return state;
    const playerData = state.players.map((p) => ({
      name: p.name,
      userId: p.serverUserId,
      playgroupPlayerId: p.serverPlaygroupPlayerId,
      deckId: p.serverDeckId,
      commanderUsed1: p.commanderUsed1,
      commanderUsed2: p.commanderUsed2,
      bracketUsed: p.bracketUsed,
    }));

    // Re-create with the original player state
    const initialState = createInitialState(state.format, playerData, state.playgroupId);
    // We need to preserve original player IDs, so let's reconstruct differently
    let result: GameState = {
      ...initialState,
      players: initialState.players.map((p, i) => ({
        ...p,
        id: state.players[i]?.id ?? p.id,
      })),
      history: state.history,
      historyIndex: state.historyIndex - 1,
    };

    for (let i = 0; i <= state.historyIndex - 1; i++) {
      result = applyAction(result, state.history[i]);
    }
    result.history = state.history;
    result.historyIndex = state.historyIndex - 1;
    result.gameStartedAt = state.gameStartedAt;
    result.powerPlays = state.powerPlays;
    result.serverId = state.serverId;
    return result;
  }

  if (action.type === "REDO") {
    if (state.historyIndex >= state.history.length - 1) return state;
    const nextAction = state.history[state.historyIndex + 1];
    const result = applyAction(state, nextAction);
    return {
      ...result,
      history: state.history,
      historyIndex: state.historyIndex + 1,
      gameStartedAt: state.gameStartedAt,
      powerPlays: state.powerPlays,
      serverId: state.serverId,
    };
  }

  if (action.type === "RESTORE_STATE") {
    return action.state;
  }

  if (action.type === "RESET_GAME") {
    return applyAction(state, action);
  }

  const newState = applyAction(state, action);

  if (RECORDABLE_ACTIONS.has(action.type)) {
    // Truncate future history on new action (discard redo stack)
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(action);
    return {
      ...newState,
      history: newHistory,
      historyIndex: newHistory.length - 1,
    };
  }

  return newState;
}
