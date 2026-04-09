import { generateState, generateCodeVerifier } from "arctic";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { google, discord, apple, type OAuthProvider } from "@/lib/oauth";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  if (!["google", "discord", "apple"].includes(provider)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  const oauthProvider = provider as OAuthProvider;
  const state = generateState();
  const cookieStore = await cookies();

  // Store state in cookie for verification
  cookieStore.set(`oauth_state_${provider}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10, // 10 minutes
    path: "/",
  });

  let url: URL;

  switch (oauthProvider) {
    case "google": {
      if (!google) {
        return NextResponse.json(
          { error: "Google OAuth not configured" },
          { status: 500 }
        );
      }
      const codeVerifier = generateCodeVerifier();
      cookieStore.set("oauth_code_verifier_google", codeVerifier, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 10,
        path: "/",
      });
      url = google.createAuthorizationURL(state, codeVerifier, [
        "openid",
        "email",
        "profile",
      ]);
      break;
    }

    case "discord": {
      if (!discord) {
        return NextResponse.json(
          { error: "Discord OAuth not configured" },
          { status: 500 }
        );
      }
      const discordCodeVerifier = generateCodeVerifier();
      cookieStore.set("oauth_code_verifier_discord", discordCodeVerifier, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 10,
        path: "/",
      });
      url = discord.createAuthorizationURL(state, discordCodeVerifier, ["identify", "email"]);
      break;
    }

    case "apple": {
      if (!apple) {
        return NextResponse.json(
          { error: "Apple OAuth not configured" },
          { status: 500 }
        );
      }
      // Apple doesn't use PKCE, pass null for code verifier
      url = apple.createAuthorizationURL(state, ["email", "name"]);
      break;
    }

    default:
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }

  return NextResponse.redirect(url);
}
