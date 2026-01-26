import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FORMAT_LABELS, POWER_PLAY_LABELS, type MtgFormat, type PowerPlayType } from "@/types/mtg";
import { Header } from "@/components/header";

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{ playgroup?: string; format?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { playgroup: playgroupId, format: formatFilter } = await searchParams;

  // Get user's playgroups
  const userPlaygroups = await db.playgroupMember.findMany({
    where: { userId: user.id },
    include: {
      playgroup: {
        select: { id: true, name: true },
      },
    },
    orderBy: { playgroup: { name: "asc" } },
  });

  // Build game filter conditions
  const gameWhereClause = {
    players: {
      some: {
        OR: [
          { userId: user.id },
          {
            playgroupPlayer: {
              linkedUserId: user.id,
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
    ...(playgroupId && { playgroupId }),
    ...(formatFilter && { format: formatFilter }),
  };

  // Get all games matching the filter
  const games = await db.game.findMany({
    where: gameWhereClause,
    include: {
      players: {
        include: {
          user: { select: { id: true, username: true } },
          playgroupPlayer: { select: { id: true, name: true, linkedUserId: true } },
          deck: { select: { id: true, name: true, commander1: true } },
        },
      },
      powerPlays: {
        select: { id: true, type: true, gamePlayerId: true },
      },
    },
    orderBy: { playedAt: "desc" },
  });

  // Calculate personal stats
  const totalGames = games.length;
  let wins = 0;
  let firstOuts = 0;
  let totalTurns = 0;
  let gamesWithTurns = 0;

  // Track deck performance
  const deckStats: Record<string, { name: string; commander: string | null; games: number; wins: number }> = {};

  // Track commander performance
  const commanderStats: Record<string, { games: number; wins: number }> = {};

  // Track format breakdown
  const formatStats: Record<string, { games: number; wins: number }> = {};

  // Track opponents
  const opponentStats: Record<string, { name: string; games: number; winsAgainst: number }> = {};

  // Track power play stats
  const powerPlayStats: Record<string, { count: number; gamesWithWin: number; totalGames: number }> = {};
  let totalPowerPlays = 0;
  let gamesWithPowerPlays = 0;

  // Track power play correlation with wins
  let userPowerPlayGames = 0;
  let userPowerPlayWins = 0;
  let gamesWithAnyPowerPlays = 0;
  let winsInGamesWithPowerPlays = 0;
  let winsInGamesWithoutPowerPlays = 0;
  let gamesWithoutPowerPlays = 0;

  for (const game of games) {
    // Find the user's player record in this game
    const userPlayer = game.players.find(
      (p) =>
        p.userId === user.id ||
        (p.playgroupPlayer?.linkedUserId === user.id)
    );

    if (!userPlayer) continue;

    // Track wins
    if (userPlayer.isWinner) {
      wins++;
    }

    // Track first outs
    if (userPlayer.isFirstOut) {
      firstOuts++;
    }

    // Track turns
    if (game.totalTurns && game.totalTurns > 0) {
      totalTurns += game.totalTurns;
      gamesWithTurns++;
    }

    // Track deck stats
    if (userPlayer.deck) {
      const deckId = userPlayer.deck.id;
      if (!deckStats[deckId]) {
        deckStats[deckId] = {
          name: userPlayer.deck.name,
          commander: userPlayer.deck.commander1,
          games: 0,
          wins: 0,
        };
      }
      deckStats[deckId].games++;
      if (userPlayer.isWinner) {
        deckStats[deckId].wins++;
      }
    }

    // Track commander stats
    const commander = userPlayer.commanderUsed1 || userPlayer.deck?.commander1;
    if (commander) {
      if (!commanderStats[commander]) {
        commanderStats[commander] = { games: 0, wins: 0 };
      }
      commanderStats[commander].games++;
      if (userPlayer.isWinner) {
        commanderStats[commander].wins++;
      }
    }

    // Track format stats
    const format = game.format;
    if (!formatStats[format]) {
      formatStats[format] = { games: 0, wins: 0 };
    }
    formatStats[format].games++;
    if (userPlayer.isWinner) {
      formatStats[format].wins++;
    }

    // Track opponent stats
    for (const player of game.players) {
      if (player.id === userPlayer.id) continue;

      const opponentId = player.userId || player.playgroupPlayer?.id || player.guestName;
      if (!opponentId) continue;

      const opponentName =
        player.user?.username ||
        player.playgroupPlayer?.name ||
        player.guestName ||
        "Unknown";

      if (!opponentStats[opponentId]) {
        opponentStats[opponentId] = { name: opponentName, games: 0, winsAgainst: 0 };
      }
      opponentStats[opponentId].games++;
      if (userPlayer.isWinner) {
        opponentStats[opponentId].winsAgainst++;
      }
    }

    // Track power play stats (all power plays in games the user participated in)
    const userPowerPlaysInGame = game.powerPlays.filter(
      (pp) => pp.gamePlayerId === userPlayer.id
    );
    const hasUserPowerPlays = userPowerPlaysInGame.length > 0;

    if (game.powerPlays.length > 0) {
      gamesWithPowerPlays++;
      gamesWithAnyPowerPlays++;
      if (userPlayer.isWinner) {
        winsInGamesWithPowerPlays++;
      }

      for (const powerPlay of game.powerPlays) {
        totalPowerPlays++;
        const type = powerPlay.type;
        if (!powerPlayStats[type]) {
          powerPlayStats[type] = { count: 0, gamesWithWin: 0, totalGames: 0 };
        }
        powerPlayStats[type].count++;
      }

      // Track per-type win correlation (when user made that type of power play)
      const userPowerPlayTypes = new Set(userPowerPlaysInGame.map((pp) => pp.type));
      for (const type of userPowerPlayTypes) {
        if (!powerPlayStats[type]) {
          powerPlayStats[type] = { count: 0, gamesWithWin: 0, totalGames: 0 };
        }
        powerPlayStats[type].totalGames++;
        if (userPlayer.isWinner) {
          powerPlayStats[type].gamesWithWin++;
        }
      }
    } else {
      gamesWithoutPowerPlays++;
      if (userPlayer.isWinner) {
        winsInGamesWithoutPowerPlays++;
      }
    }

    // Track user's power play games
    if (hasUserPowerPlays) {
      userPowerPlayGames++;
      if (userPlayer.isWinner) {
        userPowerPlayWins++;
      }
    }
  }

  // Calculate derived stats
  const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
  const firstOutRate = totalGames > 0 ? Math.round((firstOuts / totalGames) * 100) : 0;
  const avgTurns = gamesWithTurns > 0 ? Math.round(totalTurns / gamesWithTurns) : 0;

  // Sort deck stats by games played
  const topDecks = Object.entries(deckStats)
    .map(([id, stats]) => ({ id, ...stats, winRate: stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0 }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 5);

  // Sort commander stats by games played
  const topCommanders = Object.entries(commanderStats)
    .map(([name, stats]) => ({ name, ...stats, winRate: stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0 }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 5);

  // Sort format stats by games played
  const formatBreakdown = Object.entries(formatStats)
    .map(([format, stats]) => ({ format, ...stats, winRate: stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0 }))
    .sort((a, b) => b.games - a.games);

  // Sort opponents by games played
  const frequentOpponents = Object.entries(opponentStats)
    .map(([id, stats]) => ({ id, ...stats, winRate: stats.games > 0 ? Math.round((stats.winsAgainst / stats.games) * 100) : 0 }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 5);

  // Sort power play stats by count
  const topPowerPlays = Object.entries(powerPlayStats)
    .map(([type, stats]) => ({
      type,
      ...stats,
      winRate: stats.totalGames > 0 ? Math.round((stats.gamesWithWin / stats.totalGames) * 100) : null,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Calculate power play correlation stats
  const userPowerPlayWinRate = userPowerPlayGames > 0
    ? Math.round((userPowerPlayWins / userPowerPlayGames) * 100)
    : null;
  const winRateWithPowerPlays = gamesWithAnyPowerPlays > 0
    ? Math.round((winsInGamesWithPowerPlays / gamesWithAnyPowerPlays) * 100)
    : null;
  const winRateWithoutPowerPlays = gamesWithoutPowerPlays > 0
    ? Math.round((winsInGamesWithoutPowerPlays / gamesWithoutPowerPlays) * 100)
    : null;

  // Calculate power plays per game average
  const powerPlaysPerGame = totalGames > 0 ? (totalPowerPlays / totalGames).toFixed(1) : "0";

  // Get unique formats for filter
  const availableFormats = [...new Set(games.map((g) => g.format))].sort();

  return (
    <div className="min-h-screen flex flex-col">
      <Header username={user.username} activeTab="stats" />

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Statistics</h1>
            <p className="text-zinc-400 mt-1">Your game performance and trends</p>
          </div>

          {/* Filters */}
          <div className="mb-8 flex flex-wrap items-center gap-4">
            <div>
              <span className="text-zinc-400 text-sm mr-2">Playgroup:</span>
              <div className="inline-flex flex-wrap gap-2">
                <Link
                  href="/stats"
                  className={`text-sm px-3 py-1 rounded-full transition-colors ${
                    !playgroupId
                      ? "bg-amber-600 text-white"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  All
                </Link>
                {userPlaygroups.map(({ playgroup: pg }) => (
                  <Link
                    key={pg.id}
                    href={`/stats?playgroup=${pg.id}${formatFilter ? `&format=${formatFilter}` : ""}`}
                    className={`text-sm px-3 py-1 rounded-full transition-colors ${
                      playgroupId === pg.id
                        ? "bg-amber-600 text-white"
                        : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    }`}
                  >
                    {pg.name}
                  </Link>
                ))}
              </div>
            </div>

            {availableFormats.length > 1 && (
              <div>
                <span className="text-zinc-400 text-sm mr-2">Format:</span>
                <div className="inline-flex flex-wrap gap-2">
                  <Link
                    href={playgroupId ? `/stats?playgroup=${playgroupId}` : "/stats"}
                    className={`text-sm px-3 py-1 rounded-full transition-colors ${
                      !formatFilter
                        ? "bg-amber-600 text-white"
                        : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    }`}
                  >
                    All
                  </Link>
                  {availableFormats.map((format) => (
                    <Link
                      key={format}
                      href={`/stats?${playgroupId ? `playgroup=${playgroupId}&` : ""}format=${format}`}
                      className={`text-sm px-3 py-1 rounded-full transition-colors ${
                        formatFilter === format
                          ? "bg-amber-600 text-white"
                          : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                      }`}
                    >
                      {FORMAT_LABELS[format as MtgFormat] || format}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {totalGames === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-semibold mb-2">No games yet</h3>
              <p className="text-zinc-400 mb-4">
                Start logging games to see your statistics here.
              </p>
              <Link
                href="/playgroups"
                className="inline-block bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Go to Playgroups
              </Link>
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

              <div className="grid md:grid-cols-2 gap-6 mb-8">
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

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* Top Decks */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h2 className="text-lg font-semibold mb-4">Top Decks</h2>
                  {topDecks.length === 0 ? (
                    <p className="text-zinc-500">No deck data</p>
                  ) : (
                    <div className="space-y-3">
                      {topDecks.map((deck) => (
                        <Link
                          key={deck.id}
                          href={`/decks/${deck.id}`}
                          className="block hover:bg-zinc-800/50 -mx-2 px-2 py-1 rounded transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-medium">{deck.name}</div>
                              <div className="text-zinc-500 text-sm">
                                {deck.commander && `${deck.commander} - `}
                                {deck.games} games, {deck.wins} wins
                              </div>
                            </div>
                            <div className="text-amber-500 font-medium">{deck.winRate}%</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>

                {/* Frequent Opponents */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h2 className="text-lg font-semibold mb-4">Frequent Opponents</h2>
                  {frequentOpponents.length === 0 ? (
                    <p className="text-zinc-500">No opponent data</p>
                  ) : (
                    <div className="space-y-3">
                      {frequentOpponents.map((opponent) => (
                        <div key={opponent.id} className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{opponent.name}</div>
                            <div className="text-zinc-500 text-sm">
                              {opponent.games} games together
                            </div>
                          </div>
                          <div className="text-amber-500 font-medium">
                            {opponent.winRate}% vs
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Power Play Stats */}
              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h2 className="text-lg font-semibold mb-4">Power Play Stats</h2>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-zinc-400 text-sm">Total Power Plays</div>
                      <div className="text-2xl font-bold">{totalPowerPlays}</div>
                    </div>
                    <div>
                      <div className="text-zinc-400 text-sm">Per Game Avg</div>
                      <div className="text-2xl font-bold text-amber-500">{powerPlaysPerGame}</div>
                    </div>
                  </div>
                  {topPowerPlays.length === 0 ? (
                    <p className="text-zinc-500">No power plays recorded</p>
                  ) : (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-zinc-400">Most Common Types</h3>
                      {topPowerPlays.map((pp) => (
                        <div key={pp.type} className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">
                              {POWER_PLAY_LABELS[pp.type as PowerPlayType] || pp.type}
                            </div>
                            <div className="text-zinc-500 text-sm">
                              {pp.count} {pp.count === 1 ? "time" : "times"}
                            </div>
                          </div>
                          {pp.winRate !== null && pp.totalGames >= 2 && (
                            <div className="text-amber-500 font-medium">{pp.winRate}% WR</div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Games with Power Plays */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h2 className="text-lg font-semibold mb-4">Power Play Coverage</h2>
                  <div className="text-center py-4">
                    <div className="text-4xl font-bold text-amber-500 mb-2">
                      {totalGames > 0 ? Math.round((gamesWithPowerPlays / totalGames) * 100) : 0}%
                    </div>
                    <div className="text-zinc-400">of games have recorded power plays</div>
                    <div className="text-zinc-500 text-sm mt-2">
                      {gamesWithPowerPlays} of {totalGames} games
                    </div>
                  </div>
                </div>
              </div>

              {/* Power Play Win Correlation */}
              {gamesWithPowerPlays > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h2 className="text-lg font-semibold mb-4">Power Play & Win Correlation</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 bg-zinc-800/50 rounded-lg">
                      <div className="text-zinc-400 text-sm mb-1">Your Win Rate When Making Power Plays</div>
                      <div className="text-3xl font-bold text-amber-500">
                        {userPowerPlayWinRate !== null ? `${userPowerPlayWinRate}%` : "N/A"}
                      </div>
                      <div className="text-zinc-500 text-sm mt-1">
                        {userPowerPlayGames > 0 ? `${userPowerPlayWins}/${userPowerPlayGames} games` : "No data"}
                      </div>
                    </div>
                    <div className="text-center p-4 bg-zinc-800/50 rounded-lg">
                      <div className="text-zinc-400 text-sm mb-1">Win Rate in Games With Power Plays</div>
                      <div className="text-3xl font-bold">
                        {winRateWithPowerPlays !== null ? `${winRateWithPowerPlays}%` : "N/A"}
                      </div>
                      <div className="text-zinc-500 text-sm mt-1">
                        {gamesWithAnyPowerPlays > 0 ? `${winsInGamesWithPowerPlays}/${gamesWithAnyPowerPlays} games` : "No data"}
                      </div>
                    </div>
                    <div className="text-center p-4 bg-zinc-800/50 rounded-lg">
                      <div className="text-zinc-400 text-sm mb-1">Win Rate in Games Without Power Plays</div>
                      <div className="text-3xl font-bold">
                        {winRateWithoutPowerPlays !== null ? `${winRateWithoutPowerPlays}%` : "N/A"}
                      </div>
                      <div className="text-zinc-500 text-sm mt-1">
                        {gamesWithoutPowerPlays > 0 ? `${winsInGamesWithoutPowerPlays}/${gamesWithoutPowerPlays} games` : "No data"}
                      </div>
                    </div>
                  </div>
                  {userPowerPlayWinRate !== null && winRate > 0 && (
                    <div className="mt-4 text-center text-sm text-zinc-400">
                      {userPowerPlayWinRate > winRate ? (
                        <span>You win <span className="text-green-400 font-medium">{userPowerPlayWinRate - winRate}%</span> more often when making power plays</span>
                      ) : userPowerPlayWinRate < winRate ? (
                        <span>You win <span className="text-red-400 font-medium">{winRate - userPowerPlayWinRate}%</span> less often when making power plays</span>
                      ) : (
                        <span>Power plays don&apos;t seem to affect your win rate</span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
