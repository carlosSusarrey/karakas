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
  const { gamePlayerId } = await request.json();

  const player = await db.gamePlayer.update({
    where: { id: gamePlayerId, gameId: id },
    data: { eliminatedTurn: null, isFirstOut: false },
  });

  return NextResponse.json({ player });
}
