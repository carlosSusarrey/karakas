import type { PlayerSetupData } from "../game/reducer";
import type { SeatProposal, SetupPlayer } from "../types/pod-setup";

/** Turn matched seats into the input the live game screen already takes. */
export function seatsToPlayerSetup(players: SetupPlayer[], seats: SeatProposal[]): PlayerSetupData[] {
  const seatByKey = new Map(seats.map((s) => [s.playerKey, s]));
  return players.map((player) => {
    const seat = seatByKey.get(player.key);
    const isGuest = !player.userId && !player.playgroupPlayerId;
    const [commanderUsed1, commanderUsed2] = seat?.commanders ?? [];
    return {
      name: player.name,
      userId: player.userId,
      playgroupPlayerId: player.playgroupPlayerId,
      guestName: isGuest ? player.name : undefined,
      deckId: seat?.deck?.kind === "deck" ? seat.deck.id : undefined,
      playgroupPlayerDeckId: seat?.deck?.kind === "playgroupPlayerDeck" ? seat.deck.id : undefined,
      deckOwnerName: seat?.deckOwnerName ?? undefined,
      pendingNewDeck: seat?.pendingNewDeck ?? undefined,
      commanderUsed1,
      commanderUsed2,
      bracketUsed: seat?.bracket ?? undefined,
    };
  });
}
