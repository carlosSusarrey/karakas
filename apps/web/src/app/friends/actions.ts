"use server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function sendFriendRequest(usernameOrEmail: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  if (!usernameOrEmail || usernameOrEmail.trim().length === 0) {
    return { error: "Username or email is required" };
  }

  const searchTerm = usernameOrEmail.trim().toLowerCase();

  // Find the target user (SQLite is case-insensitive by default for LIKE, but we use exact match)
  // We search for both username and email since SQLite default collation is case-insensitive
  const targetUser = await db.user.findFirst({
    where: {
      OR: [
        { username: searchTerm },
        { email: searchTerm },
      ],
    },
  });

  if (!targetUser) {
    return { error: "User not found" };
  }

  if (targetUser.id === user.id) {
    return { error: "You cannot add yourself as a friend" };
  }

  // Check if friendship already exists (in either direction)
  const existingFriendship = await db.friendship.findFirst({
    where: {
      OR: [
        { requesterId: user.id, addresseeId: targetUser.id },
        { requesterId: targetUser.id, addresseeId: user.id },
      ],
    },
  });

  if (existingFriendship) {
    if (existingFriendship.status === "accepted") {
      return { error: "You are already friends with this user" };
    }
    if (existingFriendship.status === "pending") {
      if (existingFriendship.requesterId === user.id) {
        return { error: "Friend request already sent" };
      } else {
        // They sent us a request, accept it instead
        await db.friendship.update({
          where: { id: existingFriendship.id },
          data: { status: "accepted" },
        });
        revalidatePath("/friends");
        return { success: true, message: "Friend request accepted" };
      }
    }
    if (existingFriendship.status === "declined") {
      // Allow resending after decline
      await db.friendship.update({
        where: { id: existingFriendship.id },
        data: { requesterId: user.id, addresseeId: targetUser.id, status: "pending" },
      });
      revalidatePath("/friends");
      return { success: true };
    }
  }

  // Create new friend request
  await db.friendship.create({
    data: {
      requesterId: user.id,
      addresseeId: targetUser.id,
      status: "pending",
    },
  });

  revalidatePath("/friends");
  return { success: true };
}

export async function acceptFriendRequest(friendshipId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const friendship = await db.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship) {
    return { error: "Friend request not found" };
  }

  if (friendship.addresseeId !== user.id) {
    return { error: "You cannot accept this request" };
  }

  if (friendship.status !== "pending") {
    return { error: "This request has already been processed" };
  }

  await db.friendship.update({
    where: { id: friendshipId },
    data: { status: "accepted" },
  });

  revalidatePath("/friends");
  return { success: true };
}

export async function declineFriendRequest(friendshipId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const friendship = await db.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship) {
    return { error: "Friend request not found" };
  }

  if (friendship.addresseeId !== user.id) {
    return { error: "You cannot decline this request" };
  }

  await db.friendship.update({
    where: { id: friendshipId },
    data: { status: "declined" },
  });

  revalidatePath("/friends");
  return { success: true };
}

export async function removeFriend(friendshipId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const friendship = await db.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship) {
    return { error: "Friendship not found" };
  }

  if (friendship.requesterId !== user.id && friendship.addresseeId !== user.id) {
    return { error: "You are not part of this friendship" };
  }

  await db.friendship.delete({
    where: { id: friendshipId },
  });

  revalidatePath("/friends");
  return { success: true };
}

export async function cancelFriendRequest(friendshipId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const friendship = await db.friendship.findUnique({
    where: { id: friendshipId },
  });

  if (!friendship) {
    return { error: "Friend request not found" };
  }

  if (friendship.requesterId !== user.id) {
    return { error: "You can only cancel your own requests" };
  }

  if (friendship.status !== "pending") {
    return { error: "This request is no longer pending" };
  }

  await db.friendship.delete({
    where: { id: friendshipId },
  });

  revalidatePath("/friends");
  return { success: true };
}
