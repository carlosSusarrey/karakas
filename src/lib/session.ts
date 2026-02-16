import { cookies } from "next/headers";
import { db } from "./db";

const SESSION_COOKIE_NAME = "karakas_session";
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export async function createSession(userId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  const session = await db.session.create({
    data: {
      userId,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expiresAt,
    path: "/",
  });

  return session.id;
}

export async function getSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionId) {
    return null;
  }

  try {
    const session = await db.session.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      // Session expired or not found — clean up stale cookie
      if (session) {
        await db.session.delete({ where: { id: sessionId } }).catch(() => {});
      }
      cookieStore.delete(SESSION_COOKIE_NAME);
      return null;
    }

    return session;
  } catch (error) {
    // Log but don't throw — treat DB errors as "no session" to avoid
    // crashing server actions and causing silent failures on the client
    console.error("Failed to look up session:", error);
    return null;
  }
}

export async function deleteSession() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionId) {
    await db.session.delete({ where: { id: sessionId } }).catch(() => {
      // Session might already be deleted
    });
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.userId ?? null;
}
