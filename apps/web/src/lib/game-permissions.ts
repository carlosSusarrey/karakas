/** A game can be changed by its creator or by any registered player in it. */
export function canModifyGame(
  game: { createdById: string; players: { userId: string | null }[] },
  userId: string,
): boolean {
  return game.createdById === userId || game.players.some((p) => p.userId === userId);
}
