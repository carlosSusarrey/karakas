import type { CandidateDeck, PlayerIdentity } from "@karakas/shared";
import { db } from "@/lib/db";

const RECENT_GAMES = 200;

/**
 * Every deck that could show up in a game: members' decks and guest players'
 * decks for a playgroup (or just the user's own decks without one), with
 * owners and recent pilots for the matcher.
 */
export async function loadCandidates(
  playgroupId: string | null,
  userId: string,
): Promise<CandidateDeck[]> {
  const memberIds = playgroupId
    ? (await db.playgroupMember.findMany({ where: { playgroupId }, select: { userId: true } })).map(
        (m) => m.userId,
      )
    : [userId];

  const [decks, guestDecks] = await Promise.all([
    db.deck.findMany({
      where: { isActive: true, userId: { in: memberIds } },
      include: { user: { select: { id: true, username: true } } },
      orderBy: { createdAt: "asc" },
    }),
    playgroupId
      ? db.playgroupPlayerDeck.findMany({
          // Claimed decks are covered by the linked user's Deck
          where: { isActive: true, linkedDeckId: null, playgroupPlayer: { playgroupId } },
          include: { playgroupPlayer: { select: { id: true, name: true, linkedUserId: true } } },
          orderBy: { createdAt: "asc" },
        })
      : [],
  ]);

  const pilots = new Map<string, PlayerIdentity[]>();
  const recent = await db.gamePlayer.findMany({
    where: {
      OR: [
        { deckId: { in: decks.map((d) => d.id) } },
        { playgroupPlayerDeckId: { in: guestDecks.map((d) => d.id) } },
      ],
      ...(playgroupId ? { game: { playgroupId } } : {}),
    },
    select: { userId: true, playgroupPlayerId: true, deckId: true, playgroupPlayerDeckId: true },
    orderBy: { game: { playedAt: "desc" } },
    take: RECENT_GAMES,
  });
  for (const gp of recent) {
    const key = gp.deckId ? `deck:${gp.deckId}` : `playgroupPlayerDeck:${gp.playgroupPlayerDeckId}`;
    const list = pilots.get(key) ?? [];
    list.push({ userId: gp.userId ?? undefined, playgroupPlayerId: gp.playgroupPlayerId ?? undefined });
    pilots.set(key, list);
  }

  return [
    ...decks.map(
      (d): CandidateDeck => ({
        ref: { kind: "deck", id: d.id },
        name: d.name,
        format: d.format,
        commander1: d.commander1,
        commander2: d.commander2,
        bracket: d.bracket,
        owner: { userId: d.user.id, name: d.user.username },
        pilots: pilots.get(`deck:${d.id}`) ?? [],
      }),
    ),
    ...guestDecks.map(
      (d): CandidateDeck => ({
        ref: { kind: "playgroupPlayerDeck", id: d.id },
        name: d.name,
        format: d.format,
        commander1: d.commander1,
        commander2: d.commander2,
        bracket: d.bracket,
        owner: {
          playgroupPlayerId: d.playgroupPlayer.id,
          userId: d.playgroupPlayer.linkedUserId ?? undefined,
          name: d.playgroupPlayer.name,
        },
        pilots: pilots.get(`playgroupPlayerDeck:${d.id}`) ?? [],
      }),
    ),
  ];
}

/** Distinct commander names across the candidates, as hints for the model. */
export function knownCommanderNames(candidates: CandidateDeck[]): string[] {
  const names = new Set<string>();
  for (const d of candidates) {
    if (d.commander1) names.add(d.commander1);
    if (d.commander2) names.add(d.commander2);
  }
  return [...names];
}
