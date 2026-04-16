import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      username: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(request: NextRequest) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  const body = await request.json();

  if (body.username !== undefined) {
    if (body.username.length < 3 || body.username.length > 20) {
      return NextResponse.json({ error: "Username must be 3-20 characters." }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(body.username)) {
      return NextResponse.json({ error: "Username can only contain letters, numbers, underscores." }, { status: 400 });
    }
    const existing = await db.user.findUnique({ where: { username: body.username } });
    if (existing && existing.id !== userId) {
      return NextResponse.json({ error: "Username already taken." }, { status: 400 });
    }
  }

  const updated = await db.user.update({
    where: { id: userId },
    data: {
      ...(body.username !== undefined ? { username: body.username } : {}),
      ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
    },
    select: {
      id: true,
      email: true,
      username: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ user: updated });
}
