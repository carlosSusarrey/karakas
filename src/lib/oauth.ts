import { Google, Discord, Apple } from "arctic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

// Google OAuth
export const google = process.env.GOOGLE_CLIENT_ID
  ? new Google(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET!,
      `${APP_URL}/auth/google/callback`
    )
  : null;

// Discord OAuth
export const discord = process.env.DISCORD_CLIENT_ID
  ? new Discord(
      process.env.DISCORD_CLIENT_ID,
      process.env.DISCORD_CLIENT_SECRET!,
      `${APP_URL}/auth/discord/callback`
    )
  : null;

// Apple OAuth - requires private key as Uint8Array
function createAppleClient(): Apple | null {
  const clientId = process.env.APPLE_CLIENT_ID;
  const teamId = process.env.APPLE_TEAM_ID;
  const keyId = process.env.APPLE_KEY_ID;
  const privateKey = process.env.APPLE_PRIVATE_KEY;

  if (!clientId || !teamId || !keyId || !privateKey) {
    return null;
  }

  // Convert PEM private key string to Uint8Array
  const privateKeyBytes = new TextEncoder().encode(privateKey);

  return new Apple(
    clientId,
    teamId,
    keyId,
    privateKeyBytes,
    `${APP_URL}/auth/apple/callback`
  );
}

export const apple = createAppleClient();

export type OAuthProvider = "google" | "discord" | "apple";

export const OAUTH_PROVIDERS: Record<
  OAuthProvider,
  { name: string; enabled: boolean }
> = {
  google: { name: "Google", enabled: !!google },
  discord: { name: "Discord", enabled: !!discord },
  apple: { name: "Apple", enabled: !!apple },
};

export function getEnabledProviders(): OAuthProvider[] {
  return (Object.keys(OAUTH_PROVIDERS) as OAuthProvider[]).filter(
    (provider) => OAUTH_PROVIDERS[provider].enabled
  );
}
