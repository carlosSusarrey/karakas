import type { GameState, PlayerSetupData, PlayerState } from "./reducer";
import { toPlayerSetupData } from "./reducer";
import type { CompleteGameRequest, CompleteGameResponse, CompleteGameSeat } from "../types/api";

function toSeat(p: PlayerState, seat: number): CompleteGameSeat {
  const isGuest = !p.serverUserId && !p.serverPlaygroupPlayerId;
  const deck = p.serverDeckId
    ? { kind: "deck" as const, id: p.serverDeckId }
    : p.serverPlaygroupPlayerDeckId
      ? { kind: "playgroupPlayerDeck" as const, id: p.serverPlaygroupPlayerDeckId }
      : undefined;
  return {
    seat,
    userId: p.serverUserId || undefined,
    playgroupPlayerId: p.serverPlaygroupPlayerId || undefined,
    guestName: isGuest ? p.guestName || p.name : undefined,
    deck,
    // One-off guests can't own decks; new decks only apply when no deck is set.
    pendingNewDeck: !deck && !isGuest ? p.pendingNewDeck : undefined,
    commanderUsed1: p.commanderUsed1 || undefined,
    commanderUsed2: p.commanderUsed2 || undefined,
    bracketUsed: p.bracketUsed ?? undefined,
    eliminatedTurn: p.isEliminated ? p.eliminatedTurn : null,
  };
}

/** Build the single save request for a finished live game. Seat = player index. */
export function buildCompleteGameRequest(
  state: GameState,
  { winnerPlayerId, isDraw }: { winnerPlayerId: string | null; isDraw: boolean },
): CompleteGameRequest {
  const seatOf = new Map(state.players.map((p, i) => [p.id, i]));
  const winnerSeat = !isDraw && winnerPlayerId ? seatOf.get(winnerPlayerId) ?? null : null;
  return {
    format: state.format,
    playgroupId: state.playgroupId,
    totalTurns: state.currentTurn,
    playedAt: state.gameStartedAt,
    isDraw,
    winnerSeat,
    seats: state.players.map(toSeat),
    powerPlays: state.powerPlays
      .filter((pp) => seatOf.has(pp.gamePlayerId))
      .map((pp) => ({
        seat: seatOf.get(pp.gamePlayerId)!,
        turn: pp.turn,
        type: pp.type,
        description: pp.description,
        cardName: pp.cardName,
      })),
  };
}

/**
 * Player setups for a rematch: same seats, with any decks created by the save
 * swapped in for their pending placeholders.
 */
export function rematchSetup(
  state: GameState,
  createdDecks: CompleteGameResponse["createdDecks"] = [],
): PlayerSetupData[] {
  const created = new Map(createdDecks.map((c) => [c.seat, c.deck]));
  return state.players.map((p, seat) => {
    const setup = toPlayerSetupData(p);
    const deck = created.get(seat);
    if (!deck) return setup;
    return {
      ...setup,
      pendingNewDeck: undefined,
      deckId: deck.kind === "deck" ? deck.id : undefined,
      playgroupPlayerDeckId: deck.kind === "playgroupPlayerDeck" ? deck.id : undefined,
    };
  });
}

/** A setup in progress (e.g. a rematch) handed to the seat review screen. */
export type SetupDraft = {
  format: string;
  playgroupId: string | null;
  players: PlayerSetupData[];
  rematch?: boolean;
};
