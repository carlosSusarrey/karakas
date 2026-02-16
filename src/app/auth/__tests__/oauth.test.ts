import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock arctic module
vi.mock('arctic', () => ({
  generateState: vi.fn(() => 'mock-state'),
  generateCodeVerifier: vi.fn(() => 'mock-code-verifier'),
}))

// Mock next/headers cookies
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}))

// Mock next/navigation redirect (throws to halt execution, like the real one)
const mockRedirect = vi.fn()
vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => {
    mockRedirect(...args)
    const error = new Error('NEXT_REDIRECT') as Error & { digest: string }
    error.digest = `NEXT_REDIRECT;replace;${args[0]};307;`
    throw error
  },
}))

// Mock oauth module
vi.mock('@/lib/oauth', () => ({
  google: {
    createAuthorizationURL: vi.fn((state: string, codeVerifier: string, scopes: string[]) =>
      new URL(`https://accounts.google.com/o/oauth2/v2/auth?state=${state}&code_verifier=${codeVerifier}&scope=${scopes.join(' ')}`)
    ),
    validateAuthorizationCode: vi.fn(),
  },
  discord: {
    createAuthorizationURL: vi.fn((state: string, codeVerifier: string, scopes: string[]) =>
      new URL(`https://discord.com/oauth2/authorize?state=${state}&code_verifier=${codeVerifier}&scope=${scopes.join(' ')}`)
    ),
    validateAuthorizationCode: vi.fn(),
  },
  apple: {
    createAuthorizationURL: vi.fn((state: string, scopes: string[]) =>
      new URL(`https://appleid.apple.com/auth/authorize?state=${state}&scope=${scopes.join(' ')}`)
    ),
    validateAuthorizationCode: vi.fn(),
  },
}))

// Mock db
vi.mock('@/lib/db', () => ({
  db: {
    oAuthAccount: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

// Mock session
vi.mock('@/lib/session', () => ({
  createSession: vi.fn(),
}))

import { generateState, generateCodeVerifier } from 'arctic'
import { google, discord, apple } from '@/lib/oauth'
import { db } from '@/lib/db'
import { createSession } from '@/lib/session'

// Import the route handlers
import { GET as initiateOAuth } from '../[provider]/route'
import { GET as oauthCallback } from '../[provider]/callback/route'

describe('OAuth Initiation Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 for invalid provider', async () => {
    const request = new Request('http://localhost:3000/auth/invalid')
    const response = await initiateOAuth(request, { params: Promise.resolve({ provider: 'invalid' }) })

    expect(response.status).toBe(400)
    const data = await response.json()
    expect(data).toEqual({ error: 'Invalid provider' })
  })

  it('redirects to Google OAuth with correct scopes', async () => {
    const request = new Request('http://localhost:3000/auth/google')
    const response = await initiateOAuth(request, { params: Promise.resolve({ provider: 'google' }) })

    expect(response.status).toBe(307) // redirect status
    expect(generateState).toHaveBeenCalled()
    expect(generateCodeVerifier).toHaveBeenCalled()
    expect(google?.createAuthorizationURL).toHaveBeenCalledWith(
      'mock-state',
      'mock-code-verifier',
      ['openid', 'email', 'profile']
    )
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'oauth_state_google',
      'mock-state',
      expect.objectContaining({
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 600,
        path: '/',
      })
    )
  })

  it('redirects to Discord OAuth with correct scopes', async () => {
    const request = new Request('http://localhost:3000/auth/discord')
    const response = await initiateOAuth(request, { params: Promise.resolve({ provider: 'discord' }) })

    expect(response.status).toBe(307)
    expect(discord?.createAuthorizationURL).toHaveBeenCalledWith(
      'mock-state',
      'mock-code-verifier',
      ['identify', 'email']
    )
  })

  it('redirects to Apple OAuth without code verifier', async () => {
    const request = new Request('http://localhost:3000/auth/apple')
    const response = await initiateOAuth(request, { params: Promise.resolve({ provider: 'apple' }) })

    expect(response.status).toBe(307)
    expect(apple?.createAuthorizationURL).toHaveBeenCalledWith(
      'mock-state',
      ['email', 'name']
    )
  })
})

describe('OAuth Callback Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCookieStore.get.mockReset()
    mockRedirect.mockReset()
  })

  it('redirects to login on OAuth error', async () => {
    const request = new Request('http://localhost:3000/auth/google/callback?error=access_denied')
    await expect(oauthCallback(request, { params: Promise.resolve({ provider: 'google' }) })).rejects.toThrow('NEXT_REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/login?error=oauth_access_denied')
  })

  it('redirects to login when code is missing', async () => {
    const request = new Request('http://localhost:3000/auth/google/callback?state=test-state')
    await expect(oauthCallback(request, { params: Promise.resolve({ provider: 'google' }) })).rejects.toThrow('NEXT_REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/login?error=missing_params')
  })

  it('redirects to login when state is missing', async () => {
    const request = new Request('http://localhost:3000/auth/google/callback?code=test-code')
    await expect(oauthCallback(request, { params: Promise.resolve({ provider: 'google' }) })).rejects.toThrow('NEXT_REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/login?error=missing_params')
  })

  it('redirects to login when state does not match', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'oauth_state_google') return { value: 'different-state' }
      if (name === 'oauth_code_verifier') return { value: 'mock-verifier' }
      return undefined
    })

    const request = new Request('http://localhost:3000/auth/google/callback?code=test-code&state=test-state')
    await expect(oauthCallback(request, { params: Promise.resolve({ provider: 'google' }) })).rejects.toThrow('NEXT_REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/login?error=invalid_state')
  })

  it('redirects to login for invalid provider', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'oauth_state_invalid') return { value: 'test-state' }
      return undefined
    })

    const request = new Request('http://localhost:3000/auth/invalid/callback?code=test-code&state=test-state')
    await expect(oauthCallback(request, { params: Promise.resolve({ provider: 'invalid' }) })).rejects.toThrow('NEXT_REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/login?error=invalid_provider')
  })

  it('creates session for existing OAuth user', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'oauth_state_google') return { value: 'test-state' }
      if (name === 'oauth_code_verifier') return { value: 'mock-verifier' }
      return undefined
    })

    vi.mocked(google?.validateAuthorizationCode).mockResolvedValue({
      accessToken: () => 'mock-access-token',
      refreshToken: () => null,
      accessTokenExpiresAt: () => new Date(),
    } as unknown as ReturnType<typeof google.validateAuthorizationCode>)

    // Mock fetch for Google user info
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'google-user-123',
        email: 'user@example.com',
        name: 'Test User',
        picture: 'https://example.com/avatar.jpg',
      }),
    })

    // Existing OAuth account
    vi.mocked(db.oAuthAccount.findUnique).mockResolvedValue({
      id: 'oauth-1',
      userId: 'user-1',
      provider: 'google',
      providerAccountId: 'google-user-123',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        username: 'testuser',
        avatarUrl: 'https://example.com/old-avatar.jpg',
      },
    })

    const request = new Request('http://localhost:3000/auth/google/callback?code=test-code&state=test-state')
    await expect(oauthCallback(request, { params: Promise.resolve({ provider: 'google' }) })).rejects.toThrow('NEXT_REDIRECT')

    expect(createSession).toHaveBeenCalledWith('user-1')
    expect(mockRedirect).toHaveBeenCalledWith('/')
  })

  it('links OAuth account to existing user with same email', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'oauth_state_google') return { value: 'test-state' }
      if (name === 'oauth_code_verifier') return { value: 'mock-verifier' }
      return undefined
    })

    vi.mocked(google?.validateAuthorizationCode).mockResolvedValue({
      accessToken: () => 'mock-access-token',
      refreshToken: () => null,
      accessTokenExpiresAt: () => new Date(),
    } as unknown as ReturnType<typeof google.validateAuthorizationCode>)

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'google-user-123',
        email: 'existing@example.com',
        name: 'Test User',
      }),
    })

    // No existing OAuth account
    vi.mocked(db.oAuthAccount.findUnique).mockResolvedValue(null)

    // But existing user with same email
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: 'user-1',
      email: 'existing@example.com',
      username: 'existinguser',
      passwordHash: 'hash',
      avatarUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const request = new Request('http://localhost:3000/auth/google/callback?code=test-code&state=test-state')
    await expect(oauthCallback(request, { params: Promise.resolve({ provider: 'google' }) })).rejects.toThrow('NEXT_REDIRECT')

    expect(db.oAuthAccount.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        provider: 'google',
        providerAccountId: 'google-user-123',
      },
    })
    expect(createSession).toHaveBeenCalledWith('user-1')
    expect(mockRedirect).toHaveBeenCalledWith('/')
  })

  it('creates new user for new OAuth account', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'oauth_state_google') return { value: 'test-state' }
      if (name === 'oauth_code_verifier') return { value: 'mock-verifier' }
      return undefined
    })

    vi.mocked(google?.validateAuthorizationCode).mockResolvedValue({
      accessToken: () => 'mock-access-token',
      refreshToken: () => null,
      accessTokenExpiresAt: () => new Date(),
    } as unknown as ReturnType<typeof google.validateAuthorizationCode>)

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'google-user-123',
        email: 'newuser@example.com',
        name: 'New User',
        picture: 'https://example.com/avatar.jpg',
      }),
    })

    // No existing OAuth account or user
    vi.mocked(db.oAuthAccount.findUnique).mockResolvedValue(null)
    vi.mocked(db.user.findUnique).mockResolvedValue(null)
    vi.mocked(db.user.create).mockResolvedValue({
      id: 'new-user-1',
      email: 'newuser@example.com',
      username: 'newuser',
      passwordHash: null,
      avatarUrl: 'https://example.com/avatar.jpg',
      createdAt: new Date(),
      updatedAt: new Date(),
    })

    const request = new Request('http://localhost:3000/auth/google/callback?code=test-code&state=test-state')
    await expect(oauthCallback(request, { params: Promise.resolve({ provider: 'google' }) })).rejects.toThrow('NEXT_REDIRECT')

    expect(db.user.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        email: 'newuser@example.com',
        avatarUrl: 'https://example.com/avatar.jpg',
      }),
    })
    expect(createSession).toHaveBeenCalledWith('new-user-1')
    expect(mockRedirect).toHaveBeenCalledWith('/')
  })

  it('redirects to login when no email returned', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'oauth_state_google') return { value: 'test-state' }
      if (name === 'oauth_code_verifier') return { value: 'mock-verifier' }
      return undefined
    })

    vi.mocked(google?.validateAuthorizationCode).mockResolvedValue({
      accessToken: () => 'mock-access-token',
      refreshToken: () => null,
      accessTokenExpiresAt: () => new Date(),
    } as unknown as ReturnType<typeof google.validateAuthorizationCode>)

    // User without email
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        id: 'google-user-123',
        name: 'No Email User',
      }),
    })

    const request = new Request('http://localhost:3000/auth/google/callback?code=test-code&state=test-state')
    await expect(oauthCallback(request, { params: Promise.resolve({ provider: 'google' }) })).rejects.toThrow('NEXT_REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/login?error=no_email')
  })

  it('redirects to login on OAuth failure', async () => {
    mockCookieStore.get.mockImplementation((name: string) => {
      if (name === 'oauth_state_google') return { value: 'test-state' }
      if (name === 'oauth_code_verifier') return { value: 'mock-verifier' }
      return undefined
    })

    vi.mocked(google?.validateAuthorizationCode).mockRejectedValue(new Error('Invalid code'))

    const request = new Request('http://localhost:3000/auth/google/callback?code=invalid-code&state=test-state')
    await expect(oauthCallback(request, { params: Promise.resolve({ provider: 'google' }) })).rejects.toThrow('NEXT_REDIRECT')

    expect(mockRedirect).toHaveBeenCalledWith('/login?error=oauth_failed')
  })
})
