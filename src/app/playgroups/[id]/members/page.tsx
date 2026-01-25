import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { MemberActions } from "./member-actions";
import { InviteForm } from "./invite-form";

export default async function PlaygroupMembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  const playgroup = await db.playgroup.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: { select: { id: true, username: true, email: true } },
          invitedBy: { select: { username: true } },
        },
        orderBy: [{ role: "asc" }, { joinedAt: "asc" }],
      },
    },
  });

  if (!playgroup) {
    notFound();
  }

  // Check if user is a member
  const membership = playgroup.members.find((m) => m.userId === user.id);
  if (!membership) {
    notFound();
  }

  const isOwner = playgroup.ownerId === user.id;
  const isAdmin = membership.role === "admin" || isOwner;

  // Get pending invitations
  const pendingInvitations = await db.playgroupInvitation.findMany({
    where: {
      playgroupId: id,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  function formatDate(date: Date) {
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(date);
  }

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
            <span className="text-zinc-500">|</span>
            <span className="text-zinc-300">{user.username}</span>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Breadcrumb */}
          <Link
            href={`/playgroups/${id}`}
            className="text-zinc-400 hover:text-zinc-300 text-sm"
          >
            ← Back to {playgroup.name}
          </Link>

          <div className="mt-4 mb-8">
            <h1 className="text-3xl font-bold">Members</h1>
            <p className="text-zinc-400 mt-1">
              Manage members of {playgroup.name}
            </p>
          </div>

          {/* Invite Form (for admins/owners) */}
          {isAdmin && (
            <div className="mb-8">
              <InviteForm playgroupId={id} isOwner={isOwner} />
            </div>
          )}

          {/* Pending Invitations */}
          {isAdmin && pendingInvitations.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">Pending Invitations</h2>
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
                {pendingInvitations.map((invitation) => (
                  <div
                    key={invitation.id}
                    className="p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-zinc-300">{invitation.email}</p>
                      <p className="text-zinc-500 text-sm">
                        Invited as {invitation.role} · Expires{" "}
                        {formatDate(invitation.expiresAt)}
                      </p>
                    </div>
                    <span className="text-xs bg-amber-900/50 text-amber-400 px-2 py-1 rounded">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Member List */}
          <div>
            <h2 className="text-lg font-semibold mb-4">
              Members ({playgroup.members.length})
            </h2>
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl divide-y divide-zinc-800">
              {playgroup.members.map((member) => {
                const isCurrentUser = member.userId === user.id;
                const canManage = isAdmin && !isCurrentUser && member.role !== "owner";
                const canChangeRole = isOwner && !isCurrentUser && member.role !== "owner";

                return (
                  <div
                    key={member.id}
                    className="p-4 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-zinc-100 font-medium">
                          {member.user.username}
                        </span>
                        {isCurrentUser && (
                          <span className="text-zinc-500 text-xs">(you)</span>
                        )}
                        <span
                          className={`text-xs px-2 py-0.5 rounded capitalize ${
                            member.role === "owner"
                              ? "bg-amber-900/50 text-amber-400"
                              : member.role === "admin"
                              ? "bg-zinc-700 text-zinc-300"
                              : "bg-zinc-800 text-zinc-400"
                          }`}
                        >
                          {member.role}
                        </span>
                      </div>
                      <p className="text-zinc-500 text-sm">
                        {member.user.email}
                        {member.invitedBy && (
                          <> · Invited by {member.invitedBy.username}</>
                        )}
                      </p>
                      <p className="text-zinc-600 text-xs">
                        Joined {formatDate(member.joinedAt)}
                      </p>
                    </div>
                    {(canManage || canChangeRole) && (
                      <MemberActions
                        playgroupId={id}
                        userId={member.userId}
                        username={member.user.username}
                        currentRole={member.role}
                        canChangeRole={canChangeRole}
                        canRemove={canManage}
                        isOwner={isOwner}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Leave Playgroup (for non-owners) */}
          {!isOwner && (
            <div className="mt-8 pt-8 border-t border-zinc-800">
              <h2 className="text-lg font-semibold mb-2 text-red-400">
                Leave Playgroup
              </h2>
              <p className="text-zinc-400 text-sm mb-4">
                You can rejoin if invited again.
              </p>
              <MemberActions
                playgroupId={id}
                userId={user.id}
                username={user.username}
                currentRole={membership.role}
                canChangeRole={false}
                canRemove={false}
                isOwner={false}
                showLeaveButton
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
