import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const deck = await db.deck.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      format: true,
      commander1: true,
      commander2: true,
      bracket: true,
      decklistUrl: true,
      isActive: true,
      userId: true,
    },
  });

  if (!deck || deck.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(deck);
}
