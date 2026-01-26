import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Header } from "@/components/header";
import { PlaygroupSettingsForm } from "./playgroup-settings-form";

export default async function PlaygroupSettingsPage({
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
        where: { userId: user.id },
        select: { role: true },
      },
    },
  });

  if (!playgroup) {
    notFound();
  }

  // Check if user is a member
  const membership = playgroup.members[0];
  if (!membership) {
    redirect("/playgroups");
  }

  // Check if user has permission to access settings (owner or admin)
  if (membership.role !== "owner" && membership.role !== "admin") {
    redirect(`/playgroups/${id}`);
  }

  const isOwner = playgroup.ownerId === user.id;

  return (
    <div className="min-h-screen flex flex-col">
      <Header activeTab="playgroups" />

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-xl mx-auto">
          <Link
            href={`/playgroups/${id}`}
            className="text-zinc-400 hover:text-zinc-300 text-sm"
          >
            ← Back to {playgroup.name}
          </Link>

          <div className="mt-4 mb-8">
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-zinc-400 mt-1">Manage playgroup settings</p>
          </div>

          <PlaygroupSettingsForm
            playgroup={{
              id: playgroup.id,
              name: playgroup.name,
              description: playgroup.description,
              defaultFormat: playgroup.defaultFormat,
            }}
            isOwner={isOwner}
          />
        </div>
      </main>
    </div>
  );
}
