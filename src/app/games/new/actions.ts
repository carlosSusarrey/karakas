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
  playgroupPlayerId: string;
  playerName: string;
};

export type PlaygroupDeckData = {
  id: string;
  name: string;
  format: string;
  commander1: string | null;
  commander2: string | null;
  bracket: number | null;
  userId: string;
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
        playgroupPlayerId: p.id,
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
        playgroupPlayerId: p.id,
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
      userId: d.userId,
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
    userId: d.userId,
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
      playgroupPlayerId: p.id,
      playerName: p.name,
    }))
  );
}

export type SaveNewDeckInput = {
  playgroupId: string;
  playerType: "playgroup_member" | "playgroup_player";
  userId?: string;
  playgroupPlayerId?: string;
  format: MtgFormat;
  commander1: string;
  commander2?: string;
  bracket?: number;
};

export type SaveNewDeckResult =
  | { success: true; deckId: string; deckType: "deck" | "playgroupPlayerDeck" }
  | { error: string };

export async function saveNewDeckFromGame(
  input: SaveNewDeckInput
): Promise<SaveNewDeckResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  // Verify user is a member of the playgroup
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

  if (!input.commander1?.trim()) {
    return { error: "Commander name is required to save a deck" };
  }

  const deckName = input.commander1.trim();

  if (input.playerType === "playgroup_member") {
    if (!input.userId) {
      return { error: "User ID is required for member decks" };
    }

    try {
      const deck = await db.deck.create({
        data: {
          userId: input.userId,
          playgroupId: input.playgroupId,
          name: deckName,
          format: input.format,
          commander1: input.commander1.trim(),
          commander2: input.commander2?.trim() || null,
          bracket: input.bracket ?? null,
        },
      });
      return { success: true, deckId: deck.id, deckType: "deck" };
    } catch (error) {
      console.error("Failed to save new deck:", error);
      return { error: "Failed to save deck. Please try again." };
    }
  }

  if (input.playerType === "playgroup_player") {
    if (!input.playgroupPlayerId) {
      return { error: "Player ID is required for player decks" };
    }

    const player = await db.playgroupPlayer.findUnique({
      where: { id: input.playgroupPlayerId },
      select: { playgroupId: true },
    });

    if (!player || player.playgroupId !== input.playgroupId) {
      return { error: "Player not found in this playgroup" };
    }

    try {
      const deck = await db.playgroupPlayerDeck.create({
        data: {
          playgroupPlayerId: input.playgroupPlayerId,
          name: deckName,
          format: input.format,
          commander1: input.commander1.trim(),
          commander2: input.commander2?.trim() || null,
          bracket: input.bracket ?? null,
        },
      });
      return { success: true, deckId: deck.id, deckType: "playgroupPlayerDeck" };
    } catch (error) {
      console.error("Failed to save new player deck:", error);
      return { error: "Failed to save deck. Please try again." };
    }
  }

  return { error: "Invalid player type" };
}
