import { NextRequest, NextResponse } from "next/server";
import { searchCards } from "@/lib/scryfall";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");
  const commander = searchParams.get("commander") === "true";

  if (!query || query.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  const suggestions = await searchCards(query, commander);
  return NextResponse.json({ suggestions });
}
