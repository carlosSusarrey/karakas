"use server";

import { cookies } from "next/headers";
import { encodeHexLowerCase } from "@oslojs/encoding";
import { sha256 } from "@oslojs/crypto/sha2";
import { db } from "./db";

const SESSION_COOKIE_NAME = "session";
const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days in seconds
const SESSION_MAX_AGE_MS = SESSION_MAX_AGE * 1000;

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return encodeHexLowerCase(bytes);
}

function hashToken(token: string): string {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = sha256(data);
  return encodeHexLowerCase(hash);
}

export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const hashedToken = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

  await db.session.create({
    data: {
      userId,
      token: hashedToken,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function getSession(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!token) {
    return null;
  }

  const hashedToken = hashToken(token);

  const session = await db.session.findUnique({
    where: { token: hashedToken },
  });

  if (!session || session.expiresAt < new Date()) {
    // Clean up expired session if it exists
    if (session) {
      await db.session.delete({ where: { id: session.id } });
    }
    // Clear the stale cookie
    cookieStore.delete(SESSION_COOKIE_NAME);
    return null;
  }

  return session.userId;
}

export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (token) {
    const hashedToken = hashToken(token);
    await db.session.deleteMany({ where: { token: hashedToken } });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function deleteAllUserSessions(userId: string): Promise<void> {
  await db.session.deleteMany({ where: { userId } });
}
