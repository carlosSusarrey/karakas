import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Header } from "@/components/header";

export default async function PlaygroupsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Get playgroups where user is owner or member
  const playgroups = await db.playgroup.findMany({
    where: {
      OR: [
        { ownerId: user.id },
        { members: { some: { userId: user.id } } },
      ],
    },
    include: {
      owner: { select: { username: true } },
      members: { select: { id: true } },
      _count: {
        select: {
          games: true,
          decks: true,
          players: true,
        },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <div className="min-h-screen flex flex-col">
      <Header username={user.username} activeTab="playgroups" />

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Your Playgroups</h1>
              <p className="text-zinc-400 mt-1">
                Organize games and decks with your regular play groups
              </p>
            </div>
            <Link
              href="/playgroups/new"
              className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg transition-colors"
            >
              + New Playgroup
            </Link>
          </div>

          {/* Playgroup List */}
          {playgroups.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-12 text-center">
              <div className="text-4xl mb-4">👥</div>
              <h2 className="text-xl font-semibold mb-2">No playgroups yet</h2>
              <p className="text-zinc-400 mb-6">
                Create a playgroup to organize your games with friends.
              </p>
              <Link
                href="/playgroups/new"
                className="inline-block bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-lg transition-colors"
              >
                Create Playgroup
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {playgroups.map((playgroup) => {
                const isOwner = playgroup.ownerId === user.id;
                const memberCount = playgroup.members.length;

                return (
                  <Link
                    key={playgroup.id}
                    href={`/playgroups/${playgroup.id}`}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition-colors group"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <h3 className="font-semibold text-lg group-hover:text-amber-500 transition-colors">
                        {playgroup.name}
                      </h3>
                      {isOwner && (
                        <span className="text-xs bg-amber-900/50 text-amber-400 px-2 py-1 rounded">
                          Owner
                        </span>
                      )}
                    </div>
                    {playgroup.description && (
                      <p className="text-zinc-400 text-sm mb-3 line-clamp-2">
                        {playgroup.description}
                      </p>
                    )}
                    <div className="flex items-center gap-4 text-zinc-500 text-sm">
                      <span title="Members">
                        👤 {memberCount}
                      </span>
                      <span title="Games played">
                        🎮 {playgroup._count.games}
                      </span>
                      <span title="Decks">
                        📚 {playgroup._count.decks}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
