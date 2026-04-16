import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  const { id, pid } = await params;

  const membership = await db.playgroupMember.findUnique({
    where: { playgroupId_userId: { playgroupId: id, userId } },
  });

  if (!membership) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const player = await db.playgroupPlayer.findUnique({ where: { id: pid } });
  if (!player || player.playgroupId !== id) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  if (player.linkedUserId) {
    return NextResponse.json({ error: "Player already claimed" }, { status: 400 });
  }

  const updated = await db.playgroupPlayer.update({
    where: { id: pid },
    data: { linkedUserId: userId },
  });

  return NextResponse.json({ player: updated });
}
