"use server";

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { MtgFormat } from "@/types/mtg";

export type CreatePlaygroupInput = {
  name: string;
  description?: string;
  defaultFormat?: MtgFormat;
};

export async function createPlaygroup(input: CreatePlaygroupInput) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const { name, description, defaultFormat } = input;

  if (!name || name.trim().length === 0) {
    return { error: "Playgroup name is required" };
  }

  if (name.trim().length > 100) {
    return { error: "Playgroup name must be 100 characters or less" };
  }

  try {
    const playgroup = await db.playgroup.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        defaultFormat: defaultFormat || null,
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: "owner",
          },
        },
      },
    });

    return { playgroupId: playgroup.id };
  } catch {
    return { error: "Failed to create playgroup" };
  }
}

export async function updatePlaygroup(
  playgroupId: string,
  input: Partial<CreatePlaygroupInput>
) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  // Check if user is owner or admin
  const membership = await db.playgroupMember.findUnique({
    where: {
      playgroupId_userId: {
        playgroupId,
        userId: user.id,
      },
    },
  });

  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) {
    return { error: "You don't have permission to edit this playgroup" };
  }

  const { name, description, defaultFormat } = input;

  if (name !== undefined && name.trim().length === 0) {
    return { error: "Playgroup name is required" };
  }

  try {
    await db.playgroup.update({
      where: { id: playgroupId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(defaultFormat !== undefined && { defaultFormat: defaultFormat || null }),
      },
    });

    return { success: true };
  } catch {
    return { error: "Failed to update playgroup" };
  }
}

export async function deletePlaygroup(playgroupId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  // Only owner can delete
  const playgroup = await db.playgroup.findUnique({
    where: { id: playgroupId },
    select: { ownerId: true },
  });

  if (!playgroup) {
    return { error: "Playgroup not found" };
  }

  if (playgroup.ownerId !== user.id) {
    return { error: "Only the owner can delete this playgroup" };
  }

  try {
    await db.playgroup.delete({
      where: { id: playgroupId },
    });

    redirect("/playgroups");
  } catch {
    return { error: "Failed to delete playgroup" };
  }
}

export async function leavePlaygroup(playgroupId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const playgroup = await db.playgroup.findUnique({
    where: { id: playgroupId },
    select: { ownerId: true },
  });

  if (!playgroup) {
    return { error: "Playgroup not found" };
  }

  // Owner cannot leave - must transfer ownership first
  if (playgroup.ownerId === user.id) {
    return { error: "Owner cannot leave the playgroup. Transfer ownership first." };
  }

  try {
    await db.playgroupMember.delete({
      where: {
        playgroupId_userId: {
          playgroupId,
          userId: user.id,
        },
      },
    });

    redirect("/playgroups");
  } catch {
    return { error: "Failed to leave playgroup" };
  }
}

export async function inviteMember(playgroupId: string, email: string, role: string = "member") {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  // Check if user has permission to invite
  const membership = await db.playgroupMember.findUnique({
    where: {
      playgroupId_userId: {
        playgroupId,
        userId: user.id,
      },
    },
  });

  if (!membership || membership.role === "member") {
    return { error: "You don't have permission to invite members" };
  }

  // Find user by email
  const invitedUser = await db.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (!invitedUser) {
    // Create pending invitation
    const token = crypto.randomUUID();
    try {
      await db.playgroupInvitation.create({
        data: {
          playgroupId,
          email,
          token,
          role,
          invitedById: user.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      });
      return { success: true, pending: true };
    } catch {
      return { error: "An invitation for this email already exists" };
    }
  }

  // Check if already a member
  const existingMember = await db.playgroupMember.findUnique({
    where: {
      playgroupId_userId: {
        playgroupId,
        userId: invitedUser.id,
      },
    },
  });

  if (existingMember) {
    return { error: "User is already a member of this playgroup" };
  }

  // Add user directly
  try {
    await db.playgroupMember.create({
      data: {
        playgroupId,
        userId: invitedUser.id,
        role,
        invitedById: user.id,
      },
    });

    return { success: true };
  } catch {
    return { error: "Failed to add member" };
  }
}

export async function removeMember(playgroupId: string, userId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  // Check if user has permission
  const membership = await db.playgroupMember.findUnique({
    where: {
      playgroupId_userId: {
        playgroupId,
        userId: user.id,
      },
    },
  });

  if (!membership || membership.role === "member") {
    return { error: "You don't have permission to remove members" };
  }

  // Cannot remove the owner
  const playgroup = await db.playgroup.findUnique({
    where: { id: playgroupId },
    select: { ownerId: true },
  });

  if (playgroup?.ownerId === userId) {
    return { error: "Cannot remove the owner" };
  }

  try {
    await db.playgroupMember.delete({
      where: {
        playgroupId_userId: {
          playgroupId,
          userId,
        },
      },
    });

    return { success: true };
  } catch {
    return { error: "Failed to remove member" };
  }
}

export async function updateMemberRole(playgroupId: string, userId: string, newRole: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  // Only owner can change roles
  const playgroup = await db.playgroup.findUnique({
    where: { id: playgroupId },
    select: { ownerId: true },
  });

  if (!playgroup) {
    return { error: "Playgroup not found" };
  }

  if (playgroup.ownerId !== user.id) {
    return { error: "Only the owner can change member roles" };
  }

  // Cannot change owner's role
  if (playgroup.ownerId === userId) {
    return { error: "Cannot change the owner's role" };
  }

  if (!["admin", "member"].includes(newRole)) {
    return { error: "Invalid role" };
  }

  try {
    await db.playgroupMember.update({
      where: {
        playgroupId_userId: {
          playgroupId,
          userId,
        },
      },
      data: { role: newRole },
    });

    return { success: true };
  } catch {
    return { error: "Failed to update role" };
  }
}

export async function transferOwnership(playgroupId: string, newOwnerId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  // Only current owner can transfer
  const playgroup = await db.playgroup.findUnique({
    where: { id: playgroupId },
    select: { ownerId: true },
  });

  if (!playgroup) {
    return { error: "Playgroup not found" };
  }

  if (playgroup.ownerId !== user.id) {
    return { error: "Only the owner can transfer ownership" };
  }

  // New owner must be a member
  const newOwnerMembership = await db.playgroupMember.findUnique({
    where: {
      playgroupId_userId: {
        playgroupId,
        userId: newOwnerId,
      },
    },
  });

  if (!newOwnerMembership) {
    return { error: "New owner must be a member of the playgroup" };
  }

  try {
    await db.$transaction([
      // Update playgroup owner
      db.playgroup.update({
        where: { id: playgroupId },
        data: { ownerId: newOwnerId },
      }),
      // Update new owner's role
      db.playgroupMember.update({
        where: {
          playgroupId_userId: {
            playgroupId,
            userId: newOwnerId,
          },
        },
        data: { role: "owner" },
      }),
      // Update old owner's role to admin
      db.playgroupMember.update({
        where: {
          playgroupId_userId: {
            playgroupId,
            userId: user.id,
          },
        },
        data: { role: "admin" },
      }),
    ]);

    return { success: true };
  } catch {
    return { error: "Failed to transfer ownership" };
  }
}
