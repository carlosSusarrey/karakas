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
  const { gamePlayerId, turn, type, description, cardName } = await request.json();

  const powerPlay = await db.powerPlay.create({
    data: {
      gameId: id,
      gamePlayerId,
      userId,
      turn,
      type,
      description,
      cardName,
    },
  });

  return NextResponse.json({ powerPlay }, { status: 201 });
}
