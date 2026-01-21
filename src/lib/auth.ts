import bcrypt from "bcryptjs";
import { db } from "./db";
import { createSession, getSession, deleteSession } from "./session";
import type { User } from "@/generated/prisma";

const SALT_ROUNDS = 12;

export type AuthUser = Omit<User, "passwordHash">;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signUp(
  email: string,
  username: string,
  password: string
): Promise<{ user: AuthUser } | { error: string }> {
  // Check if email already exists
  const existingEmail = await db.user.findUnique({ where: { email } });
  if (existingEmail) {
    return { error: "Email already in use" };
  }

  // Check if username already exists
  const existingUsername = await db.user.findUnique({ where: { username } });
  if (existingUsername) {
    return { error: "Username already taken" };
  }

  const passwordHash = await hashPassword(password);

  const user = await db.user.create({
    data: {
      email,
      username,
      passwordHash,
    },
  });

  await createSession(user.id);

  const { passwordHash: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword };
}

export async function signIn(
  email: string,
  password: string
): Promise<{ user: AuthUser } | { error: string }> {
  const user = await db.user.findUnique({ where: { email } });

  if (!user || !user.passwordHash) {
    return { error: "Invalid email or password" };
  }

  const isValid = await verifyPassword(password, user.passwordHash);

  if (!isValid) {
    return { error: "Invalid email or password" };
  }

  await createSession(user.id);

  const { passwordHash: _, ...userWithoutPassword } = user;
  return { user: userWithoutPassword };
}

export async function signOut(): Promise<void> {
  await deleteSession();
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const { passwordHash: _, ...userWithoutPassword } = session.user;
  return userWithoutPassword;
}
