"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { logoutUser } from "@/app/logout/actions";

type Props = {
  username?: string;
  activeTab?: "playgroups" | "games" | "decks" | "stats" | "friends";
};

export function Header({ username, activeTab }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const linkClass = (tab: string) =>
    activeTab === tab
      ? "text-zinc-100 font-medium"
      : "text-zinc-400 hover:text-zinc-100 transition-colors";

  const dropdownLinkClass = (tab: string) =>
    activeTab === tab
      ? "block px-4 py-2 text-zinc-100 font-medium bg-zinc-800"
      : "block px-4 py-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="border-b border-zinc-800 px-6 py-4">
      <nav className="max-w-6xl mx-auto flex items-center justify-between">
        <Link href="/" className="text-2xl font-bold text-amber-500">
          Karakas
        </Link>
        <div className="flex items-center gap-4">
          {username ? (
            <>
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsOpen(!isOpen)}
                  className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  <span>Menu</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                {isOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-zinc-900 border border-zinc-800 rounded-lg shadow-lg py-1 z-50">
                    <Link
                      href="/playgroups"
                      className={dropdownLinkClass("playgroups")}
                      onClick={() => setIsOpen(false)}
                    >
                      Playgroups
                    </Link>
                    <Link
                      href="/games"
                      className={dropdownLinkClass("games")}
                      onClick={() => setIsOpen(false)}
                    >
                      Games
                    </Link>
                    <Link
                      href="/decks"
                      className={dropdownLinkClass("decks")}
                      onClick={() => setIsOpen(false)}
                    >
                      Decks
                    </Link>
                    <Link
                      href="/stats"
                      className={dropdownLinkClass("stats")}
                      onClick={() => setIsOpen(false)}
                    >
                      Stats
                    </Link>
                    <Link
                      href="/friends"
                      className={dropdownLinkClass("friends")}
                      onClick={() => setIsOpen(false)}
                    >
                      Friends
                    </Link>
                  </div>
                )}
              </div>
              <span className="text-zinc-500">|</span>
              <span className="text-zinc-300">{username}</span>
              <form action={logoutUser} className="inline">
                <button
                  type="submit"
                  className="text-zinc-400 hover:text-zinc-100 transition-colors"
                >
                  Log out
                </button>
              </form>
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
