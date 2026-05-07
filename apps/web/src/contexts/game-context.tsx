"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
} from "react";
import {
  createInitialState,
  gameReducer,
  type GameAction,
  type GameState,
  type PlayerSetupData,
} from "@/lib/game-reducer";

const STORAGE_KEY = "karakas_active_game";

type GameContextType = {
  state: GameState;
  dispatch: Dispatch<GameAction>;
  startNewGame: (format: string, players: PlayerSetupData[], playgroupId?: string | null) => void;
  endActiveGame: () => void;
  hasActiveGame: boolean;
  canUndo: boolean;
  canRedo: boolean;
  hydrated: boolean;
};

const GameContext = createContext<GameContextType | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(
    gameReducer,
    createInitialState("commander", [{ name: "Player 1" }, { name: "Player 2" }]),
  );
  const [hasActiveGame, setHasActiveGame] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const isRestoredRef = useRef(false);

  useEffect(() => {
    try {
      const saved = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (saved) {
        const parsed = JSON.parse(saved) as GameState;
        if (!parsed.players?.length || !parsed.format) {
          window.localStorage.removeItem(STORAGE_KEY);
        } else {
          parsed.players = parsed.players.map((p, i) => ({
            ...p,
            colorIndex: p.colorIndex ?? i,
          }));
          dispatch({ type: "RESTORE_STATE", state: parsed });
          setHasActiveGame(true);
        }
      }
    } catch {
      // ignore restore errors
    }
    isRestoredRef.current = true;
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!isRestoredRef.current) return;
    if (typeof window === "undefined") return;
    if (hasActiveGame) {
      const toPersist: GameState = {
        ...state,
        history: state.history.slice(
          Math.max(0, state.historyIndex - 100),
          state.historyIndex + 1,
        ),
        historyIndex: Math.min(state.historyIndex, 100),
      };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist));
      } catch {
        // quota or serialization errors — ignore
      }
    }
  }, [state, hasActiveGame]);

  const startNewGame = useCallback(
    (format: string, players: PlayerSetupData[], playgroupId?: string | null) => {
      const initial = createInitialState(format, players, playgroupId);
      dispatch({ type: "RESTORE_STATE", state: initial });
      setHasActiveGame(true);
    },
    [],
  );

  const endActiveGame = useCallback(() => {
    setHasActiveGame(false);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // ignore
      }
    }
  }, []);

  const canUndo = state.historyIndex >= 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  return (
    <GameContext.Provider
      value={{ state, dispatch, startNewGame, endActiveGame, hasActiveGame, canUndo, canRedo, hydrated }}
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
