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
