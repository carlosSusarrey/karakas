import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  FORMAT_LABELS,
  POWER_PLAY_LABELS,
  type MtgFormat,
  type PowerPlayType,
} from "@/types/mtg";
import { ShareButton } from "./share-button";
import { Header } from "@/components/header";

export default async function GameDetailPage({
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
          user: {
            select: { username: true },
          },
          playgroupPlayer: {
            select: { name: true },
          },
        },
        orderBy: { placement: "asc" },
      },
      powerPlays: {
        include: {
          gamePlayer: {
            include: {
              user: {
                select: { username: true },
              },
              playgroupPlayer: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { turn: "asc" },
      },
    },
  });

  if (!game) {
    redirect("/games");
  }

  // Check if game is still in progress
  const hasWinner = game.players.some((p) => p.isWinner);
  const allHavePlacements = game.players.every((p) => p.placement !== null);

  if (!hasWinner && !allHavePlacements) {
    redirect(`/games/${id}/play`);
  }

  const winner = game.players.find((p) => p.isWinner);
  const isDraw = !winner && game.players.every((p) => p.placement === 1);
  const isCreator = game.createdById === user.id;

  type GamePlayerWithDeck = (typeof game.players)[0];
  type PowerPlayWithPlayer = (typeof game.powerPlays)[0];

  function getPlayerName(player: GamePlayerWithDeck) {
    if (player.user) {
      return player.user.username;
    }
    if (player.playgroupPlayer) {
      return player.playgroupPlayer.name;
    }
    return player.guestName || "Unknown Player";
  }

  function getPowerPlayPlayerName(powerPlay: PowerPlayWithPlayer) {
    const player = powerPlay.gamePlayer;
    if (player.user) {
      return player.user.username;
    }
    if (player.playgroupPlayer) {
      return player.playgroupPlayer.name;
    }
    return player.guestName || "Unknown Player";
  }

  function formatDate(date: Date) {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

  function getPlacementSuffix(placement: number) {
    if (placement === 1) return "st";
    if (placement === 2) return "nd";
    if (placement === 3) return "rd";
    return "th";
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header username={user.username} activeTab="games" />

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            {game.playgroup ? (
              <Link href={`/playgroups/${game.playgroup.id}`} className="text-zinc-400 hover:text-zinc-300 text-sm">
                ← Back to {game.playgroup.name}
              </Link>
            ) : (
              <Link href="/games" className="text-zinc-400 hover:text-zinc-300 text-sm">
                ← Back to Games
              </Link>
            )}
          </div>

          {/* Game Summary */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded">
                    {FORMAT_LABELS[game.format as MtgFormat]}
                  </span>
                  <span className="text-zinc-500 text-sm">
                    {game.totalTurns} turns
                  </span>
                </div>
                <div className="text-zinc-400 text-sm">{formatDate(game.playedAt)}</div>
              </div>
              <div className="flex items-center gap-4">
                <ShareButton
                  gameId={id}
                  format={FORMAT_LABELS[game.format as MtgFormat]}
                  turns={game.totalTurns}
                  playedAt={game.playedAt}
                  winner={winner ? {
                    name: getPlayerName(winner),
                    commander: winner.commanderUsed1,
                    placement: winner.placement,
                    isWinner: true,
                  } : undefined}
                  players={game.players.map(p => ({
                    name: getPlayerName(p),
                    commander: p.commanderUsed1,
                    placement: p.placement,
                    isWinner: p.isWinner,
                  }))}
                  playgroupName={game.playgroup?.name}
                />
                {isCreator && (
                  <Link
                    href={`/games/${id}/edit`}
                    className="text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
                  >
                    Edit
                  </Link>
                )}
              </div>
            </div>

            {/* Winner/Draw Display */}
            <div className="text-center py-6 border-y border-zinc-800 my-4">
              {isDraw ? (
                <div>
                  <div className="text-zinc-400 text-sm uppercase tracking-wide mb-2">
                    Result
                  </div>
                  <div className="text-2xl font-bold text-zinc-300">Draw</div>
                </div>
              ) : winner ? (
                <div>
                  <div className="text-zinc-400 text-sm uppercase tracking-wide mb-2">
                    Winner
                  </div>
                  <div className="text-2xl font-bold text-amber-500">
                    {getPlayerName(winner)}
                  </div>
                  {winner.commanderUsed1 && (
                    <div className="text-zinc-400 mt-1">
                      {winner.commanderUsed1}
                      {winner.commanderUsed2 && ` / ${winner.commanderUsed2}`}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            {/* All Players Results */}
            <div>
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wide mb-3">
                Final Standings
              </h3>
              <div className="space-y-2">
                {game.players.map((player) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      player.isWinner
                        ? "bg-amber-900/20 border border-amber-800/30"
                        : "bg-zinc-800/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-lg font-bold ${
                          player.placement === 1
                            ? "text-amber-500"
                            : "text-zinc-500"
                        }`}
                      >
                        {player.placement}
                        {player.placement && getPlacementSuffix(player.placement)}
                      </span>
                      <div>
                        <div className="font-medium">{getPlayerName(player)}</div>
                        {player.commanderUsed1 && (
                          <div className="text-zinc-500 text-sm">
                            {player.commanderUsed1}
                            {player.commanderUsed2 && ` / ${player.commanderUsed2}`}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-sm text-zinc-500">
                      {player.isWinner && (
                        <span className="text-amber-500">Winner</span>
                      )}
                      {player.isFirstOut && (
                        <span className="text-red-400">First Out</span>
                      )}
                      {player.eliminatedTurn && !player.isFirstOut && (
                        <span>Eliminated T{player.eliminatedTurn}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Power Plays */}
          {game.powerPlays.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h3 className="text-lg font-semibold mb-4">Notable Plays</h3>
              <div className="space-y-3">
                {game.powerPlays.map((play) => (
                  <div key={play.id} className="border-l-2 border-amber-500/30 pl-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded">
                        Turn {play.turn}
                      </span>
                      <span className="text-xs bg-amber-900/50 text-amber-400 px-2 py-0.5 rounded">
                        {POWER_PLAY_LABELS[play.type as PowerPlayType]}
                      </span>
                      <span className="text-zinc-400 text-sm">
                        {getPowerPlayPlayerName(play)}
                      </span>
                    </div>
                    <div className="text-zinc-300">
                      {play.description}
                      {play.cardName && (
                        <span className="text-amber-500 ml-1">({play.cardName})</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Game Notes */}
          {game.notes && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mt-6">
              <h3 className="text-lg font-semibold mb-3">Notes</h3>
              <p className="text-zinc-400 whitespace-pre-wrap">{game.notes}</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
