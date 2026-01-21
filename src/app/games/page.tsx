import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FORMAT_LABELS, type MtgFormat } from "@/types/mtg";

export default async function GamesPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Get games where user is creator or a player
  const games = await db.game.findMany({
    where: {
      OR: [
        { createdById: user.id },
        { players: { some: { userId: user.id } } },
      ],
    },
    include: {
      players: {
        include: {
          deck: true,
        },
      },
    },
    orderBy: { playedAt: "desc" },
  });

  // Separate in-progress and completed games
  const inProgressGames = games.filter(
    (g) => !g.players.some((p) => p.isWinner) && !g.players.every((p) => p.placement !== null)
  );
  const completedGames = games.filter(
    (g) => g.players.some((p) => p.isWinner) || g.players.every((p) => p.placement !== null)
  );

  function getWinner(game: (typeof games)[0]) {
    return game.players.find((p) => p.isWinner);
  }

  function getPlayerNames(game: (typeof games)[0]) {
    return game.players.map((p) => p.guestName || "Unknown").join(", ");
  }

  function formatDate(date: Date) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

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
              href="/games"
              className="text-zinc-100 font-medium"
            >
              Games
            </Link>
            <Link
              href="/decks"
              className="text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Decks
            </Link>
            <Link
              href="/stats"
              className="text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Stats
            </Link>
            <span className="text-zinc-500">|</span>
            <span className="text-zinc-300">{user.username}</span>
            <Link
              href="/logout"
              className="text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Log out
            </Link>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Games</h1>
              <p className="text-zinc-400 mt-1">
                Track and view your game history
              </p>
            </div>
            <Link
              href="/games/new"
              className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg transition-colors"
            >
              Start New Game
            </Link>
          </div>

          {/* In Progress Games */}
          {inProgressGames.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                In Progress
              </h2>
              <div className="grid gap-4">
                {inProgressGames.map((game) => (
                  <Link
                    key={game.id}
                    href={`/games/${game.id}/play`}
                    className="bg-zinc-900 border border-zinc-800 hover:border-amber-500/50 rounded-xl p-4 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded">
                            {FORMAT_LABELS[game.format as MtgFormat]}
                          </span>
                          <span className="text-zinc-400 text-sm">
                            Turn {game.totalTurns || 1}
                          </span>
                        </div>
                        <div className="text-zinc-300 mt-2">
                          {getPlayerNames(game)}
                        </div>
                      </div>
                      <div className="text-amber-500 font-medium">
                        Continue →
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Completed Games */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Game History</h2>
            {completedGames.length === 0 && inProgressGames.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                <div className="text-4xl mb-4">🎮</div>
                <h3 className="text-lg font-semibold mb-2">No games yet</h3>
                <p className="text-zinc-400 mb-4">
                  Start tracking your first game to see it here.
                </p>
                <Link
                  href="/games/new"
                  className="inline-block bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Start a Game
                </Link>
              </div>
            ) : completedGames.length === 0 ? (
              <p className="text-zinc-500">No completed games yet.</p>
            ) : (
              <div className="grid gap-3">
                {completedGames.map((game) => {
                  const winner = getWinner(game);
                  const isDraw = !winner && game.players.every((p) => p.placement === 1);

                  return (
                    <Link
                      key={game.id}
                      href={`/games/${game.id}`}
                      className="bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
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
                          <div className="text-zinc-300">{getPlayerNames(game)}</div>
                        </div>
                        <div className="text-right">
                          {isDraw ? (
                            <span className="text-zinc-400">Draw</span>
                          ) : winner ? (
                            <div>
                              <span className="text-amber-500 font-medium">
                                {winner.guestName || "Winner"}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
