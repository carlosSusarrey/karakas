import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Store original env
const originalEnv = { ...process.env }

describe('OAuth Library', () => {
  beforeEach(() => {
    vi.resetModules()
    // Clear all OAuth env vars
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
    delete process.env.DISCORD_CLIENT_ID
    delete process.env.DISCORD_CLIENT_SECRET
    delete process.env.APPLE_CLIENT_ID
    delete process.env.APPLE_TEAM_ID
    delete process.env.APPLE_KEY_ID
    delete process.env.APPLE_PRIVATE_KEY
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  describe('Provider Configuration', () => {
    it('returns null for google when not configured', async () => {
      const { google } = await import('@/lib/oauth')
      expect(google).toBeNull()
    })

    it('returns null for discord when not configured', async () => {
      const { discord } = await import('@/lib/oauth')
      expect(discord).toBeNull()
    })

    it('returns null for apple when not configured', async () => {
      const { apple } = await import('@/lib/oauth')
      expect(apple).toBeNull()
    })
  })

  describe('OAUTH_PROVIDERS', () => {
    it('shows all providers as disabled when not configured', async () => {
      const { OAUTH_PROVIDERS } = await import('@/lib/oauth')

      expect(OAUTH_PROVIDERS.google).toEqual({ name: 'Google', enabled: false })
      expect(OAUTH_PROVIDERS.discord).toEqual({ name: 'Discord', enabled: false })
      expect(OAUTH_PROVIDERS.apple).toEqual({ name: 'Apple', enabled: false })
    })
  })

  describe('getEnabledProviders', () => {
    it('returns empty array when no providers configured', async () => {
      const { getEnabledProviders } = await import('@/lib/oauth')

      const providers = getEnabledProviders()

      expect(providers).toEqual([])
    })
  })

  describe('OAuthProvider type', () => {
    it('exports valid provider types', async () => {
      const { OAUTH_PROVIDERS } = await import('@/lib/oauth')

      expect(Object.keys(OAUTH_PROVIDERS)).toEqual(['google', 'discord', 'apple'])
    })
  })
})
