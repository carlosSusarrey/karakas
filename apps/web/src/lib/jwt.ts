import { SignJWT, jwtVerify } from "jose";
import { db } from "./db";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "karakas-dev-jwt-secret-change-in-production"
);

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY_DAYS = 30;

export async function createAccessToken(userId: string): Promise<string> {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRY)
    .sign(JWT_SECRET);
}

export async function verifyAccessToken(
  token: string
): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.sub) return null;
    return { userId: payload.sub };
  } catch {
    return null;
  }
}

function generateRandomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function createRefreshToken(userId: string): Promise<string> {
  const token = generateRandomToken();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

  await db.refreshToken.create({
    data: { userId, token, expiresAt },
  });

  return token;
}

export async function verifyRefreshToken(
  token: string
): Promise<{ userId: string } | null> {
  const record = await db.refreshToken.findUnique({ where: { token } });
  if (!record) return null;
  if (record.expiresAt < new Date()) {
    // Expired — clean up
    await db.refreshToken.delete({ where: { id: record.id } });
    return null;
  }
  return { userId: record.userId };
}

export async function revokeRefreshToken(token: string): Promise<void> {
  await db.refreshToken.deleteMany({ where: { token } });
}

export async function createTokenPair(userId: string) {
  const [accessToken, refreshToken] = await Promise.all([
    createAccessToken(userId),
    createRefreshToken(userId),
  ]);
  return { accessToken, refreshToken };
}
