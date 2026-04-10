import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}

vi.mock('next/headers', () => ({
  cookies: vi.fn(() => Promise.resolve(mockCookieStore)),
}))

vi.mock('@/lib/db', () => ({
  db: {
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}))

import { db } from '@/lib/db'
import { createSession, getSession, deleteSession, deleteAllUserSessions } from '@/lib/session'

describe('Session Library', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createSession', () => {
    it('creates a DB session and sets a cookie with opaque token', async () => {
      await createSession('user-1')

      // Should create a session in the DB with a hashed token
      expect(db.session.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          token: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      })

      // Cookie value should NOT be the userId
      const cookieArgs = mockCookieStore.set.mock.calls[0]
      expect(cookieArgs[0]).toBe('session')
      expect(cookieArgs[1]).not.toBe('user-1')
      expect(cookieArgs[1]).toHaveLength(64) // 32 bytes hex-encoded
      expect(cookieArgs[2]).toMatchObject({
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
      })

      // The token stored in DB should be different from the cookie value (it's hashed)
      const dbToken = (db.session.create as ReturnType<typeof vi.fn>).mock.calls[0][0].data.token
      expect(dbToken).not.toBe(cookieArgs[1])
    })
  })

  describe('getSession', () => {
    it('returns null when no session cookie', async () => {
      mockCookieStore.get.mockReturnValue(undefined)

      const userId = await getSession()

      expect(userId).toBeNull()
      expect(db.session.findUnique).not.toHaveBeenCalled()
    })

    it('returns userId when session is valid', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'abc123' })
      vi.mocked(db.session.findUnique).mockResolvedValue({
        id: 'session-1',
        userId: 'user-123',
        token: 'hashed',
        expiresAt: new Date(Date.now() + 1000 * 60 * 60), // 1 hour from now
        createdAt: new Date(),
      })

      const userId = await getSession()

      expect(userId).toBe('user-123')
      expect(db.session.findUnique).toHaveBeenCalledWith({
        where: { token: expect.any(String) },
      })
    })

    it('returns null and cleans up when session is expired', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'abc123' })
      vi.mocked(db.session.findUnique).mockResolvedValue({
        id: 'session-1',
        userId: 'user-123',
        token: 'hashed',
        expiresAt: new Date(Date.now() - 1000), // expired
        createdAt: new Date(),
      })

      const userId = await getSession()

      expect(userId).toBeNull()
      expect(db.session.delete).toHaveBeenCalledWith({ where: { id: 'session-1' } })
      expect(mockCookieStore.delete).toHaveBeenCalledWith('session')
    })

    it('returns null and clears cookie when session not found in DB', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'abc123' })
      vi.mocked(db.session.findUnique).mockResolvedValue(null)

      const userId = await getSession()

      expect(userId).toBeNull()
      expect(mockCookieStore.delete).toHaveBeenCalledWith('session')
    })
  })

  describe('deleteSession', () => {
    it('deletes DB session and clears cookie', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'abc123' })

      await deleteSession()

      expect(db.session.deleteMany).toHaveBeenCalledWith({
        where: { token: expect.any(String) },
      })
      expect(mockCookieStore.delete).toHaveBeenCalledWith('session')
    })

    it('clears cookie even when no token exists', async () => {
      mockCookieStore.get.mockReturnValue(undefined)

      await deleteSession()

      expect(db.session.deleteMany).not.toHaveBeenCalled()
      expect(mockCookieStore.delete).toHaveBeenCalledWith('session')
    })
  })

  describe('deleteAllUserSessions', () => {
    it('deletes all sessions for a user', async () => {
      await deleteAllUserSessions('user-1')

      expect(db.session.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      })
    })
  })
})
