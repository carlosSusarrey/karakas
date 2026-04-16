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

  const deck = await db.deck.findUnique({ where: { id } });
  if (!deck || deck.userId !== userId) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  return NextResponse.json({ deck });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;
  const body = await request.json();

  const deck = await db.deck.findUnique({ where: { id } });
  if (!deck || deck.userId !== userId) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  const updated = await db.deck.update({
    where: { id },
    data: {
      ...(body.name !== undefined ? { name: body.name } : {}),
      ...(body.format !== undefined ? { format: body.format } : {}),
      ...(body.commander1 !== undefined ? { commander1: body.commander1 } : {}),
      ...(body.commander2 !== undefined ? { commander2: body.commander2 } : {}),
      ...(body.bracket !== undefined ? { bracket: body.bracket } : {}),
      ...(body.decklistUrl !== undefined ? { decklistUrl: body.decklistUrl } : {}),
      ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
    },
  });

  return NextResponse.json({ deck: updated });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;

  const deck = await db.deck.findUnique({ where: { id } });
  if (!deck || deck.userId !== userId) {
    return NextResponse.json({ error: "Deck not found" }, { status: 404 });
  }

  await db.deck.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
