import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  const { identifier } = await request.json();
  if (!identifier?.trim()) {
    return NextResponse.json({ error: "Username or email is required." }, { status: 400 });
  }

  const target = await db.user.findFirst({
    where: {
      OR: [{ email: identifier.trim() }, { username: identifier.trim() }],
    },
  });

  if (!target) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (target.id === userId) {
    return NextResponse.json({ error: "Cannot friend yourself." }, { status: 400 });
  }

  // Check for existing friendship
  const existing = await db.friendship.findFirst({
    where: {
      OR: [
        { requesterId: userId, addresseeId: target.id },
        { requesterId: target.id, addresseeId: userId },
      ],
    },
  });

  if (existing) {
    return NextResponse.json({ error: "Friend request already exists." }, { status: 400 });
  }

  const friendship = await db.friendship.create({
    data: { requesterId: userId, addresseeId: target.id },
  });

  return NextResponse.json({ friendship }, { status: 201 });
}
