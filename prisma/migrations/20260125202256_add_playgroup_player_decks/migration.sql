-- CreateTable
CREATE TABLE "Playgroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultFormat" TEXT,
    "ownerId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Playgroup_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlaygroupMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playgroupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invitedById" TEXT,
    CONSTRAINT "PlaygroupMember_playgroupId_fkey" FOREIGN KEY ("playgroupId") REFERENCES "Playgroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlaygroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlaygroupMember_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlaygroupPlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playgroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "linkedUserId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlaygroupPlayer_playgroupId_fkey" FOREIGN KEY ("playgroupId") REFERENCES "Playgroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlaygroupPlayer_linkedUserId_fkey" FOREIGN KEY ("linkedUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlaygroupPlayerDeck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playgroupPlayerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "commander1" TEXT,
    "commander2" TEXT,
    "bracket" INTEGER,
    "decklistUrl" TEXT,
    "linkedDeckId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PlaygroupPlayerDeck_playgroupPlayerId_fkey" FOREIGN KEY ("playgroupPlayerId") REFERENCES "PlaygroupPlayer" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PlaygroupPlayerDeck_linkedDeckId_fkey" FOREIGN KEY ("linkedDeckId") REFERENCES "Deck" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlaygroupInvitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "playgroupId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "invitedById" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Deck" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "playgroupId" TEXT,
    "name" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "commander1" TEXT,
    "commander2" TEXT,
    "bracket" INTEGER,
    "decklistUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Deck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Deck_playgroupId_fkey" FOREIGN KEY ("playgroupId") REFERENCES "Playgroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Deck" ("bracket", "commander1", "commander2", "createdAt", "decklistUrl", "format", "id", "isActive", "name", "updatedAt", "userId") SELECT "bracket", "commander1", "commander2", "createdAt", "decklistUrl", "format", "id", "isActive", "name", "updatedAt", "userId" FROM "Deck";
DROP TABLE "Deck";
ALTER TABLE "new_Deck" RENAME TO "Deck";
CREATE TABLE "new_Game" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdById" TEXT NOT NULL,
    "playgroupId" TEXT,
    "format" TEXT NOT NULL,
    "totalTurns" INTEGER,
    "notes" TEXT,
    "playedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Game_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Game_playgroupId_fkey" FOREIGN KEY ("playgroupId") REFERENCES "Playgroup" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Game" ("createdAt", "createdById", "format", "id", "notes", "playedAt", "totalTurns", "updatedAt") SELECT "createdAt", "createdById", "format", "id", "notes", "playedAt", "totalTurns", "updatedAt" FROM "Game";
DROP TABLE "Game";
ALTER TABLE "new_Game" RENAME TO "Game";
CREATE TABLE "new_GamePlayer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "userId" TEXT,
    "playgroupPlayerId" TEXT,
    "deckId" TEXT,
    "playgroupPlayerDeckId" TEXT,
    "guestName" TEXT,
    "commanderUsed1" TEXT,
    "commanderUsed2" TEXT,
    "bracketUsed" INTEGER,
    "placement" INTEGER,
    "isWinner" BOOLEAN NOT NULL DEFAULT false,
    "isFirstOut" BOOLEAN NOT NULL DEFAULT false,
    "eliminatedTurn" INTEGER,
    CONSTRAINT "GamePlayer_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GamePlayer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GamePlayer_playgroupPlayerId_fkey" FOREIGN KEY ("playgroupPlayerId") REFERENCES "PlaygroupPlayer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GamePlayer_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "GamePlayer_playgroupPlayerDeckId_fkey" FOREIGN KEY ("playgroupPlayerDeckId") REFERENCES "PlaygroupPlayerDeck" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_GamePlayer" ("bracketUsed", "commanderUsed1", "commanderUsed2", "deckId", "eliminatedTurn", "gameId", "guestName", "id", "isFirstOut", "isWinner", "placement", "userId") SELECT "bracketUsed", "commanderUsed1", "commanderUsed2", "deckId", "eliminatedTurn", "gameId", "guestName", "id", "isFirstOut", "isWinner", "placement", "userId" FROM "GamePlayer";
DROP TABLE "GamePlayer";
ALTER TABLE "new_GamePlayer" RENAME TO "GamePlayer";
CREATE UNIQUE INDEX "GamePlayer_gameId_userId_key" ON "GamePlayer"("gameId", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PlaygroupMember_playgroupId_userId_key" ON "PlaygroupMember"("playgroupId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaygroupPlayer_linkedUserId_key" ON "PlaygroupPlayer"("linkedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaygroupPlayerDeck_linkedDeckId_key" ON "PlaygroupPlayerDeck"("linkedDeckId");

-- CreateIndex
CREATE UNIQUE INDEX "PlaygroupInvitation_token_key" ON "PlaygroupInvitation"("token");

-- CreateIndex
CREATE UNIQUE INDEX "PlaygroupInvitation_playgroupId_email_key" ON "PlaygroupInvitation"("playgroupId", "email");
