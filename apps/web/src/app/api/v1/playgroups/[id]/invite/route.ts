import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/api-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await requireAuth(request);
  if (userId instanceof NextResponse) return userId;

  const { id } = await params;

  const membership = await db.playgroupMember.findUnique({
    where: { playgroupId_userId: { playgroupId: id, userId } },
  });

  if (!membership || !["owner", "admin"].includes(membership.role)) {
    return NextResponse.json({ error: "Not authorized to invite" }, { status: 403 });
  }

  const { email } = await request.json();
  if (!email?.trim()) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  // Check if user exists and is already a member
  const existingUser = await db.user.findUnique({ where: { email: email.trim() } });
  if (existingUser) {
    const existingMember = await db.playgroupMember.findUnique({
      where: { playgroupId_userId: { playgroupId: id, userId: existingUser.id } },
    });
    if (existingMember) {
      return NextResponse.json({ error: "User is already a member" }, { status: 400 });
    }

    // Add directly since user exists
    const member = await db.playgroupMember.create({
      data: {
        playgroupId: id,
        userId: existingUser.id,
        role: "member",
        invitedById: userId,
      },
    });

    return NextResponse.json({ member, directAdd: true }, { status: 201 });
  }

  // Create invitation token for non-existing user
  const token = crypto.randomUUID();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await db.playgroupInvitation.upsert({
    where: { playgroupId_email: { playgroupId: id, email: email.trim() } },
    update: { token, expiresAt, invitedById: userId },
    create: {
      playgroupId: id,
      email: email.trim(),
      token,
      invitedById: userId,
      expiresAt,
    },
  });

  return NextResponse.json({ invited: true, email: email.trim() }, { status: 201 });
}
