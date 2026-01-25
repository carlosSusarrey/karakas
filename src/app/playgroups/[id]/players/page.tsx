import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { PlayerForm } from "./player-form";
import { PlayerActions } from "./player-actions";

export default async function PlaygroupPlayersPage({
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
      members: {
        select: { userId: true, role: true },
      },
      players: {
        include: {
          linkedUser: { select: { username: true } },
          _count: { select: { gamePlayers: true } },
        },
        orderBy: { name: "asc" },
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

  const isAdmin = membership.role === "admin" || membership.role === "owner";

  // Get stats for each player
  const playersWithStats = await Promise.all(
    playgroup.players.map(async (player) => {
      const gamesPlayed = await db.gamePlayer.count({
        where: { playgroupPlayerId: player.id },
      });
      const wins = await db.gamePlayer.count({
        where: { playgroupPlayerId: player.id, isWinner: true },
      });

      return {
        ...player,
        gamesPlayed,
        wins,
        winRate: gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0,
      };
    })
  );

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-amber-500">
            Karakas
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/playgroups"
              className="text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Playgroups
            </Link>
            <Link
              href="/games"
              className="text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Games
            </Link>
            <Link
              href="/decks"
              className="text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Decks
            </Link>
            <span className="text-zinc-500">|</span>
            <span className="text-zinc-300">{user.username}</span>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <Link
            href={`/playgroups/${id}`}
            className="text-zinc-400 hover:text-zinc-300 text-sm"
          >
            ← Back to {playgroup.name}
          </Link>

          <div className="mt-4 mb-8">
            <h1 className="text-3xl font-bold">Players</h1>
            <p className="text-zinc-400 mt-1">
              Manage players in {playgroup.name} who don&apos;t have accounts yet
            </p>
          </div>

          {/* Add Player Form */}
          <div className="mb-8">
            <PlayerForm playgroupId={id} />
          </div>

          {/* Player List */}
          <div>
            <h2 className="text-lg font-semibold mb-4">
              Players ({playgroup.players.length})
            </h2>
            {playersWithStats.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                <div className="text-4xl mb-4">👤</div>
                <h3 className="text-lg font-semibold mb-2">No players yet</h3>
                <p className="text-zinc-400">
                  Add players who don&apos;t have accounts to track their game history.
                </p>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
                {playersWithStats.map((player) => (
                  <div
                    key={player.id}
                    className="p-4 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-100 font-medium">
                          {player.name}
                        </span>
                        {player.linkedUser && (
                          <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded">
                            Linked to {player.linkedUser.username}
                          </span>
                        )}
                      </div>
                      {player.email && (
                        <p className="text-zinc-500 text-sm">{player.email}</p>
                      )}
                      <div className="flex items-center gap-4 mt-1 text-zinc-500 text-sm">
                        <span>{player.gamesPlayed} games</span>
                        <span>{player.wins} wins</span>
                        <span>{player.winRate}% win rate</span>
                      </div>
                    </div>
                    <PlayerActions
                      player={player}
                      canDelete={isAdmin && player._count.gamePlayers === 0}
                      canEdit={true}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Info about linking */}
          <div className="mt-8 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <h3 className="font-semibold mb-2">About Player Linking</h3>
            <p className="text-zinc-400 text-sm">
              When a player creates an account on Karakas, they can claim their
              player profile. This will link their account to all their existing
              game history, transferring stats and records to their account.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
