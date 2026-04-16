"use server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function createPlaygroupPlayer(
  playgroupId: string,
  name: string,
  email?: string
) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  // Check if user is a member
  const membership = await db.playgroupMember.findUnique({
    where: {
      playgroupId_userId: {
        playgroupId,
        userId: user.id,
      },
    },
  });

  if (!membership) {
    return { error: "You are not a member of this playgroup" };
  }

  if (!name || name.trim().length === 0) {
    return { error: "Player name is required" };
  }

  try {
    const player = await db.playgroupPlayer.create({
      data: {
        playgroupId,
        name: name.trim(),
        email: email?.trim() || null,
      },
    });

    return { playerId: player.id };
  } catch {
    return { error: "Failed to create player" };
  }
}

export async function updatePlaygroupPlayer(
  playerId: string,
  name: string,
  email?: string
) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const player = await db.playgroupPlayer.findUnique({
    where: { id: playerId },
    select: { playgroupId: true },
  });

  if (!player) {
    return { error: "Player not found" };
  }

  // Check if user is a member
  const membership = await db.playgroupMember.findUnique({
    where: {
      playgroupId_userId: {
        playgroupId: player.playgroupId,
        userId: user.id,
      },
    },
  });

  if (!membership) {
    return { error: "You are not a member of this playgroup" };
  }

  if (!name || name.trim().length === 0) {
    return { error: "Player name is required" };
  }

  try {
    await db.playgroupPlayer.update({
      where: { id: playerId },
      data: {
        name: name.trim(),
        email: email?.trim() || null,
      },
    });

    return { success: true };
  } catch {
    return { error: "Failed to update player" };
  }
}

export async function deletePlaygroupPlayer(playerId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const player = await db.playgroupPlayer.findUnique({
    where: { id: playerId },
    include: {
      _count: { select: { gamePlayers: true } },
    },
  });

  if (!player) {
    return { error: "Player not found" };
  }

  // Check if user is admin or owner
  const membership = await db.playgroupMember.findUnique({
    where: {
      playgroupId_userId: {
        playgroupId: player.playgroupId,
        userId: user.id,
      },
    },
  });

  if (!membership || membership.role === "member") {
    return { error: "Only admins can delete players" };
  }

  // Check if player has game history
  if (player._count.gamePlayers > 0) {
    return { error: "Cannot delete player with game history. Consider linking them to an account instead." };
  }

  try {
    await db.playgroupPlayer.delete({
      where: { id: playerId },
    });

    return { success: true };
  } catch {
    return { error: "Failed to delete player" };
  }
}

export async function getPlaygroupPlayerStats(playerId: string) {
  const player = await db.playgroupPlayer.findUnique({
    where: { id: playerId },
    include: {
      gamePlayers: {
        include: {
          game: true,
        },
      },
    },
  });

  if (!player) {
    return null;
  }

  const gamesPlayed = player.gamePlayers.length;
  const wins = player.gamePlayers.filter((gp) => gp.isWinner).length;
  const firstOuts = player.gamePlayers.filter((gp) => gp.isFirstOut).length;

  return {
    gamesPlayed,
    wins,
    winRate: gamesPlayed > 0 ? Math.round((wins / gamesPlayed) * 100) : 0,
    firstOuts,
    firstOutRate: gamesPlayed > 0 ? Math.round((firstOuts / gamesPlayed) * 100) : 0,
  };
}

export async function sendClaimInvitation(playerId: string, email: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const player = await db.playgroupPlayer.findUnique({
    where: { id: playerId },
    include: {
      playgroup: true,
    },
  });

  if (!player) {
    return { error: "Player not found" };
  }

  // Check if already claimed
  if (player.linkedUserId) {
    return { error: "This player has already been claimed" };
  }

  // Check if user is a member of the playgroup
  const membership = await db.playgroupMember.findUnique({
    where: {
      playgroupId_userId: {
        playgroupId: player.playgroupId,
        userId: user.id,
      },
    },
  });

  if (!membership || membership.role === "member") {
    return { error: "Only admins can send claim invitations" };
  }

  // Generate claim token
  const token = crypto.randomUUID();

  try {
    // Delete any existing claim tokens for this player
    await db.playgroupPlayerClaimToken.deleteMany({
      where: { playgroupPlayerId: playerId },
    });

    // Create new claim token
    await db.playgroupPlayerClaimToken.create({
      data: {
        playgroupPlayerId: playerId,
        email: email.trim().toLowerCase(),
        token,
        invitedById: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Update player's email if not set
    if (!player.email) {
      await db.playgroupPlayer.update({
        where: { id: playerId },
        data: { email: email.trim().toLowerCase() },
      });
    }

    // In a real app, you would send an email here
    // For now, we'll just return the token URL for demo purposes
    return {
      success: true,
      claimUrl: `/claim/${token}`,
      message: `Claim invitation created. Share this link with ${email}: /claim/${token}`,
    };
  } catch {
    return { error: "Failed to create claim invitation" };
  }
}

export async function claimPlayer(token: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Please log in or create an account to claim this player", requiresAuth: true };
  }

  // Find the claim token
  const claimToken = await db.playgroupPlayerClaimToken.findUnique({
    where: { token },
    include: {
      playgroupPlayer: {
        include: {
          playgroup: true,
          decks: true,
          gamePlayers: true,
        },
      },
    },
  });

  if (!claimToken) {
    return { error: "Invalid or expired claim link" };
  }

  if (claimToken.expiresAt < new Date()) {
    return { error: "This claim link has expired" };
  }

  const player = claimToken.playgroupPlayer;

  // Check if already claimed
  if (player.linkedUserId) {
    return { error: "This player has already been claimed" };
  }

  // Check if user already has a linked player in this playgroup
  const existingLinkedPlayer = await db.playgroupPlayer.findFirst({
    where: {
      playgroupId: player.playgroupId,
      linkedUserId: user.id,
    },
  });

  if (existingLinkedPlayer) {
    return { error: "You already have a linked player in this playgroup" };
  }

  // Check if user is already a member of this playgroup
  const existingMembership = await db.playgroupMember.findUnique({
    where: {
      playgroupId_userId: {
        playgroupId: player.playgroupId,
        userId: user.id,
      },
    },
  });

  try {
    let decksCreated = 0;

    await db.$transaction(async (tx) => {
      // Link the player to the user
      await tx.playgroupPlayer.update({
        where: { id: player.id },
        data: { linkedUserId: user.id },
      });

      // If user is not a member, add them
      if (!existingMembership) {
        await tx.playgroupMember.create({
          data: {
            playgroupId: player.playgroupId,
            userId: user.id,
            role: "member",
          },
        });
      }

      // Update all game history to reference the user
      await tx.gamePlayer.updateMany({
        where: { playgroupPlayerId: player.id },
        data: { userId: user.id },
      });

      // Create user decks from playgroup player decks and link them
      for (const ppDeck of player.decks) {
        if (!ppDeck.linkedDeckId && ppDeck.isActive) {
          // Create a new user deck from the playgroup player deck
          const newDeck = await tx.deck.create({
            data: {
              userId: user.id,
              playgroupId: player.playgroupId,
              name: ppDeck.name,
              format: ppDeck.format,
              commander1: ppDeck.commander1,
              commander2: ppDeck.commander2,
              bracket: ppDeck.bracket,
              decklistUrl: ppDeck.decklistUrl,
              isActive: ppDeck.isActive,
            },
          });

          // Link the playgroup player deck to the new user deck
          await tx.playgroupPlayerDeck.update({
            where: { id: ppDeck.id },
            data: { linkedDeckId: newDeck.id },
          });

          // Update all game history to use the new deck
          await tx.gamePlayer.updateMany({
            where: { playgroupPlayerDeckId: ppDeck.id },
            data: { deckId: newDeck.id },
          });

          decksCreated++;
        }
      }

      // Delete the claim token
      await tx.playgroupPlayerClaimToken.delete({
        where: { id: claimToken.id },
      });
    });

    return {
      success: true,
      playgroupId: player.playgroupId,
      playgroupName: player.playgroup.name,
      gamesLinked: player.gamePlayers.length,
      decksLinked: decksCreated,
    };
  } catch (error) {
    console.error("Failed to claim player:", error);
    return { error: "Failed to claim player" };
  }
}

export async function getClaimTokenInfo(token: string) {
  const claimToken = await db.playgroupPlayerClaimToken.findUnique({
    where: { token },
    include: {
      playgroupPlayer: {
        include: {
          playgroup: {
            select: { id: true, name: true },
          },
          _count: {
            select: { gamePlayers: true, decks: true },
          },
        },
      },
    },
  });

  if (!claimToken) {
    return null;
  }

  if (claimToken.expiresAt < new Date()) {
    return { expired: true };
  }

  if (claimToken.playgroupPlayer.linkedUserId) {
    return { alreadyClaimed: true };
  }

  return {
    playerName: claimToken.playgroupPlayer.name,
    playgroupName: claimToken.playgroupPlayer.playgroup.name,
    playgroupId: claimToken.playgroupPlayer.playgroup.id,
    gamesPlayed: claimToken.playgroupPlayer._count.gamePlayers,
    decksCount: claimToken.playgroupPlayer._count.decks,
  };
}

export async function claimPlayerDirectly(playerId: string) {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  // Find the player with all related data
  const player = await db.playgroupPlayer.findUnique({
    where: { id: playerId },
    include: {
      playgroup: true,
      decks: true,
      gamePlayers: true,
    },
  });

  if (!player) {
    return { error: "Player not found" };
  }

  // Check if already claimed
  if (player.linkedUserId) {
    return { error: "This player has already been claimed" };
  }

  // Check if user is a member of the playgroup
  const membership = await db.playgroupMember.findUnique({
    where: {
      playgroupId_userId: {
        playgroupId: player.playgroupId,
        userId: user.id,
      },
    },
  });

  if (!membership) {
    return { error: "You must be a member of this playgroup to claim a player" };
  }

  // Check if user already has a linked player in this playgroup
  const existingLinkedPlayer = await db.playgroupPlayer.findFirst({
    where: {
      playgroupId: player.playgroupId,
      linkedUserId: user.id,
    },
  });

  if (existingLinkedPlayer) {
    return { error: "You already have a linked player in this playgroup" };
  }

  try {
    let decksCreated = 0;

    await db.$transaction(async (tx) => {
      // Link the player to the user
      await tx.playgroupPlayer.update({
        where: { id: player.id },
        data: { linkedUserId: user.id },
      });

      // Update all game history to reference the user
      await tx.gamePlayer.updateMany({
        where: { playgroupPlayerId: player.id },
        data: { userId: user.id },
      });

      // Create user decks from playgroup player decks and link them
      for (const ppDeck of player.decks) {
        if (!ppDeck.linkedDeckId && ppDeck.isActive) {
          // Create a new user deck from the playgroup player deck
          const newDeck = await tx.deck.create({
            data: {
              userId: user.id,
              playgroupId: player.playgroupId,
              name: ppDeck.name,
              format: ppDeck.format,
              commander1: ppDeck.commander1,
              commander2: ppDeck.commander2,
              bracket: ppDeck.bracket,
              decklistUrl: ppDeck.decklistUrl,
              isActive: ppDeck.isActive,
            },
          });

          // Link the playgroup player deck to the new user deck
          await tx.playgroupPlayerDeck.update({
            where: { id: ppDeck.id },
            data: { linkedDeckId: newDeck.id },
          });

          // Update all game history to use the new deck
          await tx.gamePlayer.updateMany({
            where: { playgroupPlayerDeckId: ppDeck.id },
            data: { deckId: newDeck.id },
          });

          decksCreated++;
        }
      }

      // Delete any existing claim tokens for this player
      await tx.playgroupPlayerClaimToken.deleteMany({
        where: { playgroupPlayerId: playerId },
      });
    });

    return {
      success: true,
      playgroupId: player.playgroupId,
      playgroupName: player.playgroup.name,
      gamesLinked: player.gamePlayers.length,
      decksLinked: decksCreated,
    };
  } catch (error) {
    console.error("Failed to claim player:", error);
    return { error: "Failed to claim player" };
  }
}
