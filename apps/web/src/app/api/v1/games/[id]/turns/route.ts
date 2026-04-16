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
  const { totalTurns } = await request.json();

  const game = await db.game.update({
    where: { id },
    data: { totalTurns },
  });

  return NextResponse.json({ game });
}
