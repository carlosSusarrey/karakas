import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FORMAT_LABELS, BRACKET_DESCRIPTIONS, type MtgFormat, type EdhBracket } from "@/types/mtg";

export default async function DecksPage({
  searchParams,
}: {
  searchParams: Promise<{ format?: string; archived?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const formatFilter = params.format;
  const showArchived = params.archived === "true";

  const decks = await db.deck.findMany({
    where: {
      userId: user.id,
      isActive: !showArchived,
      ...(formatFilter && { format: formatFilter }),
    },
    orderBy: { updatedAt: "desc" },
  });

  const formats = await db.deck.groupBy({
    by: ["format"],
    where: { userId: user.id, isActive: !showArchived },
    _count: true,
  });

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
              className="text-zinc-100 font-medium"
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
        <div className="max-w-6xl mx-auto">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Your Decks</h1>
              <p className="text-zinc-400 mt-1">
                Manage your deck library for quick game logging
              </p>
            </div>
            <Link
              href="/decks/new"
              className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg transition-colors"
            >
              + New Deck
            </Link>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 mb-6">
            <Link
              href="/decks"
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                !formatFilter && !showArchived
                  ? "bg-amber-600 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              All ({decks.length})
            </Link>
            {formats.map((f) => (
              <Link
                key={f.format}
                href={`/decks?format=${f.format}`}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  formatFilter === f.format
                    ? "bg-amber-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {FORMAT_LABELS[f.format as MtgFormat] || f.format} ({f._count})
              </Link>
            ))}
            <span className="text-zinc-600">|</span>
            <Link
              href={showArchived ? "/decks" : "/decks?archived=true"}
              className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                showArchived
                  ? "bg-zinc-600 text-white"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              {showArchived ? "Show Active" : "Show Archived"}
            </Link>
          </div>

          {/* Deck List */}
          {decks.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
              <div className="text-4xl mb-4">📚</div>
              <h2 className="text-xl font-semibold mb-2">
                {showArchived ? "No archived decks" : "No decks yet"}
              </h2>
              <p className="text-zinc-400 mb-6">
                {showArchived
                  ? "Decks you archive will appear here."
                  : "Create your first deck to start tracking your games."}
              </p>
              {!showArchived && (
                <Link
                  href="/decks/new"
                  className="inline-block bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Create Deck
                </Link>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {decks.map((deck) => (
                <Link
                  key={deck.id}
                  href={`/decks/${deck.id}`}
                  className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-lg group-hover:text-amber-500 transition-colors">
                      {deck.name}
                    </h3>
                    <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded">
                      {FORMAT_LABELS[deck.format as MtgFormat] || deck.format}
                    </span>
                  </div>
                  {deck.commander1 && (
                    <p className="text-zinc-300 text-sm mb-2">
                      {deck.commander1}
                      {deck.commander2 && ` + ${deck.commander2}`}
                    </p>
                  )}
                  {deck.bracket && (
                    <p className="text-zinc-500 text-xs" title={BRACKET_DESCRIPTIONS[deck.bracket as EdhBracket]}>
                      Bracket {deck.bracket}
                    </p>
                  )}
                  {!deck.isActive && (
                    <span className="inline-block mt-2 text-xs bg-zinc-700 text-zinc-400 px-2 py-0.5 rounded">
                      Archived
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
