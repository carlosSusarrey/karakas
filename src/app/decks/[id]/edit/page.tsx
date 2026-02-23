import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Header } from "@/components/header";
import { EditDeckForm } from "./edit-deck-form";

export default async function EditDeckPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  const deck = await db.deck.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      format: true,
      commander1: true,
      commander2: true,
      bracket: true,
      decklistUrl: true,
      userId: true,
    },
  });

  if (!deck || deck.userId !== user.id) {
    notFound();
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header username={user.username} activeTab="decks" />

      {/* Main Content */}
      <main className="flex-1 px-6 py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <Link
              href={`/decks/${id}`}
              className="text-zinc-400 hover:text-zinc-300 text-sm"
            >
              ← Back to Deck
            </Link>
            <h1 className="text-3xl font-bold mt-4">Edit Deck</h1>
          </div>

          <EditDeckForm deck={deck} />
        </div>
      </main>
    </div>
  );
}
