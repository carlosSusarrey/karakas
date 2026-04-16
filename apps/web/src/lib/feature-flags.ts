/**
 * Simple feature flags via environment variables.
 *
 * AI_ENABLED_USERS — comma-separated usernames allowed to use AI features.
 *   • Set to "*" to enable for everyone.
 *   • Omit or leave empty to disable for everyone.
 */

export function isAiEnabled(username: string): boolean {
  const allowList = process.env.AI_ENABLED_USERS?.trim();
  if (!allowList) return false;
  if (allowList === "*") return true;
  const users = allowList.split(",").map((u) => u.trim().toLowerCase());
  return users.includes(username.toLowerCase());
}
