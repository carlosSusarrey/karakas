import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import path from "path";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getDatabaseUrl(): string {
  const dbUrl = process.env.DATABASE_URL || "file:./dev.db";

  // If it's already an absolute path, return as-is
  if (dbUrl.includes("/Users/") || dbUrl.startsWith("file:/")) {
    return dbUrl;
  }

  // Extract path from file: URL
  const dbPath = dbUrl.startsWith("file:") ? dbUrl.slice(5) : dbUrl;

  // Resolve relative to cwd
  const absolutePath = path.resolve(process.cwd(), dbPath);

  return `file:${absolutePath}`;
}

function createPrismaClient() {
  const url = getDatabaseUrl();
  console.log("[Prisma] Using database:", url);

  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
