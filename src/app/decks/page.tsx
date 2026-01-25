import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FORMAT_LABELS, BRACKET_DESCRIPTIONS, type MtgFormat, type EdhBracket } from "@/types/mtg";
import { Header } from "@/components/header";

export default async function DecksPage({
  searchParams,
}: {
  searchParams: Promise<{ format?: string; archived?: string; playgroup?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const params = await searchParams;
  const formatFilter = params.format;
  const showArchived = params.archived === "true";
  const playgroupFilter = params.playgroup;

  // Get user's playgroups for the filter
  const userPlaygroups = await db.playgroupMember.findMany({
    where: { userId: user.id },
    include: {
      playgroup: {
        select: { id: true, name: true },
      },
    },
    orderBy: { playgroup: { name: "asc" } },
  });

  const decks = await db.deck.findMany({
    where: {
      userId: user.id,
      isActive: !showArchived,
      ...(formatFilter && { format: formatFilter }),
      ...(playgroupFilter && { playgroupId: playgroupFilter }),
    },
    include: {
      playgroup: {
        select: { id: true, name: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const formats = await db.deck.groupBy({
    by: ["format"],
    where: {
      userId: user.id,
      isActive: !showArchived,
      ...(playgroupFilter && { playgroupId: playgroupFilter }),
    },
    _count: true,
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header username={user.username} activeTab="decks" />

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
          <div className="flex flex-wrap items-center gap-4 mb-6">
            {/* Playgroup Filter */}
            {userPlaygroups.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-zinc-400 text-sm self-center mr-1">Playgroup:</span>
                <Link
                  href={`/decks${formatFilter ? `?format=${formatFilter}` : ""}${showArchived ? `${formatFilter ? "&" : "?"}archived=true` : ""}`}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    !playgroupFilter
                      ? "bg-amber-600 text-white"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  All
                </Link>
                {userPlaygroups.map(({ playgroup: pg }) => (
                  <Link
                    key={pg.id}
                    href={`/decks?playgroup=${pg.id}${formatFilter ? `&format=${formatFilter}` : ""}${showArchived ? "&archived=true" : ""}`}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      playgroupFilter === pg.id
                        ? "bg-amber-600 text-white"
                        : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    }`}
                  >
                    {pg.name}
                  </Link>
                ))}
              </div>
            )}

            {/* Format Filter */}
            <div className="flex flex-wrap gap-2">
              <span className="text-zinc-400 text-sm self-center mr-1">Format:</span>
              <Link
                href={`/decks${playgroupFilter ? `?playgroup=${playgroupFilter}` : ""}${showArchived ? `${playgroupFilter ? "&" : "?"}archived=true` : ""}`}
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
                  href={`/decks?${playgroupFilter ? `playgroup=${playgroupFilter}&` : ""}format=${f.format}${showArchived ? "&archived=true" : ""}`}
                  className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    formatFilter === f.format
                      ? "bg-amber-600 text-white"
                      : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  {FORMAT_LABELS[f.format as MtgFormat] || f.format} ({f._count})
                </Link>
              ))}
            </div>

            {/* Archive Toggle */}
            <div>
              <Link
                href={showArchived
                  ? `/decks${playgroupFilter ? `?playgroup=${playgroupFilter}` : ""}${formatFilter ? `${playgroupFilter ? "&" : "?"}format=${formatFilter}` : ""}`
                  : `/decks?${playgroupFilter ? `playgroup=${playgroupFilter}&` : ""}${formatFilter ? `format=${formatFilter}&` : ""}archived=true`
                }
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  showArchived
                    ? "bg-zinc-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {showArchived ? "Show Active" : "Show Archived"}
              </Link>
            </div>
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
                  <div className="flex items-center gap-2 mt-2">
                    {deck.playgroup && (
                      <span className="text-xs bg-zinc-800 text-zinc-500 px-2 py-0.5 rounded">
                        {deck.playgroup.name}
                      </span>
                    )}
                    {!deck.isActive && (
                      <span className="text-xs bg-zinc-700 text-zinc-400 px-2 py-0.5 rounded">
                        Archived
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
