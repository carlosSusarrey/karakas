import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  const where: Record<string, unknown> = { userId, isActive: true };
  if (format) where.format = format;

  const decks = await db.deck.findMany({
    where,
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ decks });
}

export async function POST(request: NextRequest) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  try {
    const body = await request.json();
    const { name, format, commander1, commander2, bracket, decklistUrl, playgroupId } = body;

    if (!name || !format) {
      return NextResponse.json(
        { error: "Name and format are required." },
        { status: 400 }
      );
    }

    const deck = await db.deck.create({
      data: {
        userId,
        name,
        format,
        commander1: commander1 || null,
        commander2: commander2 || null,
        bracket: bracket || null,
        decklistUrl: decklistUrl || null,
        playgroupId: playgroupId || null,
      },
    });

    return NextResponse.json({ deck }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create deck" },
      { status: 500 }
    );
  }
}
