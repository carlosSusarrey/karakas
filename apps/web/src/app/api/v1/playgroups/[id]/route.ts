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

  // Verify membership
  const membership = await db.playgroupMember.findUnique({
    where: { playgroupId_userId: { playgroupId: id, userId } },
  });

  if (!membership) {
    return NextResponse.json(
      { error: "Not a member of this playgroup" },
      { status: 403 }
    );
  }

  const playgroup = await db.playgroup.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, username: true, email: true, avatarUrl: true },
          },
        },
      },
      players: {
        include: {
          decks: { where: { isActive: true } },
          linkedUser: {
            select: { id: true, username: true },
          },
        },
      },
    },
  });

  if (!playgroup) {
    return NextResponse.json(
      { error: "Playgroup not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ playgroup });
}
