import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FORMAT_LABELS, type MtgFormat } from "@/types/mtg";
import { DeckForm } from "./deck-form";
import { DeckActions } from "./deck-actions";

export default async function PlaygroupPlayerDecksPage({
  params,
}: {
  params: Promise<{ id: string; playerId: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id, playerId } = await params;

  // Get playgroup and verify membership
  const playgroup = await db.playgroup.findUnique({
    where: { id },
    include: {
      members: {
        select: { userId: true, role: true },
      },
    },
  });

  if (!playgroup) {
    notFound();
  }

  const membership = playgroup.members.find((m) => m.userId === user.id);
  if (!membership) {
    notFound();
  }

  const isAdmin = membership.role === "admin" || membership.role === "owner";

  // Get the player and their decks
  const player = await db.playgroupPlayer.findUnique({
    where: { id: playerId },
    include: {
      decks: {
        include: {
          _count: { select: { gamePlayers: true } },
        },
        orderBy: [{ isActive: "desc" }, { name: "asc" }],
      },
    },
  });

  if (!player || player.playgroupId !== id) {
    notFound();
  }

  const activeDecks = player.decks.filter((d) => d.isActive);
  const archivedDecks = player.decks.filter((d) => !d.isActive);

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
          <div className="text-sm text-zinc-400 mb-4">
            <Link
              href={`/playgroups/${id}`}
              className="hover:text-zinc-300"
            >
              {playgroup.name}
            </Link>
            <span className="mx-2">/</span>
            <Link
              href={`/playgroups/${id}/players`}
              className="hover:text-zinc-300"
            >
              Players
            </Link>
            <span className="mx-2">/</span>
            <span className="text-zinc-300">{player.name}</span>
          </div>

          <div className="mb-8">
            <h1 className="text-3xl font-bold">{player.name}&apos;s Decks</h1>
            <p className="text-zinc-400 mt-1">
              Manage decks for this player
            </p>
          </div>

          {/* Add Deck Form */}
          <div className="mb-8">
            <DeckForm playerId={playerId} />
          </div>

          {/* Active Decks */}
          <div className="mb-8">
            <h2 className="text-lg font-semibold mb-4">
              Active Decks ({activeDecks.length})
            </h2>
            {activeDecks.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
                <div className="text-4xl mb-4">🃏</div>
                <h3 className="text-lg font-semibold mb-2">No decks yet</h3>
                <p className="text-zinc-400">
                  Add decks for this player to track their game history with specific decks.
                </p>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
                {activeDecks.map((deck) => (
                  <div key={deck.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-100 font-medium">
                            {deck.name}
                          </span>
                          <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
                            {FORMAT_LABELS[deck.format as MtgFormat] || deck.format}
                          </span>
                          {deck.bracket && (
                            <span className="text-xs bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded">
                              Bracket {deck.bracket}
                            </span>
                          )}
                        </div>
                        {deck.commander1 && (
                          <p className="text-zinc-400 text-sm mt-1">
                            {deck.commander1}
                            {deck.commander2 && ` & ${deck.commander2}`}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-1 text-zinc-500 text-sm">
                          <span>{deck._count.gamePlayers} games</span>
                          {deck.decklistUrl && (
                            <a
                              href={deck.decklistUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-amber-500 hover:text-amber-400"
                            >
                              View decklist
                            </a>
                          )}
                        </div>
                      </div>
                      <DeckActions
                        deck={deck}
                        canDelete={isAdmin && deck._count.gamePlayers === 0}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Archived Decks */}
          {archivedDecks.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 text-zinc-400">
                Archived Decks ({archivedDecks.length})
              </h2>
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
                {archivedDecks.map((deck) => (
                  <div key={deck.id} className="p-4 opacity-60">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-zinc-300 font-medium">
                            {deck.name}
                          </span>
                          <span className="text-xs bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded">
                            {FORMAT_LABELS[deck.format as MtgFormat] || deck.format}
                          </span>
                          <span className="text-xs bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded">
                            Archived
                          </span>
                        </div>
                        {deck.commander1 && (
                          <p className="text-zinc-500 text-sm mt-1">
                            {deck.commander1}
                            {deck.commander2 && ` & ${deck.commander2}`}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-1 text-zinc-600 text-sm">
                          <span>{deck._count.gamePlayers} games</span>
                        </div>
                      </div>
                      <DeckActions
                        deck={deck}
                        canDelete={isAdmin && deck._count.gamePlayers === 0}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Info about deck linking */}
          <div className="mt-8 bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <h3 className="font-semibold mb-2">About Deck Linking</h3>
            <p className="text-zinc-400 text-sm">
              When this player claims their account, these decks can be linked to
              decks in their personal collection. This helps maintain consistent
              statistics across their game history.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
