import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FORMAT_LABELS, type MtgFormat } from "@/types/mtg";
import { Header } from "@/components/header";

export default async function FriendProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id: friendId } = await params;

  // Check if they are actually friends
  const friendship = await db.friendship.findFirst({
    where: {
      status: "accepted",
      OR: [
        { requesterId: user.id, addresseeId: friendId },
        { requesterId: friendId, addresseeId: user.id },
      ],
    },
  });

  if (!friendship) {
    notFound();
  }

  // Get friend's profile
  const friend = await db.user.findUnique({
    where: { id: friendId },
    select: {
      id: true,
      username: true,
      avatarUrl: true,
      createdAt: true,
    },
  });

  if (!friend) {
    notFound();
  }

  // Get friend's game stats
  const games = await db.game.findMany({
    where: {
      players: {
        some: {
          OR: [
            { userId: friend.id },
            {
              playgroupPlayer: {
                linkedUserId: friend.id,
              },
            },
          ],
        },
      },
      // Only completed games
      OR: [
        { players: { some: { isWinner: true } } },
        { players: { every: { placement: { not: null } } } },
      ],
    },
    include: {
      players: {
        include: {
          user: { select: { id: true, username: true } },
          playgroupPlayer: { select: { id: true, name: true, linkedUserId: true } },
          deck: { select: { id: true, name: true, commander1: true } },
        },
      },
    },
    orderBy: { playedAt: "desc" },
  });

  // Calculate stats
  let wins = 0;
  let firstOuts = 0;
  let totalTurns = 0;
  let gamesWithTurns = 0;

  // Track format stats
  const formatStats: Record<string, { games: number; wins: number }> = {};

  // Track commander stats
  const commanderStats: Record<string, { games: number; wins: number }> = {};

  // Track head-to-head with current user
  let headToHeadGames = 0;
  let headToHeadWins = 0;

  for (const game of games) {
    const friendPlayer = game.players.find(
      (p) =>
        p.userId === friend.id ||
        p.playgroupPlayer?.linkedUserId === friend.id
    );

    if (!friendPlayer) continue;

    if (friendPlayer.isWinner) {
      wins++;
    }

    if (friendPlayer.isFirstOut) {
      firstOuts++;
    }

    if (game.totalTurns && game.totalTurns > 0) {
      totalTurns += game.totalTurns;
      gamesWithTurns++;
    }

    // Format stats
    const format = game.format;
    if (!formatStats[format]) {
      formatStats[format] = { games: 0, wins: 0 };
    }
    formatStats[format].games++;
    if (friendPlayer.isWinner) {
      formatStats[format].wins++;
    }

    // Commander stats
    const commander = friendPlayer.commanderUsed1 || friendPlayer.deck?.commander1;
    if (commander) {
      if (!commanderStats[commander]) {
        commanderStats[commander] = { games: 0, wins: 0 };
      }
      commanderStats[commander].games++;
      if (friendPlayer.isWinner) {
        commanderStats[commander].wins++;
      }
    }

    // Head-to-head
    const userInGame = game.players.some(
      (p) =>
        p.userId === user.id ||
        p.playgroupPlayer?.linkedUserId === user.id
    );
    if (userInGame) {
      headToHeadGames++;
      if (friendPlayer.isWinner) {
        headToHeadWins++;
      }
    }
  }

  const totalGames = games.length;
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const firstOutRate = totalGames > 0 ? Math.round((firstOuts / totalGames) * 100) : 0;
  const avgTurns = gamesWithTurns > 0 ? Math.round(totalTurns / gamesWithTurns) : 0;

  // Sort format stats by games
  const formatBreakdown = Object.entries(formatStats)
    .map(([format, stats]) => ({
      format,
      ...stats,
      winRate: stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0,
    }))
    .sort((a, b) => b.games - a.games);

  // Sort commander stats by games
  const topCommanders = Object.entries(commanderStats)
    .map(([name, stats]) => ({
      name,
      ...stats,
      winRate: stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0,
    }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 5);

  return (
    <div className="min-h-screen flex flex-col">
      <Header username={user.username} activeTab="friends" />

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Back link */}
          <Link
            href="/friends"
            className="text-zinc-400 hover:text-zinc-300 text-sm"
          >
            ← Back to Friends
          </Link>

          {/* Profile Header */}
          <div className="mt-6 mb-8 flex items-center gap-6">
            <div className="w-20 h-20 bg-zinc-700 rounded-full flex items-center justify-center text-3xl">
              {friend.avatarUrl ? (
                <img
                  src={friend.avatarUrl}
                  alt={friend.username}
                  className="w-20 h-20 rounded-full"
                />
              ) : (
                friend.username[0].toUpperCase()
              )}
            </div>
            <div>
              <h1 className="text-3xl font-bold">{friend.username}</h1>
              <p className="text-zinc-400 mt-1">
                Member since {friend.createdAt.toLocaleDateString()}
              </p>
            </div>
          </div>

          {totalGames === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-semibold mb-2">No games yet</h3>
              <p className="text-zinc-400">
                {friend.username} hasn&apos;t logged any games yet.
              </p>
            </div>
          ) : (
            <>
              {/* Overview Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="text-zinc-400 text-sm mb-1">Total Games</div>
                  <div className="text-3xl font-bold">{totalGames}</div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="text-zinc-400 text-sm mb-1">Win Rate</div>
                  <div className="text-3xl font-bold text-amber-500">{winRate}%</div>
                  <div className="text-zinc-500 text-sm">{wins} wins</div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="text-zinc-400 text-sm mb-1">First Out Rate</div>
                  <div className="text-3xl font-bold text-red-400">{firstOutRate}%</div>
                  <div className="text-zinc-500 text-sm">{firstOuts} times</div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="text-zinc-400 text-sm mb-1">Avg. Game Length</div>
                  <div className="text-3xl font-bold">{avgTurns}</div>
                  <div className="text-zinc-500 text-sm">turns</div>
                </div>
              </div>

              {/* Head-to-Head */}
              {headToHeadGames > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
                  <h2 className="text-lg font-semibold mb-4">Head-to-Head vs You</h2>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold">{headToHeadGames}</div>
                      <div className="text-zinc-500 text-sm">Games Together</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-amber-500">
                        {headToHeadGames > 0
                          ? Math.round((headToHeadWins / headToHeadGames) * 100)
                          : 0}%
                      </div>
                      <div className="text-zinc-500 text-sm">
                        {friend.username}&apos;s Win Rate vs You
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-green-500">
                        {headToHeadGames > 0
                          ? Math.round(
                              ((headToHeadGames - headToHeadWins) / headToHeadGames) * 100
                            )
                          : 0}%
                      </div>
                      <div className="text-zinc-500 text-sm">Your Win Rate vs Them</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-6">
                {/* Format Breakdown */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h2 className="text-lg font-semibold mb-4">Format Breakdown</h2>
                  {formatBreakdown.length === 0 ? (
                    <p className="text-zinc-500">No format data</p>
                  ) : (
                    <div className="space-y-3">
                      {formatBreakdown.map((item) => (
                        <div key={item.format} className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">
                              {FORMAT_LABELS[item.format as MtgFormat] || item.format}
                            </div>
                            <div className="text-zinc-500 text-sm">
                              {item.games} games, {item.wins} wins
                            </div>
                          </div>
                          <div className="text-amber-500 font-medium">{item.winRate}%</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Top Commanders */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h2 className="text-lg font-semibold mb-4">Top Commanders</h2>
                  {topCommanders.length === 0 ? (
                    <p className="text-zinc-500">No commander data</p>
                  ) : (
                    <div className="space-y-3">
                      {topCommanders.map((item) => (
                        <div key={item.name} className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-zinc-500 text-sm">
                              {item.games} games, {item.wins} wins
                            </div>
                          </div>
                          <div className="text-amber-500 font-medium">{item.winRate}%</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
