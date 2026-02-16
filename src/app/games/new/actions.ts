"use server";

import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { MtgFormat } from "@/types/mtg";

export type PlayerSetup = {
  id: string;
  type: "user" | "guest" | "playgroup_member" | "playgroup_player";
  userId?: string;
  playgroupPlayerId?: string;
  guestName?: string;
  deckId?: string;
  playgroupPlayerDeckId?: string;
  commanderUsed1?: string;
  commanderUsed2?: string;
  bracketUsed?: number;
};

export type CreateGameInput = {
  format: MtgFormat;
  playgroupId?: string;
  players: PlayerSetup[];
};

// Types for playgroup data
export type PlaygroupMemberData = {
  id: string;
  username: string;
};

export type PlaygroupPlayerData = {
  id: string;
  name: string;
  decks: PlaygroupPlayerDeckData[];
};

export type PlaygroupPlayerDeckData = {
  id: string;
  name: string;
  format: string;
  commander1: string | null;
  commander2: string | null;
  bracket: number | null;
  playerName: string;
};

export type PlaygroupDeckData = {
  id: string;
  name: string;
  format: string;
  commander1: string | null;
  commander2: string | null;
  bracket: number | null;
  createdBy: { username: string };
};

export type PlaygroupData = {
  id: string;
  name: string;
  defaultFormat: string | null;
  members: PlaygroupMemberData[];
  players: PlaygroupPlayerData[];
  decks: PlaygroupDeckData[];
  playerDecks: PlaygroupPlayerDeckData[];
};

export async function createGame(
  input: CreateGameInput
): Promise<{ success: true; gameId: string } | { error: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  // Validate input
  if (!input.format) {
    return { error: "Format is required" };
  }

  if (!input.players || input.players.length < 2) {
    return { error: "At least 2 players are required" };
  }

  // If playgroup is specified, verify user is a member
  if (input.playgroupId) {
    const membership = await db.playgroupMember.findUnique({
      where: {
        playgroupId_userId: {
          playgroupId: input.playgroupId,
          userId: user.id,
        },
      },
    });
    if (!membership) {
      return { error: "You are not a member of this playgroup" };
    }
  }

  // Validate each player has identification
  for (const player of input.players) {
    if (player.type === "playgroup_member" && !player.userId) {
      return { error: "Playgroup members must have a user ID" };
    }
    if (player.type === "playgroup_player" && !player.playgroupPlayerId) {
      return { error: "Playgroup players must have a player ID" };
    }
    if (player.type === "guest" && !player.guestName?.trim()) {
      return { error: "Guest players must have a name" };
    }
  }

  try {
    // Create the game with players in a transaction
    const game = await db.game.create({
      data: {
        createdById: user.id,
        playgroupId: input.playgroupId || null,
        format: input.format,
        totalTurns: 0,
        players: {
          create: input.players.map((player) => ({
            userId: player.type === "playgroup_member" ? player.userId : null,
            playgroupPlayerId: player.type === "playgroup_player" ? player.playgroupPlayerId : null,
            guestName: player.type === "guest" ? player.guestName : null,
            deckId: player.deckId || null,
            playgroupPlayerDeckId: player.playgroupPlayerDeckId || null,
            commanderUsed1: player.commanderUsed1 || null,
            commanderUsed2: player.commanderUsed2 || null,
            bracketUsed: player.bracketUsed || null,
          })),
        },
      },
    });

    return { success: true, gameId: game.id };
  } catch (error) {
    console.error("Failed to create game:", error);
    return { error: "Failed to create game. Please try again." };
  }
}

export async function getUserDecks(format?: string) {
  const user = await getCurrentUser();
  if (!user) {
    return [];
  }

  const decks = await db.deck.findMany({
    where: {
      userId: user.id,
      isActive: true,
      ...(format && { format }),
    },
    orderBy: { name: "asc" },
  });

  return decks;
}

export async function getPlaygroupData(playgroupId: string): Promise<PlaygroupData | null> {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  // Verify user is a member of this playgroup
  const membership = await db.playgroupMember.findUnique({
    where: {
      playgroupId_userId: {
        playgroupId,
        userId: user.id,
      },
    },
  });

  if (!membership) {
    return null;
  }

  const playgroup = await db.playgroup.findUnique({
    where: { id: playgroupId },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, username: true },
          },
        },
        orderBy: { joinedAt: "asc" },
      },
      players: {
        where: { linkedUserId: null }, // Only unlinked players
        include: {
          decks: {
            where: { isActive: true },
            orderBy: { name: "asc" },
          },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!playgroup) {
    return null;
  }

  // Get member user IDs and fetch their decks separately
  const memberUserIds = playgroup.members.map((m) => m.user.id);
  const memberDecks = await db.deck.findMany({
    where: {
      userId: { in: memberUserIds },
      isActive: true,
    },
    include: {
      user: {
        select: { username: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return {
    id: playgroup.id,
    name: playgroup.name,
    defaultFormat: playgroup.defaultFormat,
    members: playgroup.members.map((m) => ({
      id: m.user.id,
      username: m.user.username,
    })),
    players: playgroup.players.map((p) => ({
      id: p.id,
      name: p.name,
      decks: p.decks.map((d) => ({
        id: d.id,
        name: d.name,
        format: d.format,
        commander1: d.commander1,
        commander2: d.commander2,
        bracket: d.bracket,
        playerName: p.name,
      })),
    })),
    playerDecks: playgroup.players.flatMap((p) =>
      p.decks.map((d) => ({
        id: d.id,
        name: d.name,
        format: d.format,
        commander1: d.commander1,
        commander2: d.commander2,
        bracket: d.bracket,
        playerName: p.name,
      }))
    ),
    decks: memberDecks.map((d) => ({
      id: d.id,
      name: d.name,
      format: d.format,
      commander1: d.commander1,
      commander2: d.commander2,
      bracket: d.bracket,
      createdBy: { username: d.user.username },
    })),
  };
}

export async function getPlaygroupDecks(playgroupId: string, format?: string): Promise<PlaygroupDeckData[]> {
  const user = await getCurrentUser();
  if (!user) {
    return [];
  }

  // Verify user is a member and get all member user IDs
  const members = await db.playgroupMember.findMany({
    where: { playgroupId },
    select: { userId: true },
  });

  const memberUserIds = members.map((m) => m.userId);

  // Check if current user is a member
  if (!memberUserIds.includes(user.id)) {
    return [];
  }

  // Fetch decks owned by any playgroup member
  const decks = await db.deck.findMany({
    where: {
      userId: { in: memberUserIds },
      isActive: true,
      ...(format && { format }),
    },
    include: {
      user: {
        select: { username: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return decks.map((d) => ({
    id: d.id,
    name: d.name,
    format: d.format,
    commander1: d.commander1,
    commander2: d.commander2,
    bracket: d.bracket,
    createdBy: { username: d.user.username },
  }));
}

export async function getPlaygroupPlayerDecks(playgroupId: string, format?: string): Promise<PlaygroupPlayerDeckData[]> {
  const user = await getCurrentUser();
  if (!user) {
    return [];
  }

  // Verify user is a member
  const membership = await db.playgroupMember.findUnique({
    where: {
      playgroupId_userId: {
        playgroupId,
        userId: user.id,
      },
    },
  });

  if (!membership) {
    return [];
  }

  const players = await db.playgroupPlayer.findMany({
    where: {
      playgroupId,
      linkedUserId: null, // Only unlinked players
    },
    include: {
      decks: {
        where: {
          isActive: true,
          ...(format && { format }),
        },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });

  return players.flatMap((p) =>
    p.decks.map((d) => ({
      id: d.id,
      name: d.name,
      format: d.format,
      commander1: d.commander1,
      commander2: d.commander2,
      bracket: d.bracket,
      playerName: p.name,
    }))
  );
}
