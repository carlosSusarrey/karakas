import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { logoutUser } from "@/app/logout/actions";
import { getClaimTokenInfo } from "@/app/playgroups/[id]/players/actions";
import { ClaimForm } from "./claim-form";

export default async function ClaimPlayerPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getCurrentUser();
  const tokenInfo = await getClaimTokenInfo(token);

  if (!tokenInfo) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-zinc-800 px-6 py-4">
          <nav className="max-w-6xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-amber-500">
              Karakas
            </Link>
          </nav>
        </header>

        <main className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
            <div className="text-4xl mb-4">🔗</div>
            <h1 className="text-2xl font-bold mb-2">Invalid Link</h1>
            <p className="text-zinc-400 mb-6">
              This claim link is invalid or has expired. Please ask for a new invitation.
            </p>
            <Link
              href="/"
              className="inline-block bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Go Home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if ("expired" in tokenInfo) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-zinc-800 px-6 py-4">
          <nav className="max-w-6xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-amber-500">
              Karakas
            </Link>
          </nav>
        </header>

        <main className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
            <div className="text-4xl mb-4">⏰</div>
            <h1 className="text-2xl font-bold mb-2">Link Expired</h1>
            <p className="text-zinc-400 mb-6">
              This claim link has expired. Please ask the playgroup admin for a new invitation.
            </p>
            <Link
              href="/"
              className="inline-block bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Go Home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if ("alreadyClaimed" in tokenInfo) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b border-zinc-800 px-6 py-4">
          <nav className="max-w-6xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold text-amber-500">
              Karakas
            </Link>
          </nav>
        </header>

        <main className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center">
            <div className="text-4xl mb-4">✓</div>
            <h1 className="text-2xl font-bold mb-2">Already Claimed</h1>
            <p className="text-zinc-400 mb-6">
              This player has already been claimed by another account.
            </p>
            <Link
              href="/"
              className="inline-block bg-amber-600 hover:bg-amber-500 text-white px-6 py-2 rounded-lg transition-colors"
            >
              Go Home
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-800 px-6 py-4">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold text-amber-500">
            Karakas
          </Link>
          {user ? (
            <div className="flex items-center gap-4">
              <span className="text-zinc-300">{user.username}</span>
              <form action={logoutUser} className="inline">
                <button
                  type="submit"
                  className="text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  Log out
                </button>
              </form>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <Link
                href={`/login?redirect=/claim/${token}`}
                className="text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                Log in
              </Link>
              <Link
                href={`/signup?redirect=/claim/${token}`}
                className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Sign up
              </Link>
            </div>
          )}
        </nav>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-8">
        <div className="max-w-md w-full">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8">
            <div className="text-center mb-6">
              <div className="text-4xl mb-4">🎮</div>
              <h1 className="text-2xl font-bold mb-2">Claim Your Player</h1>
              <p className="text-zinc-400">
                Link your account to your game history
              </p>
            </div>

            <div className="bg-zinc-800/50 rounded-lg p-4 mb-6">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-zinc-400">Player Name</span>
                  <span className="font-medium">{tokenInfo.playerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Playgroup</span>
                  <span className="font-medium">{tokenInfo.playgroupName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-400">Games Played</span>
                  <span className="font-medium">{tokenInfo.gamesPlayed}</span>
                </div>
                {tokenInfo.decksCount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Decks</span>
                    <span className="font-medium">{tokenInfo.decksCount}</span>
                  </div>
                )}
              </div>
            </div>

            {user ? (
              <ClaimForm token={token} />
            ) : (
              <div className="space-y-4">
                <p className="text-center text-zinc-400 text-sm">
                  Create an account or log in to claim this player and link your game history.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Link
                    href={`/signup?redirect=/claim/${token}`}
                    className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg transition-colors text-center"
                  >
                    Sign up
                  </Link>
                  <Link
                    href={`/login?redirect=/claim/${token}`}
                    className="bg-zinc-700 hover:bg-zinc-600 text-white px-4 py-2 rounded-lg transition-colors text-center"
                  >
                    Log in
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
