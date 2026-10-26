export type PlacementInput = {
  seat: number;
  eliminatedTurn: number | null;
};

export type PlacementResult = {
  seat: number;
  placement: number;
  isWinner: boolean;
  isFirstOut: boolean;
};

/**
 * Compute final placements for a finished game.
 *
 * - The winner gets 1st. Other survivors share the next place (or everyone
 *   still alive shares 1st on a draw).
 * - Eliminated players rank by elimination turn: later out = better place.
 *   Players eliminated on the same turn share a placement.
 * - Players eliminated on the earliest turn are flagged as first out.
 */
export function computePlacements(
  seats: PlacementInput[],
  { winnerSeat, isDraw }: { winnerSeat: number | null; isDraw: boolean },
): PlacementResult[] {
  const winner = isDraw ? null : seats.find((s) => s.seat === winnerSeat) ?? null;

  let survivors = seats.filter((s) => s !== winner && s.eliminatedTurn === null);
  let eliminated = seats.filter((s) => s !== winner && s.eliminatedTurn !== null);

  // A draw where everyone died at once: the last group out shares 1st.
  if (isDraw && survivors.length === 0 && eliminated.length > 0) {
    const lastTurn = Math.max(...eliminated.map((s) => s.eliminatedTurn!));
    survivors = eliminated.filter((s) => s.eliminatedTurn === lastTurn);
    eliminated = eliminated.filter((s) => s.eliminatedTurn !== lastTurn);
  }

  const results = new Map<number, PlacementResult>();
  let ranked = 0;

  if (winner) {
    results.set(winner.seat, { seat: winner.seat, placement: 1, isWinner: true, isFirstOut: false });
    ranked = 1;
  }

  if (survivors.length > 0) {
    const place = isDraw ? 1 : ranked + 1;
    for (const s of survivors) {
      results.set(s.seat, { seat: s.seat, placement: place, isWinner: false, isFirstOut: false });
    }
    ranked += survivors.length;
  }

  const turns = [...new Set(eliminated.map((s) => s.eliminatedTurn!))].sort((a, b) => b - a);
  const firstOutTurn = turns.length > 0 ? turns[turns.length - 1] : null;
  for (const turn of turns) {
    const group = eliminated.filter((s) => s.eliminatedTurn === turn);
    for (const s of group) {
      results.set(s.seat, {
        seat: s.seat,
        placement: ranked + 1,
        isWinner: false,
        isFirstOut: turn === firstOutTurn,
      });
    }
    ranked += group.length;
  }

  return seats.map((s) => results.get(s.seat)!);
}
