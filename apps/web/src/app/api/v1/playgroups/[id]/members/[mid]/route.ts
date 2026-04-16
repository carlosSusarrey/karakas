import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mid: string }> }
) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  const { id, mid } = await params;

  const playgroup = await db.playgroup.findUnique({ where: { id } });
  if (!playgroup || playgroup.ownerId !== userId) {
    return NextResponse.json({ error: "Only the owner can change roles" }, { status: 403 });
  }

  const { role } = await request.json();
  if (!["admin", "member"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const updated = await db.playgroupMember.update({
    where: { id: mid },
    data: { role },
  });

  return NextResponse.json({ member: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; mid: string }> }
) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  const { id, mid } = await params;

  const membership = await db.playgroupMember.findUnique({
    where: { playgroupId_userId: { playgroupId: id, userId } },
  });

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  // Don't allow removing the owner
  const target = await db.playgroupMember.findUnique({ where: { id: mid } });
  if (target?.role === "owner") {
    return NextResponse.json({ error: "Cannot remove the owner" }, { status: 400 });
  }

  await db.playgroupMember.delete({ where: { id: mid } });
  return NextResponse.json({ success: true });
}
