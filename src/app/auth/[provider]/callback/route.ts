import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { google, discord, apple, type OAuthProvider } from "@/lib/oauth";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";

interface OAuthUserInfo {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

async function getGoogleUser(code: string): Promise<OAuthUserInfo> {
  const cookieStore = await cookies();
  const codeVerifier = cookieStore.get("oauth_code_verifier")?.value;

  if (!codeVerifier || !google) {
    throw new Error("Missing code verifier or Google not configured");
  }

  const tokens = await google.validateAuthorizationCode(code, codeVerifier);
  const accessToken = tokens.accessToken();

  const response = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    throw new Error("Failed to fetch Google user info");
  }

  const data = await response.json();
  return {
    id: data.id,
    email: data.email,
    name: data.name,
    avatarUrl: data.picture,
  };
}

async function getDiscordUser(code: string): Promise<OAuthUserInfo> {
  const cookieStore = await cookies();
  const codeVerifier = cookieStore.get("oauth_code_verifier")?.value;

  if (!codeVerifier || !discord) {
    throw new Error("Missing code verifier or Discord not configured");
  }

  const tokens = await discord.validateAuthorizationCode(code, codeVerifier);
  const accessToken = tokens.accessToken();

  const response = await fetch("https://discord.com/api/users/@me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error("Failed to fetch Discord user info");
  }

  const data = await response.json();
  return {
    id: data.id,
    email: data.email,
    name: data.username,
    avatarUrl: data.avatar
      ? `https://cdn.discordapp.com/avatars/${data.id}/${data.avatar}.png`
      : undefined,
  };
}

async function getAppleUser(code: string): Promise<OAuthUserInfo> {
  if (!apple) {
    throw new Error("Apple not configured");
  }

  const tokens = await apple.validateAuthorizationCode(code);

  // Apple returns user info in the ID token
  // The ID token is a JWT, we need to decode it
  const idToken = tokens.idToken();
  const payload = JSON.parse(
    Buffer.from(idToken.split(".")[1], "base64").toString()
  );

  return {
    id: payload.sub,
    email: payload.email,
    // Apple only returns name on first authorization
    name: undefined,
    avatarUrl: undefined,
  };
}

async function findOrCreateUser(
  provider: OAuthProvider,
  userInfo: OAuthUserInfo
): Promise<string> {
  // Check if OAuth account already exists
  const existingOAuth = await db.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider,
        providerAccountId: userInfo.id,
      },
    },
    include: { user: true },
  });

  if (existingOAuth) {
    // Update avatar if available
    if (userInfo.avatarUrl && existingOAuth.user.avatarUrl !== userInfo.avatarUrl) {
      await db.user.update({
        where: { id: existingOAuth.userId },
        data: { avatarUrl: userInfo.avatarUrl },
      });
    }
    return existingOAuth.userId;
  }

  // Check if user with this email already exists
  const existingUser = await db.user.findUnique({
    where: { email: userInfo.email.toLowerCase() },
  });

  if (existingUser) {
    // Link OAuth account to existing user
    await db.oAuthAccount.create({
      data: {
        userId: existingUser.id,
        provider,
        providerAccountId: userInfo.id,
      },
    });
    return existingUser.id;
  }

  // Create new user with OAuth account
  const username = await generateUniqueUsername(userInfo.name || userInfo.email.split("@")[0]);

  const newUser = await db.user.create({
    data: {
      email: userInfo.email.toLowerCase(),
      username,
      avatarUrl: userInfo.avatarUrl,
      // passwordHash is null for OAuth-only users
      oauthAccounts: {
        create: {
          provider,
          providerAccountId: userInfo.id,
        },
      },
    },
  });

  return newUser.id;
}

async function generateUniqueUsername(baseName: string): Promise<string> {
  // Sanitize the base name
  let username = baseName
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 15);

  if (username.length < 3) {
    username = "user";
  }

  // Check if username exists
  const existing = await db.user.findUnique({ where: { username } });
  if (!existing) {
    return username;
  }

  // Add random suffix
  for (let i = 0; i < 10; i++) {
    const suffix = Math.floor(Math.random() * 10000);
    const newUsername = `${username}${suffix}`.slice(0, 20);
    const exists = await db.user.findUnique({ where: { username: newUsername } });
    if (!exists) {
      return newUsername;
    }
  }

  // Fallback with timestamp
  return `${username}${Date.now()}`.slice(0, 20);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Handle OAuth errors
  if (error) {
    console.error(`OAuth error from ${provider}:`, error);
    redirect(`/login?error=oauth_${error}`);
  }

  if (!code || !state) {
    redirect("/login?error=missing_params");
  }

  // Verify state
  const cookieStore = await cookies();
  const storedState = cookieStore.get(`oauth_state_${provider}`)?.value;

  if (!storedState || storedState !== state) {
    redirect("/login?error=invalid_state");
  }

  // Clean up state cookie
  cookieStore.delete(`oauth_state_${provider}`);

  try {
    let userInfo: OAuthUserInfo;

    switch (provider as OAuthProvider) {
      case "google":
        userInfo = await getGoogleUser(code);
        cookieStore.delete("oauth_code_verifier");
        break;
      case "discord":
        userInfo = await getDiscordUser(code);
        cookieStore.delete("oauth_code_verifier");
        break;
      case "apple":
        userInfo = await getAppleUser(code);
        break;
      default:
        redirect("/login?error=invalid_provider");
    }

    if (!userInfo.email) {
      redirect("/login?error=no_email");
    }

    // Find or create user and create session
    const userId = await findOrCreateUser(provider as OAuthProvider, userInfo);
    await createSession(userId);

    redirect("/");
  } catch (err: unknown) {
    // Re-throw Next.js internal errors (redirect, notFound use throw internally)
    if (err && typeof err === "object" && "digest" in err) {
      throw err;
    }
    console.error(`OAuth callback error for ${provider}:`, err);
    redirect("/login?error=oauth_failed");
  }
}
