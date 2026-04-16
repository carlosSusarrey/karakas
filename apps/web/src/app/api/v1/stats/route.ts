import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  const { searchParams } = new URL(request.url);
  const playgroupId = searchParams.get("playgroupId");
  const format = searchParams.get("format");

  const where: Record<string, unknown> = { userId };

  const gamePlayers = await db.gamePlayer.findMany({
    where: {
      userId,
      game: {
        ...(playgroupId ? { playgroupId } : {}),
        ...(format ? { format } : {}),
      },
    },
    include: {
      game: { select: { format: true, playedAt: true } },
      deck: { select: { name: true, commander1: true } },
    },
  });

  const totalGames = gamePlayers.length;
  const wins = gamePlayers.filter((gp) => gp.isWinner).length;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

  // Games by format
  const formatCounts: Record<string, number> = {};
  for (const gp of gamePlayers) {
    const fmt = gp.game.format;
    formatCounts[fmt] = (formatCounts[fmt] || 0) + 1;
  }

  // Top decks by win rate
  const deckStats: Record<string, { name: string; commander1: string | null; games: number; wins: number }> = {};
  for (const gp of gamePlayers) {
    if (!gp.deck) continue;
    if (!deckStats[gp.deck.name]) {
      deckStats[gp.deck.name] = {
        name: gp.deck.name,
        commander1: gp.deck.commander1,
        games: 0,
        wins: 0,
      };
    }
    deckStats[gp.deck.name].games++;
    if (gp.isWinner) deckStats[gp.deck.name].wins++;
  }

  const topDecks = Object.values(deckStats)
    .filter((d) => d.games >= 2)
    .sort((a, b) => b.wins / b.games - a.wins / a.games)
    .slice(0, 5)
    .map((d) => ({
      ...d,
      winRate: Math.round((d.wins / d.games) * 100),
    }));

  // Top commanders by win rate
  const cmdStats: Record<string, { name: string; games: number; wins: number }> = {};
  for (const gp of gamePlayers) {
    const cmd = gp.commanderUsed1 || gp.deck?.commander1;
    if (!cmd) continue;
    if (!cmdStats[cmd]) {
      cmdStats[cmd] = { name: cmd, games: 0, wins: 0 };
    }
    cmdStats[cmd].games++;
    if (gp.isWinner) cmdStats[cmd].wins++;
  }

  const topCommanders = Object.values(cmdStats)
    .filter((c) => c.games >= 2)
    .sort((a, b) => b.wins / b.games - a.wins / a.games)
    .slice(0, 5)
    .map((c) => ({
      ...c,
      winRate: Math.round((c.wins / c.games) * 100),
    }));

  return NextResponse.json({
    totalGames,
    wins,
    winRate,
    formatCounts,
    topDecks,
    topCommanders,
  });
}
