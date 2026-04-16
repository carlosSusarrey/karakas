import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;
  const { winnerId, isDraw, totalTurns } = await request.json();

  const game = await db.game.findUnique({
    where: { id },
    include: { players: true },
  });

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  // Calculate placements from elimination order
  const eliminated = game.players
    .filter((p) => p.eliminatedTurn !== null)
    .sort((a, b) => (a.eliminatedTurn ?? 0) - (b.eliminatedTurn ?? 0));

  const surviving = game.players.filter((p) => p.eliminatedTurn === null);

  // Assign placements: eliminated players get descending placements
  // (first eliminated = last place)
  let placement = game.players.length;
  const updates: Promise<unknown>[] = [];

  for (const player of eliminated) {
    const isFirst = eliminated[0]?.id === player.id;
    updates.push(
      db.gamePlayer.update({
        where: { id: player.id },
        data: { placement, isFirstOut: isFirst },
      })
    );
    placement--;
  }

  // Surviving players
  if (isDraw) {
    for (const player of surviving) {
      updates.push(
        db.gamePlayer.update({
          where: { id: player.id },
          data: { placement: 1, isWinner: false },
        })
      );
    }
  } else {
    for (const player of surviving) {
      const isWinner = player.id === winnerId || player.userId === winnerId;
      updates.push(
        db.gamePlayer.update({
          where: { id: player.id },
          data: {
            placement: isWinner ? 1 : placement,
            isWinner,
          },
        })
      );
      if (!isWinner) placement--;
    }
  }

  // Update game with total turns
  updates.push(
    db.game.update({
      where: { id },
      data: { totalTurns: totalTurns ?? game.totalTurns },
    })
  );

  await Promise.all(updates);

  const updatedGame = await db.game.findUnique({
    where: { id },
    include: {
      players: {
        include: {
          user: { select: { id: true, username: true } },
          playgroupPlayer: { select: { id: true, name: true } },
        },
      },
    },
  });

  return NextResponse.json({ game: updatedGame });
}
