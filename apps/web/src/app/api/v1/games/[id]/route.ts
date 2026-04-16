import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;

  const game = await db.game.findUnique({
    where: { id },
    include: {
      players: {
        include: {
          user: { select: { id: true, username: true, avatarUrl: true } },
          playgroupPlayer: { select: { id: true, name: true } },
          deck: { select: { id: true, name: true, commander1: true, commander2: true } },
          playgroupPlayerDeck: { select: { id: true, name: true, commander1: true, commander2: true } },
        },
      },
      powerPlays: { orderBy: { turn: "asc" } },
      playgroup: { select: { id: true, name: true } },
      createdBy: { select: { id: true, username: true } },
    },
  });

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  return NextResponse.json({ game });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;
  const body = await request.json();

  const game = await db.game.findUnique({ where: { id } });
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  const updated = await db.game.update({
    where: { id },
    data: {
      ...(body.totalTurns !== undefined ? { totalTurns: body.totalTurns } : {}),
      ...(body.notes !== undefined ? { notes: body.notes } : {}),
      ...(body.format ? { format: body.format } : {}),
    },
  });

  return NextResponse.json({ game: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;

  const game = await db.game.findUnique({ where: { id } });
  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  if (game.createdById !== userId) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await db.game.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
