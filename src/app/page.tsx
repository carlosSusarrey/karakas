import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { Header } from "@/components/header";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-screen flex flex-col">
      <Header username={user?.username} />

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-2xl text-center">
          <h1 className="text-5xl font-bold mb-6">
            Track Your{" "}
            <span className="text-amber-500">Magic: The Gathering</span> Games
          </h1>
          <p className="text-xl text-zinc-400 mb-8">
            Log your Commander games, track power plays, and see detailed
            statistics about your playgroup. Never forget who combo&apos;d off
            on turn 4 again.
          </p>
          {user ? (
            <Link
              href="/playgroups"
              className="inline-block bg-amber-600 hover:bg-amber-500 text-white text-lg px-8 py-3 rounded-lg transition-colors"
            >
              Go to Playgroups
            </Link>
          ) : (
            <div className="flex gap-4 justify-center">
              <Link
                href="/signup"
                className="inline-block bg-amber-600 hover:bg-amber-500 text-white text-lg px-8 py-3 rounded-lg transition-colors"
              >
                Get Started
              </Link>
              <Link
                href="/login"
                className="inline-block border border-zinc-700 hover:border-zinc-500 text-zinc-300 text-lg px-8 py-3 rounded-lg transition-colors"
              >
                Log in
              </Link>
            </div>
          )}
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 max-w-4xl mt-20">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="text-3xl mb-4">🎮</div>
            <h3 className="text-lg font-semibold mb-2">Log Games</h3>
            <p className="text-zinc-400 text-sm">
              Track multiplayer and 1v1 games across all formats. Record
              winners, turn counts, and memorable plays.
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="text-3xl mb-4">📚</div>
            <h3 className="text-lg font-semibold mb-2">Manage Decks</h3>
            <p className="text-zinc-400 text-sm">
              Keep a library of your decks with commanders, brackets, and
              decklist links for quick game logging.
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <div className="text-3xl mb-4">📊</div>
            <h3 className="text-lg font-semibold mb-2">View Stats</h3>
            <p className="text-zinc-400 text-sm">
              See win rates, favorite commanders, and power play trends across
              your playgroup.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800 px-6 py-4">
        <div className="max-w-6xl mx-auto text-center text-zinc-500 text-sm">
          Karakas - MTG Game Tracker
        </div>
      </footer>
    </div>
  );
}
