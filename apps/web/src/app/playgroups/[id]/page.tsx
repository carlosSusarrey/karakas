import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FORMAT_LABELS, type MtgFormat } from "@/types/mtg";
import { Header } from "@/components/header";
import { CommanderImage } from "@/components/commander-image";

export default async function PlaygroupDashboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  const playgroup = await db.playgroup.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, username: true } },
      members: {
        include: {
          user: { select: { id: true, username: true, email: true } },
        },
        orderBy: { joinedAt: "asc" },
      },
      players: {
        include: {
          decks: {
            where: { isActive: true },
            orderBy: { updatedAt: "desc" },
          },
        },
        orderBy: { name: "asc" },
      },
      games: {
        include: {
          players: {
            include: {
              deck: true,
              user: { select: { username: true } },
              playgroupPlayer: true,
            },
          },
        },
        orderBy: { playedAt: "desc" },
        take: 5,
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

  // Fetch all decks from playgroup members (regardless of playgroupId)
  const memberUserIds = playgroup.members.map((m) => m.userId);
  const allMemberDecks = await db.deck.findMany({
    where: {
      userId: { in: memberUserIds },
      isActive: true,
    },
    include: {
      user: { select: { id: true, username: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const isOwner = playgroup.ownerId === user.id;
  const isAdmin = membership.role === "admin" || isOwner;

  // Get all games for leaderboard calculations
  const allGames = await db.game.findMany({
    where: { playgroupId: id },
    include: {
      players: {
        include: {
          user: { select: { id: true, username: true } },
          playgroupPlayer: { select: { id: true, name: true, linkedUserId: true } },
        },
      },
    },
  });

  // Calculate leaderboard stats
  const playerStats: Record<string, {
    name: string;
    type: "member" | "player";
    games: number;
    wins: number;
    firstOuts: number;
  }> = {};

  for (const game of allGames) {
    // Only count completed games (has a winner)
    if (!game.players.some(p => p.isWinner)) continue;

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
    }
  }

  // Create leaderboard sorted by wins, then win rate
  const leaderboard = Object.entries(playerStats)
    .map(([id, stats]) => ({
      id,
      ...stats,
      winRate: stats.games > 0 ? Math.round((stats.wins / stats.games) * 100) : 0,
    }))
    .filter(p => p.games >= 1) // Only show players with at least 1 game
    .sort((a, b) => {
      // Sort by wins first, then by win rate
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.winRate - a.winRate;
    })
    .slice(0, 10);

  // Type for games with included relations
  type GameWithPlayers = typeof playgroup.games[number];
  type GamePlayerWithRelations = GameWithPlayers["players"][number];

  function formatDate(date: Date) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
    }).format(date);
  }

  function getWinner(game: GameWithPlayers) {
    return game.players.find((p) => p.isWinner);
  }

  function getPlayerName(player: GamePlayerWithRelations) {
    if (player.user) {
      return player.user.username;
    }
    if (player.playgroupPlayer) {
      return player.playgroupPlayer.name;
    }
    return player.guestName || "Unknown";
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header username={user.username} activeTab="playgroups" />

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumb */}
          <Link
            href="/playgroups"
            className="text-zinc-400 hover:text-zinc-300 text-sm"
          >
            ← All Playgroups
          </Link>

          {/* Playgroup Header */}
          <div className="mt-4 mb-8 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold">{playgroup.name}</h1>
                {isOwner && (
                  <span className="text-xs bg-amber-900/50 text-amber-400 px-2 py-1 rounded">
                    Owner
                  </span>
                )}
                {!isOwner && isAdmin && (
                  <span className="text-xs bg-zinc-700 text-zinc-300 px-2 py-1 rounded">
                    Admin
                  </span>
                )}
              </div>
              {playgroup.description && (
                <p className="text-zinc-400 mt-2">{playgroup.description}</p>
              )}
              {playgroup.defaultFormat && (
                <p className="text-zinc-500 text-sm mt-1">
                  Default format: {FORMAT_LABELS[playgroup.defaultFormat as MtgFormat]}
                </p>
              )}
            </div>
            {isAdmin && (
              <Link
                href={`/playgroups/${id}/settings`}
                className="text-zinc-400 hover:text-zinc-100 transition-colors text-sm"
              >
                Settings
              </Link>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-3 mb-8">
            <Link
              href={`/games/new?playgroup=${id}`}
              className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Start Game
            </Link>
            <Link
              href={`/playgroups/${id}/stats`}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-4 py-2 rounded-lg transition-colors"
            >
              View Stats
            </Link>
            <Link
              href={`/playgroups/${id}/players`}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-4 py-2 rounded-lg transition-colors"
            >
              Manage Players
            </Link>
            <Link
              href={`/playgroups/${id}/members`}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-4 py-2 rounded-lg transition-colors"
            >
              Members
            </Link>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Members */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Members</h2>
                <Link
                  href={`/playgroups/${id}/members`}
                  className="text-amber-500 hover:text-amber-400 text-sm"
                >
                  View all
                </Link>
              </div>
              <div className="space-y-2">
                {playgroup.members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-zinc-300">{member.user.username}</span>
                    <span className="text-zinc-500 text-xs capitalize">
                      {member.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Playgroup Players (non-registered) */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Players</h2>
                <Link
                  href={`/playgroups/${id}/players`}
                  className="text-amber-500 hover:text-amber-400 text-sm"
                >
                  Manage
                </Link>
              </div>
              {playgroup.players.length === 0 ? (
                <p className="text-zinc-500 text-sm">
                  Add players who don&apos;t have accounts yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {playgroup.players.slice(0, 5).map((player) => (
                    <div
                      key={player.id}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-zinc-300">{player.name}</span>
                      <div className="flex items-center gap-2">
                        {player.linkedUserId && (
                          <span className="text-green-500 text-xs">Linked</span>
                        )}
                        <Link
                          href={`/playgroups/${id}/players/${player.id}/decks`}
                          className="text-amber-500 hover:text-amber-400 text-xs"
                        >
                          Decks
                        </Link>
                      </div>
                    </div>
                  ))}
                  {playgroup.players.length > 5 && (
                    <p className="text-zinc-500 text-xs">
                      +{playgroup.players.length - 5} more
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Stats Summary */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="font-semibold mb-4">Stats</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-2xl font-bold text-amber-500">
                    {playgroup.games.length > 5 ? "5+" : playgroup.games.length}
                  </div>
                  <div className="text-zinc-500 text-sm">Recent Games</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-500">
                    {playgroup.members.length}
                  </div>
                  <div className="text-zinc-500 text-sm">Members</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-500">
                    {playgroup.players.length}
                  </div>
                  <div className="text-zinc-500 text-sm">Players</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-amber-500">
                    {allMemberDecks.length + playgroup.players.reduce((sum, p) => sum + p.decks.length, 0)}
                  </div>
                  <div className="text-zinc-500 text-sm">Decks</div>
                </div>
              </div>
            </div>
          </div>

          {/* Leaderboard */}
          {leaderboard.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Leaderboard</h2>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      <th className="text-left text-zinc-400 text-sm font-medium px-4 py-3 w-12">#</th>
                      <th className="text-left text-zinc-400 text-sm font-medium px-4 py-3">Player</th>
                      <th className="text-center text-zinc-400 text-sm font-medium px-4 py-3">Games</th>
                      <th className="text-center text-zinc-400 text-sm font-medium px-4 py-3">Wins</th>
                      <th className="text-center text-zinc-400 text-sm font-medium px-4 py-3">Win Rate</th>
                      <th className="text-center text-zinc-400 text-sm font-medium px-4 py-3">First Outs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((player, index) => (
                      <tr
                        key={player.id}
                        className={`border-b border-zinc-800/50 ${index === 0 ? "bg-amber-900/10" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <span className={`font-bold ${index === 0 ? "text-amber-500" : index === 1 ? "text-zinc-300" : index === 2 ? "text-amber-700" : "text-zinc-500"}`}>
                            {index + 1}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className={index === 0 ? "font-semibold text-amber-500" : ""}>
                              {player.name}
                            </span>
                            {player.type === "player" && (
                              <span className="text-xs bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">
                                Guest
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-zinc-400">{player.games}</td>
                        <td className="px-4 py-3 text-center font-medium text-green-500">{player.wins}</td>
                        <td className="px-4 py-3 text-center text-amber-500">{player.winRate}%</td>
                        <td className="px-4 py-3 text-center text-red-400">{player.firstOuts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Recent Games */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Recent Games</h2>
              <Link
                href={`/games?playgroup=${id}`}
                className="text-amber-500 hover:text-amber-400 text-sm"
              >
                View all
              </Link>
            </div>
            {playgroup.games.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                <div className="text-4xl mb-4">🎮</div>
                <h3 className="text-lg font-semibold mb-2">No games yet</h3>
                <p className="text-zinc-400 mb-4">
                  Start tracking games with this playgroup.
                </p>
                <Link
                  href={`/games/new?playgroup=${id}`}
                  className="inline-block bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Start a Game
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {playgroup.games.map((game) => {
                  const winner = getWinner(game);
                  return (
                    <Link
                      key={game.id}
                      href={`/games/${game.id}`}
                      className="block bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-1">
                            <span className="text-sm bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                              {FORMAT_LABELS[game.format as MtgFormat]}
                            </span>
                            <span className="text-zinc-500 text-sm">
                              {game.totalTurns} turns
                            </span>
                            <span className="text-zinc-500 text-sm">
                              {formatDate(game.playedAt)}
                            </span>
                          </div>
                          <div className="text-zinc-400 text-sm">
                            {game.players.map((p) => getPlayerName(p)).join(", ")}
                          </div>
                        </div>
                        {winner && (
                          <div className="text-right">
                            <span className="text-amber-500 font-medium">
                              {getPlayerName(winner)}
                            </span>
                          </div>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* All Decks - Member and Player Decks */}
          <div className="mt-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Decks</h2>
            </div>
            {(() => {
              // Collect all player decks
              const playerDecks = playgroup.players.flatMap((player) =>
                player.decks.map((deck) => ({
                  ...deck,
                  playerName: player.name,
                  playerId: player.id,
                  type: "player" as const,
                }))
              );

              // Convert member decks to unified format (all decks from playgroup members)
              const memberDecks = allMemberDecks.map((deck) => ({
                ...deck,
                ownerName: deck.user.username,
                type: "member" as const,
              }));

              const totalDecks = memberDecks.length + playerDecks.length;

              if (totalDecks === 0) {
                return (
                  <p className="text-zinc-500">
                    No decks in this playgroup yet.
                  </p>
                );
              }

              return (
                <div className="space-y-6">
                  {/* Member Decks */}
                  {memberDecks.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-zinc-400 mb-3">
                        Member Decks ({memberDecks.length})
                      </h3>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {memberDecks.map((deck) => (
                          <Link
                            key={deck.id}
                            href={`/decks/${deck.id}`}
                            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors"
                          >
                            <div className="flex gap-3">
                              {deck.commander1 && (
                                <div className="flex-shrink-0 flex gap-1">
                                  <Suspense
                                    fallback={
                                      <div className="w-12 h-16 bg-zinc-800 rounded-lg animate-pulse" />
                                    }
                                  >
                                    <CommanderImage
                                      commanderName={deck.commander1}
                                      size="small"
                                    />
                                  </Suspense>
                                  {deck.commander2 && (
                                    <Suspense
                                      fallback={
                                        <div className="w-12 h-16 bg-zinc-800 rounded-lg animate-pulse" />
                                      }
                                    >
                                      <CommanderImage
                                        commanderName={deck.commander2}
                                        size="small"
                                      />
                                    </Suspense>
                                  )}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between">
                                  <h4 className="font-medium text-zinc-100">{deck.name}</h4>
                                  <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded ml-2">
                                    {deck.ownerName}
                                  </span>
                                </div>
                                {deck.commander1 && (
                                  <p className="text-zinc-400 text-sm mt-1 truncate">
                                    {deck.commander1}
                                    {deck.commander2 && ` + ${deck.commander2}`}
                                  </p>
                                )}
                                <p className="text-zinc-500 text-xs mt-1">
                                  {FORMAT_LABELS[deck.format as MtgFormat]}
                                  {deck.bracket && ` · Bracket ${deck.bracket}`}
                                </p>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Player Decks */}
                  {playerDecks.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-zinc-400 mb-3">
                        Player Decks ({playerDecks.length})
                      </h3>
                      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {playerDecks.map((deck) => (
                          <Link
                            key={deck.id}
                            href={`/playgroups/${id}/players/${deck.playerId}/decks`}
                            className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-zinc-700 transition-colors"
                          >
                            <div className="flex gap-3">
                              {deck.commander1 && (
                                <div className="flex-shrink-0 flex gap-1">
                                  <Suspense
                                    fallback={
                                      <div className="w-12 h-16 bg-zinc-800 rounded-lg animate-pulse" />
                                    }
                                  >
                                    <CommanderImage
                                      commanderName={deck.commander1}
                                      size="small"
                                    />
                                  </Suspense>
                                  {deck.commander2 && (
                                    <Suspense
                                      fallback={
                                        <div className="w-12 h-16 bg-zinc-800 rounded-lg animate-pulse" />
                                      }
                                    >
                                      <CommanderImage
                                        commanderName={deck.commander2}
                                        size="small"
                                      />
                                    </Suspense>
                                  )}
                                </div>
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between">
                                  <h4 className="font-medium text-zinc-100">{deck.name}</h4>
                                  <span className="text-xs bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded ml-2">
                                    {deck.playerName}
                                  </span>
                                </div>
                                {deck.commander1 && (
                                  <p className="text-zinc-400 text-sm mt-1 truncate">
                                    {deck.commander1}
                                    {deck.commander2 && ` + ${deck.commander2}`}
                                  </p>
                                )}
                                <p className="text-zinc-500 text-xs mt-1">
                                  {FORMAT_LABELS[deck.format as MtgFormat]}
                                  {deck.bracket && ` · Bracket ${deck.bracket}`}
                                </p>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      </main>
    </div>
  );
}
