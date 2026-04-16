import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function GET(request: NextRequest) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  const [sent, received] = await Promise.all([
    db.friendship.findMany({
      where: { requesterId: userId },
      include: {
        addressee: {
          select: { id: true, username: true, email: true, avatarUrl: true },
        },
      },
    }),
    db.friendship.findMany({
      where: { addresseeId: userId },
      include: {
        requester: {
          select: { id: true, username: true, email: true, avatarUrl: true },
        },
      },
    }),
  ]);

  const friends = [
    ...sent.filter((f) => f.status === "accepted").map((f) => ({
      friendshipId: f.id,
      user: f.addressee,
      status: f.status,
    })),
    ...received.filter((f) => f.status === "accepted").map((f) => ({
      friendshipId: f.id,
      user: f.requester,
      status: f.status,
    })),
  ];

  const pendingSent = sent
    .filter((f) => f.status === "pending")
    .map((f) => ({ friendshipId: f.id, user: f.addressee }));

  const pendingReceived = received
    .filter((f) => f.status === "pending")
    .map((f) => ({ friendshipId: f.id, user: f.requester }));

  return NextResponse.json({ friends, pendingSent, pendingReceived });
}
