import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
    return NextResponse.json({ error: "Playgroup not found" }, { status: 404 });
  }

  // Check if user is a member
  if (playgroup.members.length === 0) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const isOwner = playgroup.ownerId === user.id;

  return NextResponse.json({
    playgroup: {
      id: playgroup.id,
      name: playgroup.name,
      description: playgroup.description,
      defaultFormat: playgroup.defaultFormat,
      ownerId: playgroup.ownerId,
    },
    isOwner,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  // Check if user is owner or admin
  const membership = await db.playgroupMember.findUnique({
    where: {
      playgroupId_userId: {
        playgroupId: id,
        userId: user.id,
      },
    },
  });

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return NextResponse.json(
      { error: "You don't have permission to edit this playgroup" },
      { status: 403 }
    );
  }

  const body = await request.json();
  const { name, description, defaultFormat } = body;

  if (name !== undefined && (!name || name.trim().length === 0)) {
    return NextResponse.json(
      { error: "Playgroup name is required" },
      { status: 400 }
    );
  }

  try {
    const playgroup = await db.playgroup.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(defaultFormat !== undefined && { defaultFormat: defaultFormat || null }),
      },
    });

    return NextResponse.json({ playgroup });
  } catch {
    return NextResponse.json(
      { error: "Failed to update playgroup" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;

  // Only owner can delete
  const playgroup = await db.playgroup.findUnique({
    where: { id },
    select: { ownerId: true },
  });

  if (!playgroup) {
    return NextResponse.json({ error: "Playgroup not found" }, { status: 404 });
  }

  if (playgroup.ownerId !== user.id) {
    return NextResponse.json(
      { error: "Only the owner can delete this playgroup" },
      { status: 403 }
    );
  }

  try {
    await db.playgroup.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete playgroup" },
      { status: 500 }
    );
  }
}
