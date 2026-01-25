import Link from "next/link";

type Props = {
  username?: string;
  activeTab?: "playgroups" | "games" | "decks" | "stats";
};

export function Header({ username, activeTab }: Props) {
  const linkClass = (tab: string) =>
    activeTab === tab
      ? "text-zinc-100 font-medium"
      : "text-zinc-400 hover:text-zinc-100 transition-colors";

  return (
    <header className="border-b border-zinc-800 px-6 py-4">
      <nav className="max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold text-amber-500">
          Karakas
        </Link>
        <div className="flex items-center gap-4">
          {username ? (
            <>
              <Link href="/playgroups" className={linkClass("playgroups")}>
                Playgroups
              </Link>
              <Link href="/games" className={linkClass("games")}>
                Games
              </Link>
              <Link href="/decks" className={linkClass("decks")}>
                Decks
              </Link>
              <Link href="/stats" className={linkClass("stats")}>
                Stats
              </Link>
              <span className="text-zinc-500">|</span>
              <span className="text-zinc-300">{username}</span>
              <Link
                href="/logout"
                className="text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                Log out
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
