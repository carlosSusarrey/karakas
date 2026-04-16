import type {
  AuthResponse,
  RefreshResponse,
  ApiError,
} from "@karakas/shared";
import { getTokens, setTokens, clearTokens } from "./secure-store";

// In dev, use your machine's local IP. In prod, use the actual domain.
const API_BASE =
  process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

type FetchOptions = RequestInit & {
  skipAuth?: boolean;
};

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshTokens(): Promise<boolean> {
  const tokens = await getTokens();
  if (!tokens?.refreshToken) return false;

  try {
    const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: tokens.refreshToken }),
    });

    if (!res.ok) {
      await clearTokens();
      return false;
    }

    const data: RefreshResponse = await res.json();
    await setTokens(data.accessToken, data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export async function apiFetch<T>(
  path: string,
  options: FetchOptions = {}
): Promise<T> {
  const { skipAuth, ...fetchOptions } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(fetchOptions.headers as Record<string, string>),
  };

  if (!skipAuth) {
    const tokens = await getTokens();
    if (tokens?.accessToken) {
      headers["Authorization"] = `Bearer ${tokens.accessToken}`;
    }
  }

  let res = await fetch(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
  });

  // If 401 and we have a refresh token, try refreshing
  if (res.status === 401 && !skipAuth) {
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = refreshTokens();
    }

    const refreshed = await refreshPromise;
    isRefreshing = false;
    refreshPromise = null;

    if (refreshed) {
      // Retry with new token
      const newTokens = await getTokens();
      if (newTokens?.accessToken) {
        headers["Authorization"] = `Bearer ${newTokens.accessToken}`;
      }
      res = await fetch(`${API_BASE}${path}`, {
        ...fetchOptions,
        headers,
      });
    }
  }

  if (!res.ok) {
    const error: ApiError = await res.json().catch(() => ({
      error: `Request failed with status ${res.status}`,
    }));
    throw new Error(error.error);
  }

  return res.json();
}
