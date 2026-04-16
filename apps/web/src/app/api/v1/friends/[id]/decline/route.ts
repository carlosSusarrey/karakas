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

  const friendship = await db.friendship.findUnique({ where: { id } });
  if (!friendship || friendship.addresseeId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await db.friendship.update({
    where: { id },
    data: { status: "declined" },
  });

  return NextResponse.json({ friendship: updated });
}
