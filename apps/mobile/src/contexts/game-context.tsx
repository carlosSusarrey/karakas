import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  GameState,
  GameAction,
  gameReducer,
  createInitialState,
  PlayerSetupData,
} from "../reducers/game-reducer";

const STORAGE_KEY = "karakas_active_game";

type GameContextType = {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  startNewGame: (format: string, players: PlayerSetupData[], playgroupId?: string | null) => void;
  endActiveGame: () => void;
  hasActiveGame: boolean;
  canUndo: boolean;
  canRedo: boolean;
};

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(
    gameReducer,
    createInitialState("commander", [{ name: "Player 1" }, { name: "Player 2" }])
  );
  const [hasActiveGame, setHasActiveGame] = React.useState(false);
  const isRestoredRef = useRef(false);

  // Restore saved game on mount
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as GameState;
          // Backfill colorIndex for games created before this field existed
          parsed.players = parsed.players.map((p, i) => ({
            ...p,
            colorIndex: p.colorIndex ?? i,
          }));
          dispatch({ type: "RESTORE_STATE", state: parsed });
          setHasActiveGame(true);
        }
      } catch {
        // Ignore restore errors
      }
      isRestoredRef.current = true;
    })();
  }, []);

  // Persist game state on every change (after initial restore)
  useEffect(() => {
    if (!isRestoredRef.current) return;
    if (hasActiveGame) {
      const toPersist: GameState = {
        ...state,
        history: state.history.slice(
          Math.max(0, state.historyIndex - 100),
          state.historyIndex + 1
        ),
        historyIndex: Math.min(state.historyIndex, 100),
      };
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist)).catch(() => {});
    }
  }, [state, hasActiveGame]);

  const startNewGame = useCallback(
    (format: string, players: PlayerSetupData[], playgroupId?: string | null) => {
      const initial = createInitialState(format, players, playgroupId);
      dispatch({ type: "RESTORE_STATE", state: initial });
      setHasActiveGame(true);
    },
    []
  );

  const endActiveGame = useCallback(() => {
    setHasActiveGame(false);
    AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
  }, []);

  const canUndo = state.historyIndex >= 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  return (
    <GameContext.Provider
      value={{ state, dispatch, startNewGame, endActiveGame, hasActiveGame, canUndo, canRedo }}
    >
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextType {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}
