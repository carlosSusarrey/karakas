import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  const { searchParams } = new URL(request.url);
  const playgroupId = searchParams.get("playgroupId");
  const format = searchParams.get("format");
  const limit = parseInt(searchParams.get("limit") || "50");

  const games = await db.game.findMany({
    where: {
      // If filtering by playgroup, show all games in that playgroup (for stats)
      // Otherwise only show games the user participated in
      ...(playgroupId
        ? { playgroupId }
        : { players: { some: { userId } } }),
      ...(format ? { format } : {}),
    },
    include: {
      players: {
        include: {
          user: { select: { id: true, username: true } },
          playgroupPlayer: { select: { id: true, name: true } },
          deck: { select: { id: true, name: true, commander1: true } },
        },
      },
      playgroup: { select: { id: true, name: true } },
      _count: { select: { powerPlays: true } },
    },
    orderBy: { playedAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ games });
}

export async function POST(request: NextRequest) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  try {
    const body = await request.json();
    const { format, playgroupId, players } = body;

    if (!format || !players || players.length < 2) {
      return NextResponse.json(
        { error: "Format and at least 2 players are required." },
        { status: 400 }
      );
    }

    // Verify playgroup membership if specified
    if (playgroupId) {
      const membership = await db.playgroupMember.findUnique({
        where: { playgroupId_userId: { playgroupId, userId } },
      });
      if (!membership) {
        return NextResponse.json(
          { error: "Not a member of this playgroup" },
          { status: 403 }
        );
      }
    }

    const game = await db.game.create({
      data: {
        createdById: userId,
        playgroupId,
        format,
        players: {
          create: players.map((p: {
            userId?: string;
            playgroupPlayerId?: string;
            deckId?: string;
            playgroupPlayerDeckId?: string;
            guestName?: string;
            commanderUsed1?: string;
            commanderUsed2?: string;
            bracketUsed?: number;
          }) => ({
            userId: p.userId,
            playgroupPlayerId: p.playgroupPlayerId,
            deckId: p.deckId,
            playgroupPlayerDeckId: p.playgroupPlayerDeckId,
            guestName: p.guestName,
            commanderUsed1: p.commanderUsed1,
            commanderUsed2: p.commanderUsed2,
            bracketUsed: p.bracketUsed,
          })),
        },
      },
      include: { players: true },
    });

    return NextResponse.json({ game }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create game" },
      { status: 500 }
    );
  }
}
