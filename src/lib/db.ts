import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDatabasePath(): string {
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";

  // Extract path from file: URL
  const dbPath = dbUrl.startsWith("file:") ? dbUrl.slice(5) : dbUrl;

  // If it's already an absolute path, return as-is
  if (dbPath.startsWith("/")) {
    return dbPath;
  }

  // Resolve relative to cwd
  return path.resolve(process.cwd(), dbPath);
}

function createPrismaClient() {
  const dbPath = getDatabasePath();
  console.log("[Prisma] Using database:", dbPath);

  // Explicitly set readonly: false to ensure write access
  const adapter = new PrismaBetterSqlite3({ url: dbPath, readonly: false });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
