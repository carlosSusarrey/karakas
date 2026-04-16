import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  FORMAT_LABELS,
  POWER_PLAY_LABELS,
  type MtgFormat,
  type PowerPlayType,
} from "@/types/mtg";
import { Header } from "@/components/header";

export default async function PlaygroupStatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ format?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const { format: formatFilter } = await searchParams;

  const playgroup = await db.playgroup.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: { select: { id: true, username: true } },
        },
      },
      players: {
        select: { id: true, name: true, linkedUserId: true },
      },
    },
  });

  if (!playgroup) {
    notFound();
  }

  // Check if user is a member
  const membership = playgroup.members.find((m) => m.userId === user.id);
  if (!membership) {
    notFound();
  }

  // Build game filter conditions
  const gameWhereClause = {
    playgroupId: id,
    // Only completed games
    OR: [
      { players: { some: { isWinner: true } } },
      { players: { every: { placement: { not: null } } } },
    ],
    ...(formatFilter && { format: formatFilter }),
  };

  // Get all games for this playgroup
  const games = await db.game.findMany({
    where: gameWhereClause,
    include: {
      players: {
        include: {
          user: { select: { id: true, username: true } },
          playgroupPlayer: { select: { id: true, name: true, linkedUserId: true } },
          deck: { select: { id: true, name: true, commander1: true, commander2: true, bracket: true } },
        },
      },
      powerPlays: {
        select: { id: true, type: true, gamePlayerId: true },
      },
    },
    orderBy: { playedAt: "desc" },
  });

  // Calculate playgroup-wide stats
  const totalGames = games.length;
  let totalTurns = 0;
  let gamesWithTurns = 0;
  let totalPlayers = 0;

  // Track player performance
  const playerStats: Record<
    string,
    {
      name: string;
      type: "member" | "player";
      games: number;
      wins: number;
      firstOuts: number;
    }
  > = {};

  // Track commander performance (playgroup-wide)
  const commanderStats: Record<string, { games: number; wins: number }> = {};

  // Track deck performance
  const deckStats: Record<
    string,
    { name: string; commander: string | null; games: number; wins: number }
  > = {};

  // Track format breakdown
  const formatStats: Record<string, { games: number }> = {};

  // Track bracket distribution (for Commander)
  const bracketStats: Record<number, { games: number; wins: number }> = {};

  // Track power play stats
  const powerPlayStats: Record<string, { count: number }> = {};
  let totalPowerPlays = 0;
  let gamesWithPowerPlays = 0;

  // Track head-to-head records
  const headToHead: Record<
    string,
    Record<string, { wins: number; losses: number }>
  > = {};

  // Track game activity over time (last 12 months)
  const monthlyActivity: Record<string, number> = {};

  for (const game of games) {
    // Track turns
    if (game.totalTurns && game.totalTurns > 0) {
      totalTurns += game.totalTurns;
      gamesWithTurns++;
    }

    totalPlayers += game.players.length;

    // Track format stats
    const format = game.format;
    if (!formatStats[format]) {
      formatStats[format] = { games: 0 };
    }
    formatStats[format].games++;

    // Track monthly activity
    const monthKey = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
    }).format(game.playedAt);
    monthlyActivity[monthKey] = (monthlyActivity[monthKey] || 0) + 1;

    // Track power plays
    if (game.powerPlays.length > 0) {
      gamesWithPowerPlays++;
      for (const powerPlay of game.powerPlays) {
        totalPowerPlays++;
        const type = powerPlay.type;
        if (!powerPlayStats[type]) {
          powerPlayStats[type] = { count: 0 };
        }
        powerPlayStats[type].count++;
      }
    }

    // Find winner for head-to-head tracking
    const winner = game.players.find((p) => p.isWinner);
    const winnerId = winner
      ? winner.userId
        ? `user-${winner.userId}`
        : winner.playgroupPlayer
          ? `player-${winner.playgroupPlayer.id}`
          : null
      : null;

    for (const gamePlayer of game.players) {
      let playerId: string;
      let playerName: string;
      let playerType: "member" | "player";

      if (gamePlayer.user) {
        playerId = `user-${gamePlayer.user.id}`;
        playerName = gamePlayer.user.username;
        playerType = "member";
      } else if (gamePlayer.playgroupPlayer) {
        playerId = `player-${gamePlayer.playgroupPlayer.id}`;
        playerName = gamePlayer.playgroupPlayer.name;
        playerType = "player";
      } else {
        continue;
      }

      // Track player stats
      if (!playerStats[playerId]) {
        playerStats[playerId] = {
          name: playerName,
          type: playerType,
          games: 0,
          wins: 0,
          firstOuts: 0,
        };
      }
      playerStats[playerId].games++;
      if (gamePlayer.isWinner) {
        playerStats[playerId].wins++;
      }
      if (gamePlayer.isFirstOut) {
        playerStats[playerId].firstOuts++;
      }

      // Track head-to-head
      if (winnerId && winnerId !== playerId) {
        if (!headToHead[winnerId]) {
          headToHead[winnerId] = {};
        }
        if (!headToHead[winnerId][playerId]) {
          headToHead[winnerId][playerId] = { wins: 0, losses: 0 };
        }
        headToHead[winnerId][playerId].wins++;

        if (!headToHead[playerId]) {
          headToHead[playerId] = {};
        }
        if (!headToHead[playerId][winnerId]) {
          headToHead[playerId][winnerId] = { wins: 0, losses: 0 };
        }
        headToHead[playerId][winnerId].losses++;
      }

      // Track commander stats
      const commander = gamePlayer.commanderUsed1 || gamePlayer.deck?.commander1;
      if (commander) {
        if (!commanderStats[commander]) {
          commanderStats[commander] = { games: 0, wins: 0 };
        }
        commanderStats[commander].games++;
        if (gamePlayer.isWinner) {
          commanderStats[commander].wins++;
        }
      }

      // Track deck stats
      if (gamePlayer.deck) {
        const deckId = gamePlayer.deck.id;
        if (!deckStats[deckId]) {
          deckStats[deckId] = {
            name: gamePlayer.deck.name,
            commander: gamePlayer.deck.commander1,
            games: 0,
            wins: 0,
          };
        }
        deckStats[deckId].games++;
        if (gamePlayer.isWinner) {
          deckStats[deckId].wins++;
        }

        // Track bracket stats
        if (gamePlayer.deck.bracket) {
          const bracket = gamePlayer.deck.bracket;
          if (!bracketStats[bracket]) {
            bracketStats[bracket] = { games: 0, wins: 0 };
          }
          bracketStats[bracket].games++;
          if (gamePlayer.isWinner) {
            bracketStats[bracket].wins++;
          }
        }
      }
    }
  }

  // Calculate derived stats
  const avgTurns = gamesWithTurns > 0 ? Math.round(totalTurns / gamesWithTurns) : 0;
  const avgPlayersPerGame =
    totalGames > 0 ? (totalPlayers / totalGames).toFixed(1) : "0";

  // Create leaderboard sorted by wins, then win rate
  const leaderboard = Object.entries(playerStats)
    .map(([id, stats]) => ({
      id,
      ...stats,
      winRate: stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0,
      firstOutRate:
        stats.games > 0 ? Math.round((stats.firstOuts / stats.games) * 100) : 0,
    }))
    .filter((p) => p.games >= 1)
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.winRate - a.winRate;
    });

  // Top commanders
  const topCommanders = Object.entries(commanderStats)
    .map(([name, stats]) => ({
      name,
      ...stats,
      winRate: stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0,
    }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 10);

  // Top decks
  const topDecks = Object.entries(deckStats)
    .map(([id, stats]) => ({
      id,
      ...stats,
      winRate: stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0,
    }))
    .sort((a, b) => b.games - a.games)
    .slice(0, 10);

  // Format breakdown
  const formatBreakdown = Object.entries(formatStats)
    .map(([format, stats]) => ({ format, ...stats }))
    .sort((a, b) => b.games - a.games);

  // Bracket breakdown
  const bracketBreakdown = Object.entries(bracketStats)
    .map(([bracket, stats]) => ({
      bracket: parseInt(bracket),
      ...stats,
      winRate: stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0,
    }))
    .sort((a, b) => a.bracket - b.bracket);

  // Top power plays
  const topPowerPlays = Object.entries(powerPlayStats)
    .map(([type, stats]) => ({ type, ...stats }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Calculate most dominant rivalries (most games between two players)
  const rivalries: Array<{
    player1: string;
    player2: string;
    player1Wins: number;
    player2Wins: number;
    totalGames: number;
  }> = [];

  const processedPairs = new Set<string>();
  for (const [p1Id, opponents] of Object.entries(headToHead)) {
    for (const [p2Id, record] of Object.entries(opponents)) {
      const pairKey = [p1Id, p2Id].sort().join("-");
      if (processedPairs.has(pairKey)) continue;
      processedPairs.add(pairKey);

      const p1Name = playerStats[p1Id]?.name || "Unknown";
      const p2Name = playerStats[p2Id]?.name || "Unknown";
      const p1Wins = record.wins;
      const p2Wins = headToHead[p2Id]?.[p1Id]?.wins || 0;

      if (p1Wins + p2Wins >= 2) {
        rivalries.push({
          player1: p1Name,
          player2: p2Name,
          player1Wins: p1Wins,
          player2Wins: p2Wins,
          totalGames: p1Wins + p2Wins,
        });
      }
    }
  }
  rivalries.sort((a, b) => b.totalGames - a.totalGames);
  const topRivalries = rivalries.slice(0, 5);

  // Get unique formats for filter
  const allGamesForFormats = await db.game.findMany({
    where: { playgroupId: id },
    select: { format: true },
  });
  const availableFormats = [...new Set(allGamesForFormats.map((g) => g.format))].sort();

  // Calculate power plays per game average
  const powerPlaysPerGame =
    totalGames > 0 ? (totalPowerPlays / totalGames).toFixed(1) : "0";

  return (
    <div className="min-h-screen flex flex-col">
      <Header username={user.username} activeTab="playgroups" />

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <Link
            href={`/playgroups/${id}`}
            className="text-zinc-400 hover:text-zinc-300 text-sm"
          >
            ← Back to {playgroup.name}
          </Link>

          <div className="mt-4 mb-8">
            <h1 className="text-3xl font-bold">{playgroup.name} Stats</h1>
            <p className="text-zinc-400 mt-1">
              Playgroup performance and trends
            </p>
          </div>

          {/* Format Filter */}
          {availableFormats.length > 1 && (
            <div className="mb-8">
              <span className="text-zinc-400 text-sm mr-2">Format:</span>
              <div className="inline-flex flex-wrap gap-2">
                <Link
                  href={`/playgroups/${id}/stats`}
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
                    href={`/playgroups/${id}/stats?format=${format}`}
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

          {totalGames === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-semibold mb-2">No games yet</h3>
              <p className="text-zinc-400 mb-4">
                Start logging games to see playgroup statistics here.
              </p>
              <Link
                href={`/games/new?playgroup=${id}`}
                className="inline-block bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Start a Game
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
                  <div className="text-zinc-400 text-sm mb-1">Active Players</div>
                  <div className="text-3xl font-bold text-amber-500">
                    {leaderboard.length}
                  </div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="text-zinc-400 text-sm mb-1">
                    Avg. Players/Game
                  </div>
                  <div className="text-3xl font-bold">{avgPlayersPerGame}</div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="text-zinc-400 text-sm mb-1">Avg. Game Length</div>
                  <div className="text-3xl font-bold">{avgTurns}</div>
                  <div className="text-zinc-500 text-sm">turns</div>
                </div>
              </div>

              {/* Leaderboard */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
                <h2 className="text-lg font-semibold mb-4">Leaderboard</h2>
                {leaderboard.length === 0 ? (
                  <p className="text-zinc-500">No player data</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-zinc-800">
                          <th className="text-left text-zinc-400 text-sm font-medium px-2 py-2 w-10">
                            #
                          </th>
                          <th className="text-left text-zinc-400 text-sm font-medium px-2 py-2">
                            Player
                          </th>
                          <th className="text-center text-zinc-400 text-sm font-medium px-2 py-2">
                            Games
                          </th>
                          <th className="text-center text-zinc-400 text-sm font-medium px-2 py-2">
                            Wins
                          </th>
                          <th className="text-center text-zinc-400 text-sm font-medium px-2 py-2">
                            Win Rate
                          </th>
                          <th className="text-center text-zinc-400 text-sm font-medium px-2 py-2">
                            First Outs
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaderboard.slice(0, 10).map((player, index) => (
                          <tr
                            key={player.id}
                            className={`border-b border-zinc-800/50 ${
                              index === 0 ? "bg-amber-900/10" : ""
                            }`}
                          >
                            <td className="px-2 py-2">
                              <span
                                className={`font-bold ${
                                  index === 0
                                    ? "text-amber-500"
                                    : index === 1
                                      ? "text-zinc-300"
                                      : index === 2
                                        ? "text-amber-700"
                                        : "text-zinc-500"
                                }`}
                              >
                                {index + 1}
                              </span>
                            </td>
                            <td className="px-2 py-2">
                              <div className="flex items-center gap-2">
                                <span
                                  className={
                                    index === 0 ? "font-semibold text-amber-500" : ""
                                  }
                                >
                                  {player.name}
                                </span>
                                {player.type === "player" && (
                                  <span className="text-xs bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">
                                    Guest
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-2 py-2 text-center text-zinc-400">
                              {player.games}
                            </td>
                            <td className="px-2 py-2 text-center font-medium text-green-500">
                              {player.wins}
                            </td>
                            <td className="px-2 py-2 text-center text-amber-500">
                              {player.winRate}%
                            </td>
                            <td className="px-2 py-2 text-center text-red-400">
                              {player.firstOuts}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
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
                        <div
                          key={item.format}
                          className="flex items-center justify-between"
                        >
                          <div className="font-medium">
                            {FORMAT_LABELS[item.format as MtgFormat] || item.format}
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-zinc-400">
                              {item.games} {item.games === 1 ? "game" : "games"}
                            </span>
                            <span className="text-amber-500">
                              {totalGames > 0
                                ? Math.round((item.games / totalGames) * 100)
                                : 0}
                              %
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Bracket Distribution */}
                {bracketBreakdown.length > 0 && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-4">
                      Bracket Distribution
                    </h2>
                    <div className="space-y-3">
                      {bracketBreakdown.map((item) => (
                        <div
                          key={item.bracket}
                          className="flex items-center justify-between"
                        >
                          <div className="font-medium">Bracket {item.bracket}</div>
                          <div className="flex items-center gap-4">
                            <span className="text-zinc-400">
                              {item.games} {item.games === 1 ? "game" : "games"}
                            </span>
                            <span className="text-amber-500">{item.winRate}% WR</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* No bracket data - show placeholder */}
                {bracketBreakdown.length === 0 && (
                  <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-4">
                      Bracket Distribution
                    </h2>
                    <p className="text-zinc-500">No bracket data recorded</p>
                  </div>
                )}
              </div>

              {/* Top Commanders */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
                <h2 className="text-lg font-semibold mb-4">
                  Most Played Commanders
                </h2>
                {topCommanders.length === 0 ? (
                  <p className="text-zinc-500">No commander data</p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {topCommanders.map((item, index) => (
                      <div
                        key={item.name}
                        className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-bold text-lg w-6 ${
                              index === 0
                                ? "text-amber-500"
                                : index === 1
                                  ? "text-zinc-300"
                                  : index === 2
                                    ? "text-amber-700"
                                    : "text-zinc-500"
                            }`}
                          >
                            {index + 1}
                          </span>
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-zinc-500 text-sm">
                              {item.games} {item.games === 1 ? "game" : "games"},{" "}
                              {item.wins} {item.wins === 1 ? "win" : "wins"}
                            </div>
                          </div>
                        </div>
                        <div className="text-amber-500 font-medium">
                          {item.winRate}%
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Top Decks */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
                <h2 className="text-lg font-semibold mb-4">Most Played Decks</h2>
                {topDecks.length === 0 ? (
                  <p className="text-zinc-500">No deck data</p>
                ) : (
                  <div className="grid md:grid-cols-2 gap-4">
                    {topDecks.map((deck, index) => (
                      <Link
                        key={deck.id}
                        href={`/decks/${deck.id}`}
                        className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`font-bold text-lg w-6 ${
                              index === 0
                                ? "text-amber-500"
                                : index === 1
                                  ? "text-zinc-300"
                                  : index === 2
                                    ? "text-amber-700"
                                    : "text-zinc-500"
                            }`}
                          >
                            {index + 1}
                          </span>
                          <div>
                            <div className="font-medium">{deck.name}</div>
                            <div className="text-zinc-500 text-sm">
                              {deck.commander && `${deck.commander} · `}
                              {deck.games} {deck.games === 1 ? "game" : "games"},{" "}
                              {deck.wins} {deck.wins === 1 ? "win" : "wins"}
                            </div>
                          </div>
                        </div>
                        <div className="text-amber-500 font-medium">
                          {deck.winRate}%
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                {/* Power Play Stats */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h2 className="text-lg font-semibold mb-4">Power Play Stats</h2>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <div className="text-zinc-400 text-sm">Total Power Plays</div>
                      <div className="text-2xl font-bold">{totalPowerPlays}</div>
                    </div>
                    <div>
                      <div className="text-zinc-400 text-sm">Per Game Avg</div>
                      <div className="text-2xl font-bold text-amber-500">
                        {powerPlaysPerGame}
                      </div>
                    </div>
                  </div>
                  {topPowerPlays.length === 0 ? (
                    <p className="text-zinc-500">No power plays recorded</p>
                  ) : (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-zinc-400">
                        Most Common Types
                      </h3>
                      {topPowerPlays.map((pp) => (
                        <div
                          key={pp.type}
                          className="flex items-center justify-between"
                        >
                          <div className="font-medium">
                            {POWER_PLAY_LABELS[pp.type as PowerPlayType] || pp.type}
                          </div>
                          <div className="text-zinc-400">
                            {pp.count} {pp.count === 1 ? "time" : "times"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Power Play Coverage */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
                  <h2 className="text-lg font-semibold mb-4">
                    Power Play Coverage
                  </h2>
                  <div className="text-center py-4">
                    <div className="text-4xl font-bold text-amber-500 mb-2">
                      {totalGames > 0
                        ? Math.round((gamesWithPowerPlays / totalGames) * 100)
                        : 0}
                      %
                    </div>
                    <div className="text-zinc-400">
                      of games have recorded power plays
                    </div>
                    <div className="text-zinc-500 text-sm mt-2">
                      {gamesWithPowerPlays} of {totalGames} games
                    </div>
                  </div>
                </div>
              </div>

              {/* Rivalries */}
              {topRivalries.length > 0 && (
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
                  <h2 className="text-lg font-semibold mb-4">Top Rivalries</h2>
                  <div className="space-y-3">
                    {topRivalries.map((rivalry, index) => (
                      <div
                        key={`${rivalry.player1}-${rivalry.player2}`}
                        className="flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-zinc-500 font-medium">
                            #{index + 1}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={
                                rivalry.player1Wins > rivalry.player2Wins
                                  ? "text-green-400 font-medium"
                                  : ""
                              }
                            >
                              {rivalry.player1}
                            </span>
                            <span className="text-zinc-500">vs</span>
                            <span
                              className={
                                rivalry.player2Wins > rivalry.player1Wins
                                  ? "text-green-400 font-medium"
                                  : ""
                              }
                            >
                              {rivalry.player2}
                            </span>
                          </div>
                        </div>
                        <div className="text-zinc-400">
                          <span className="text-green-400">
                            {rivalry.player1Wins}
                          </span>
                          {" - "}
                          <span className="text-green-400">
                            {rivalry.player2Wins}
                          </span>
                          <span className="text-zinc-500 ml-2">
                            ({rivalry.totalGames}{" "}
                            {rivalry.totalGames === 1 ? "game" : "games"})
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
