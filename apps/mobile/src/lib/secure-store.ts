import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "karakas_access_token";
const REFRESH_TOKEN_KEY = "karakas_refresh_token";

export async function getTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
} | null> {
  try {
    const accessToken = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
    if (!accessToken && !refreshToken) return null;
    return { accessToken, refreshToken };
  } catch {
    return null;
  }
}

export async function setTokens(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}
