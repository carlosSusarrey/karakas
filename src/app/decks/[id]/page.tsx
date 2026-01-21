import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  FORMAT_LABELS,
  BRACKET_DESCRIPTIONS,
  type MtgFormat,
  type EdhBracket,
} from "@/types/mtg";
import { DeckActions } from "./deck-actions";

export default async function DeckDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  const deck = await db.deck.findUnique({
    where: { id },
  });

  if (!deck || deck.userId !== user.id) {
    notFound();
  }

  // Get game history for this deck
  const gamesWithDeck = await db.gamePlayer.findMany({
    where: { deckId: deck.id },
    include: {
      game: {
        include: {
          players: {
            include: {
              user: { select: { id: true, username: true } },
            },
          },
        },
      },
    },
    orderBy: { game: { playedAt: "desc" } },
    take: 10,
  });

  const stats = {
    gamesPlayed: gamesWithDeck.length,
    wins: gamesWithDeck.filter((gp) => gp.isWinner).length,
    winRate:
      gamesWithDeck.length > 0
        ? Math.round(
            (gamesWithDeck.filter((gp) => gp.isWinner).length /
              gamesWithDeck.length) *
              100
          )
        : 0,
  };

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
              href="/decks"
              className="text-zinc-100 font-medium"
            >
              Decks
            </Link>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Back link */}
          <Link
            href="/decks"
            className="text-zinc-400 hover:text-zinc-300 text-sm"
          >
            ← Back to Decks
          </Link>

          {/* Deck Header */}
          <div className="mt-6 mb-8 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">{deck.name}</h1>
                {!deck.isActive && (
                  <span className="text-sm bg-zinc-700 text-zinc-400 px-2 py-0.5 rounded">
                    Archived
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-zinc-400">
                <span className="bg-zinc-800 px-2 py-1 rounded text-sm">
                  {FORMAT_LABELS[deck.format as MtgFormat] || deck.format}
                </span>
                {deck.bracket && (
                  <span
                    className="text-sm"
                    title={BRACKET_DESCRIPTIONS[deck.bracket as EdhBracket]}
                  >
                    Bracket {deck.bracket}
                  </span>
                )}
              </div>
            </div>
            <DeckActions deck={deck} />
          </div>

          {/* Deck Info */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Details Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Deck Details</h2>
              <dl className="space-y-3">
                {deck.commander1 && (
                  <div>
                    <dt className="text-zinc-500 text-sm">Commander</dt>
                    <dd className="text-zinc-200">
                      {deck.commander1}
                      {deck.commander2 && (
                        <span className="text-zinc-400">
                          {" "}+ {deck.commander2}
                        </span>
                      )}
                    </dd>
                  </div>
                )}
                {deck.bracket && (
                  <div>
                    <dt className="text-zinc-500 text-sm">EDH Bracket</dt>
                    <dd className="text-zinc-200">
                      Bracket {deck.bracket}
                      <p className="text-zinc-500 text-sm">
                        {BRACKET_DESCRIPTIONS[deck.bracket as EdhBracket]}
                      </p>
                    </dd>
                  </div>
                )}
                {deck.decklistUrl && (
                  <div>
                    <dt className="text-zinc-500 text-sm">Decklist</dt>
                    <dd>
                      <a
                        href={deck.decklistUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-amber-500 hover:text-amber-400 transition-colors"
                      >
                        View on {new URL(deck.decklistUrl).hostname} →
                      </a>
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="text-zinc-500 text-sm">Created</dt>
                  <dd className="text-zinc-400 text-sm">
                    {deck.createdAt.toLocaleDateString()}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Stats Card */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4">Statistics</h2>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-amber-500">
                    {stats.gamesPlayed}
                  </div>
                  <div className="text-zinc-500 text-sm">Games</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-green-500">
                    {stats.wins}
                  </div>
                  <div className="text-zinc-500 text-sm">Wins</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-zinc-300">
                    {stats.winRate}%
                  </div>
                  <div className="text-zinc-500 text-sm">Win Rate</div>
                </div>
              </div>
            </div>
          </div>

          {/* Recent Games */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold mb-4">Recent Games</h2>
            {gamesWithDeck.length === 0 ? (
              <p className="text-zinc-500 text-center py-8">
                No games played with this deck yet.
              </p>
            ) : (
              <div className="space-y-3">
                {gamesWithDeck.map((gp) => (
                  <Link
                    key={gp.id}
                    href={`/games/${gp.game.id}`}
                    className="block bg-zinc-800/50 hover:bg-zinc-800 rounded-lg p-4 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-medium ${
                              gp.isWinner ? "text-green-500" : "text-zinc-400"
                            }`}
                          >
                            {gp.isWinner ? "Win" : `#${gp.placement || "?"}`}
                          </span>
                          <span className="text-zinc-500">•</span>
                          <span className="text-zinc-300">
                            {gp.game.players.length} players
                          </span>
                        </div>
                        <div className="text-zinc-500 text-sm mt-1">
                          vs{" "}
                          {gp.game.players
                            .filter((p) => p.id !== gp.id)
                            .map((p) => p.user?.username || p.guestName || "Unknown")
                            .join(", ")}
                        </div>
                      </div>
                      <div className="text-zinc-500 text-sm">
                        {gp.game.playedAt.toLocaleDateString()}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
