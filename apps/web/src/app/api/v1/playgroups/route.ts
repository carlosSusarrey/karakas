import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  const memberships = await db.playgroupMember.findMany({
    where: { userId },
    include: {
      playgroup: {
        include: {
          _count: { select: { members: true, players: true, games: true } },
        },
      },
    },
  });

  const playgroups = memberships.map((m) => ({
    id: m.playgroup.id,
    name: m.playgroup.name,
    description: m.playgroup.description,
    defaultFormat: m.playgroup.defaultFormat,
    role: m.role,
    memberCount: m.playgroup._count.members,
    playerCount: m.playgroup._count.players,
    gameCount: m.playgroup._count.games,
  }));

  return NextResponse.json({ playgroups });
}
