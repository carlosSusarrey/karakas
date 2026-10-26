import { NextRequest, NextResponse } from "next/server";
import { computePlacements } from "@karakas/shared";
import type {
  CompleteGameRequest,
  CompleteGameResponse,
  CompleteGameSeat,
  DeckKind,
} from "@karakas/shared";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

/**
 * Save a finished game in one request: creates any decks registered during
 * setup, the game, its players (with placements) and power plays atomically.
 */
export async function POST(request: NextRequest) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  let body: CompleteGameRequest;
  try {
    body = await request.json();
  } catch {
    return badRequest("Invalid JSON body");
  }

  const { format, playgroupId = null, seats, isDraw = false, winnerSeat = null } = body;

  if (!format || !Array.isArray(seats) || seats.length < 2) {
    return badRequest("Format and at least 2 players are required.");
  }
  if (new Set(seats.map((s) => s.seat)).size !== seats.length) {
    return badRequest("Seat numbers must be unique.");
  }
  if (!isDraw && winnerSeat !== null && !seats.some((s) => s.seat === winnerSeat)) {
    return badRequest("Winner must be one of the players.");
  }
  for (const s of seats) {
    // A playgroup player linked to an account carries both ids.
    const registered = !!(s.userId || s.playgroupPlayerId);
    if (registered === !!s.guestName?.trim()) {
      return badRequest(`Seat ${s.seat} needs a registered player or a guest name, not both.`);
    }
    if (s.deck && s.pendingNewDeck) {
      return badRequest(`Seat ${s.seat} cannot have both a deck and a new deck.`);
    }
    if (s.pendingNewDeck && !s.pendingNewDeck.commander1?.trim()) {
      return badRequest(`Seat ${s.seat}: a new deck needs a commander.`);
    }
    if (s.pendingNewDeck && s.guestName) {
      return badRequest(`Seat ${s.seat}: one-off guests cannot own decks.`);
    }
  }

  // Membership and identity checks
  if (playgroupId) {
    const members = await db.playgroupMember.findMany({
      where: { playgroupId },
      select: { userId: true },
    });
    const memberIds = new Set(members.map((m) => m.userId));
    if (!memberIds.has(userId)) {
      return NextResponse.json({ error: "Not a member of this playgroup" }, { status: 403 });
    }
    for (const s of seats) {
      if (s.userId && !s.playgroupPlayerId && !memberIds.has(s.userId)) {
        return badRequest(`Seat ${s.seat}: user is not a member of this playgroup.`);
      }
    }

    const guestIds = seats.map((s) => s.playgroupPlayerId).filter((id): id is string => !!id);
    if (guestIds.length > 0) {
      const guests = await db.playgroupPlayer.findMany({
        where: { id: { in: guestIds }, playgroupId },
        select: { id: true },
      });
      if (guests.length !== new Set(guestIds).size) {
        return badRequest("A player does not belong to this playgroup.");
      }
    }
  } else {
    for (const s of seats) {
      if (s.playgroupPlayerId) {
        return badRequest("Playgroup players require a playgroup.");
      }
      // Without a playgroup we only register new decks for the requester.
      if (s.pendingNewDeck && s.userId !== userId) {
        return badRequest(`Seat ${s.seat}: can only create decks for yourself outside a playgroup.`);
      }
    }
  }

  // Deck reference checks
  const deckIds = seats.filter((s) => s.deck?.kind === "deck").map((s) => s.deck!.id);
  const guestDeckIds = seats
    .filter((s) => s.deck?.kind === "playgroupPlayerDeck")
    .map((s) => s.deck!.id);

  const [decks, guestDecks] = await Promise.all([
    deckIds.length > 0
      ? db.deck.findMany({
          where: { id: { in: deckIds } },
          select: { id: true, commander1: true, commander2: true, bracket: true },
        })
      : [],
    guestDeckIds.length > 0
      ? db.playgroupPlayerDeck.findMany({
          where: { id: { in: guestDeckIds } },
          select: {
            id: true,
            commander1: true,
            commander2: true,
            bracket: true,
            playgroupPlayer: { select: { playgroupId: true } },
          },
        })
      : [],
  ]);
  const deckById = new Map(decks.map((d) => [d.id, d]));
  const guestDeckById = new Map(guestDecks.map((d) => [d.id, d]));

  for (const s of seats) {
    if (!s.deck) continue;
    if (s.deck.kind === "deck" && !deckById.has(s.deck.id)) {
      return badRequest(`Seat ${s.seat}: deck not found.`);
    }
    if (s.deck.kind === "playgroupPlayerDeck") {
      const gd = guestDeckById.get(s.deck.id);
      if (!gd || gd.playgroupPlayer.playgroupId !== playgroupId) {
        return badRequest(`Seat ${s.seat}: deck not found in this playgroup.`);
      }
    }
  }

  const placements = new Map(
    computePlacements(
      seats.map((s) => ({ seat: s.seat, eliminatedTurn: s.eliminatedTurn ?? null })),
      { winnerSeat, isDraw },
    ).map((p) => [p.seat, p]),
  );

  // Fill the commander snapshot from the deck when the client didn't send one
  function snapshot(s: CompleteGameSeat) {
    const deck =
      s.deck?.kind === "deck"
        ? deckById.get(s.deck.id)
        : s.deck
          ? guestDeckById.get(s.deck.id)
          : undefined;
    return {
      commanderUsed1: s.commanderUsed1 ?? s.pendingNewDeck?.commander1 ?? deck?.commander1 ?? null,
      commanderUsed2: s.commanderUsed2 ?? s.pendingNewDeck?.commander2 ?? deck?.commander2 ?? null,
      bracketUsed: s.bracketUsed ?? s.pendingNewDeck?.bracket ?? deck?.bracket ?? null,
    };
  }

  try {
    const result = await db.$transaction(async (tx) => {
      const createdDecks: CompleteGameResponse["createdDecks"] = [];
      const seatDeck = new Map<number, { kind: DeckKind; id: string }>();

      for (const s of seats) {
        if (s.deck) {
          seatDeck.set(s.seat, s.deck);
          continue;
        }
        const nd = s.pendingNewDeck;
        if (!nd) continue;
        const data = {
          name: nd.name?.trim() || nd.commander1.trim(),
          format,
          commander1: nd.commander1.trim(),
          commander2: nd.commander2?.trim() || null,
          bracket: nd.bracket ?? null,
        };
        // Creating a deck for another registered user is allowed when both are
        // in the same playgroup: the deck is scoped to that playgroup.
        const ref: { kind: DeckKind; id: string } = s.userId
          ? {
              kind: "deck",
              id: (await tx.deck.create({ data: { ...data, userId: s.userId, playgroupId } })).id,
            }
          : {
              kind: "playgroupPlayerDeck",
              id: (
                await tx.playgroupPlayerDeck.create({
                  data: { ...data, playgroupPlayerId: s.playgroupPlayerId! },
                })
              ).id,
            };
        seatDeck.set(s.seat, ref);
        createdDecks.push({ seat: s.seat, deck: ref });
      }

      const game = await tx.game.create({
        data: {
          createdById: userId,
          playgroupId,
          format,
          totalTurns: body.totalTurns ?? null,
          ...(body.playedAt ? { playedAt: new Date(body.playedAt) } : {}),
        },
      });

      const players: { id: string; seat: number; userId: string | null }[] = [];
      for (const s of seats) {
        const deck = seatDeck.get(s.seat);
        const p = placements.get(s.seat)!;
        const gp = await tx.gamePlayer.create({
          data: {
            gameId: game.id,
            userId: s.userId ?? null,
            playgroupPlayerId: s.playgroupPlayerId ?? null,
            guestName: s.guestName?.trim() || null,
            deckId: deck?.kind === "deck" ? deck.id : null,
            playgroupPlayerDeckId: deck?.kind === "playgroupPlayerDeck" ? deck.id : null,
            ...snapshot(s),
            placement: p.placement,
            isWinner: p.isWinner,
            isFirstOut: p.isFirstOut,
            eliminatedTurn: s.eliminatedTurn ?? null,
          },
        });
        players.push({ id: gp.id, seat: s.seat, userId: gp.userId });
      }

      const bySeat = new Map(players.map((p) => [p.seat, p]));
      for (const pp of body.powerPlays ?? []) {
        const player = bySeat.get(pp.seat);
        if (!player || !pp.type || !pp.description) continue;
        await tx.powerPlay.create({
          data: {
            gameId: game.id,
            gamePlayerId: player.id,
            userId: player.userId,
            turn: pp.turn,
            type: pp.type,
            description: pp.description,
            cardName: pp.cardName ?? null,
          },
        });
      }

      return {
        game: { id: game.id, players: players.map(({ id, seat }) => ({ id, seat })) },
        createdDecks,
      };
    });

    return NextResponse.json(result satisfies CompleteGameResponse, { status: 201 });
  } catch (error) {
    console.error("Failed to complete game:", error);
    return NextResponse.json({ error: "Failed to save game" }, { status: 500 });
  }
}
