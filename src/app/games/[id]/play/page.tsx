import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { GameTracker } from "./game-tracker";

export default async function PlayGamePage({
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
      players: {
        include: {
          deck: true,
        },
      },
      powerPlays: {
        include: {
          gamePlayer: true,
        },
        orderBy: { turn: "asc" },
      },
    },
  });

  if (!game) {
    redirect("/games");
  }

  // Check if game is already finished (has a winner or all players have placements)
  const hasWinner = game.players.some((p) => p.isWinner);
  const allHavePlacements = game.players.every((p) => p.placement !== null);

  if (hasWinner || allHavePlacements) {
    redirect(`/games/${id}`);
  }

  return <GameTracker game={game} />;
}
