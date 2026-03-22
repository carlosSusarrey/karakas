-- CreateTable
CREATE TABLE "GamePlayLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "gameId" TEXT NOT NULL,
    "gamePlayerId" TEXT NOT NULL,
    "turnNumber" INTEGER NOT NULL,
    "lifeTotal" INTEGER,
    "lifeDelta" INTEGER,
    "landsPlayed" INTEGER,
    "spellsCast" INTEGER,
    "creaturesAttacked" INTEGER,
    "commanderDamageDealt" INTEGER,
    "manaSpent" INTEGER,
    "attackedPlayerIds" TEXT,
    "eliminatedPlayerIds" TEXT,
    "cardsPlayed" TEXT,
    "summary" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GamePlayLog_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GamePlayLog_gamePlayerId_fkey" FOREIGN KEY ("gamePlayerId") REFERENCES "GamePlayer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GamePlayLog_gameId_gamePlayerId_turnNumber_key" ON "GamePlayLog"("gameId", "gamePlayerId", "turnNumber");
