import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { EditGameForm } from "./edit-game-form";
import { Header } from "@/components/header";

export default async function EditGamePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  const game = await db.game.findUnique({
    where: { id },
    include: {
      createdBy: true,
      playgroup: {
        select: { id: true, name: true },
      },
      players: {
        include: {
          deck: true,
          playgroupPlayerDeck: true,
          user: {
            select: { id: true, username: true },
          },
          playgroupPlayer: {
            select: { id: true, name: true },
          },
        },
        orderBy: { placement: "asc" },
      },
    },
  });

  if (!game) {
    redirect("/games");
  }

  // Only the creator can edit the game
  if (game.createdById !== user.id) {
    redirect(`/games/${id}`);
  }

  // Check if game is still in progress - redirect to play page
  const hasWinner = game.players.some((p) => p.isWinner);
  const allHavePlacements = game.players.every((p) => p.placement !== null);

  if (!hasWinner && !allHavePlacements) {
    redirect(`/games/${id}/play`);
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header username={user.username} activeTab="games" />

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <Link href={`/games/${id}`} className="text-zinc-400 hover:text-zinc-300 text-sm">
              ← Back to Game
            </Link>
          </div>

          <h1 className="text-3xl font-bold mb-6">Edit Game</h1>

          <EditGameForm game={game} />
        </div>
      </main>
    </div>
  );
}
