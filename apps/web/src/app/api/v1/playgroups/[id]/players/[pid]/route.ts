import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function PATCH(
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

  const body = await request.json();
  const updated = await db.playgroupPlayer.update({
    where: { id: pid },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.email !== undefined ? { email: body.email } : {}),
    },
  });

  return NextResponse.json({ player: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; pid: string }> }
) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  const { id, pid } = await params;

  const membership = await db.playgroupMember.findUnique({
    where: { playgroupId_userId: { playgroupId: id, userId } },
  });

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  await db.playgroupPlayer.delete({ where: { id: pid } });
  return NextResponse.json({ success: true });
}
