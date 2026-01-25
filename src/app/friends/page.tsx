import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FriendActions } from "./friend-actions";
import { AddFriendForm } from "./add-friend-form";

export default async function FriendsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // Get all friendships where user is involved
  const friendships = await db.friendship.findMany({
    where: {
      OR: [
        { requesterId: user.id },
        { addresseeId: user.id },
      ],
    },
    include: {
      requester: {
        select: { id: true, username: true, avatarUrl: true },
      },
      addressee: {
        select: { id: true, username: true, avatarUrl: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Separate into categories
  const acceptedFriends = friendships.filter((f) => f.status === "accepted");
  const pendingReceived = friendships.filter(
    (f) => f.status === "pending" && f.addresseeId === user.id
  );
  const pendingSent = friendships.filter(
    (f) => f.status === "pending" && f.requesterId === user.id
  );

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
              className="text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Decks
            </Link>
            <Link
              href="/stats"
              className="text-zinc-400 hover:text-zinc-100 transition-colors"
            >
              Stats
            </Link>
            <Link href="/friends" className="text-zinc-100 font-medium">
              Friends
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
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Friends</h1>
            <p className="text-zinc-400 mt-1">
              Connect with other players and view their stats
            </p>
          </div>

          {/* Add Friend Form */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-8">
            <h2 className="text-lg font-semibold mb-4">Add Friend</h2>
            <AddFriendForm />
          </div>

          {/* Pending Requests Received */}
          {pendingReceived.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4">
                Friend Requests ({pendingReceived.length})
              </h2>
              <div className="space-y-3">
                {pendingReceived.map((friendship) => {
                  const friend = friendship.requester;
                  return (
                    <div
                      key={friendship.id}
                      className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center text-lg">
                          {friend.avatarUrl ? (
                            <img
                              src={friend.avatarUrl}
                              alt={friend.username}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            friend.username[0].toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{friend.username}</div>
                          <div className="text-zinc-500 text-sm">
                            Wants to be your friend
                          </div>
                        </div>
                      </div>
                      <FriendActions
                        friendshipId={friendship.id}
                        type="received"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Friends List */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">
              Your Friends ({acceptedFriends.length})
            </h2>
            {acceptedFriends.length === 0 ? (
              <p className="text-zinc-500 text-center py-8">
                You haven&apos;t added any friends yet. Search by username or
                email above.
              </p>
            ) : (
              <div className="space-y-3">
                {acceptedFriends.map((friendship) => {
                  const friend =
                    friendship.requesterId === user.id
                      ? friendship.addressee
                      : friendship.requester;
                  return (
                    <div
                      key={friendship.id}
                      className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-4"
                    >
                      <Link
                        href={`/friends/${friend.id}`}
                        className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                      >
                        <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center text-lg">
                          {friend.avatarUrl ? (
                            <img
                              src={friend.avatarUrl}
                              alt={friend.username}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            friend.username[0].toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{friend.username}</div>
                          <div className="text-zinc-500 text-sm">
                            View stats →
                          </div>
                        </div>
                      </Link>
                      <FriendActions
                        friendshipId={friendship.id}
                        type="friend"
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pending Sent */}
          {pendingSent.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold mb-4 text-zinc-400">
                Pending Requests Sent ({pendingSent.length})
              </h2>
              <div className="space-y-3">
                {pendingSent.map((friendship) => {
                  const friend = friendship.addressee;
                  return (
                    <div
                      key={friendship.id}
                      className="flex items-center justify-between bg-zinc-800/50 rounded-lg p-4"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-700 rounded-full flex items-center justify-center text-lg">
                          {friend.avatarUrl ? (
                            <img
                              src={friend.avatarUrl}
                              alt={friend.username}
                              className="w-10 h-10 rounded-full"
                            />
                          ) : (
                            friend.username[0].toUpperCase()
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{friend.username}</div>
                          <div className="text-zinc-500 text-sm">
                            Request pending
                          </div>
                        </div>
                      </div>
                      <FriendActions
                        friendshipId={friendship.id}
                        type="sent"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
