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
    },
  },
}))

import { db } from '@/lib/db'
import { createSession, getSession, deleteSession, getCurrentUserId } from '@/lib/session'

describe('Session Library', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createSession', () => {
    it('creates session in database and sets cookie', async () => {
      vi.mocked(db.session.create).mockResolvedValue({
        id: 'session-abc123',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })

      const sessionId = await createSession('user-1')

      expect(sessionId).toBe('session-abc123')
      expect(db.session.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          expiresAt: expect.any(Date),
        },
      })
      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'karakas_session',
        'session-abc123',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
        })
      )
    })

    it('sets session expiry to 30 days', async () => {
      vi.mocked(db.session.create).mockResolvedValue({
        id: 'session-abc123',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      })

      const beforeCall = Date.now()
      await createSession('user-1')
      const afterCall = Date.now()

      const createCall = vi.mocked(db.session.create).mock.calls[0][0]
      const expiresAt = createCall.data.expiresAt.getTime()
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000

      expect(expiresAt).toBeGreaterThanOrEqual(beforeCall + thirtyDaysMs - 1000)
      expect(expiresAt).toBeLessThanOrEqual(afterCall + thirtyDaysMs + 1000)
    })
  })

  describe('getSession', () => {
    it('returns null when no session cookie', async () => {
      mockCookieStore.get.mockReturnValue(undefined)

      const session = await getSession()

      expect(session).toBeNull()
    })

    it('returns null when session not found in database', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'nonexistent-session' })
      vi.mocked(db.session.findUnique).mockResolvedValue(null)

      const session = await getSession()

      expect(session).toBeNull()
    })

    it('returns null and deletes expired session', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'expired-session' })
      vi.mocked(db.session.findUnique).mockResolvedValue({
        id: 'expired-session',
        userId: 'user-1',
        expiresAt: new Date(Date.now() - 1000), // expired
        user: {
          id: 'user-1',
          email: 'test@example.com',
          username: 'testuser',
          passwordHash: 'hash',
          avatarUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })
      vi.mocked(db.session.delete).mockResolvedValue({} as never)

      const session = await getSession()

      expect(session).toBeNull()
      expect(db.session.delete).toHaveBeenCalledWith({
        where: { id: 'expired-session' },
      })
    })

    it('returns session with user for valid session', async () => {
      const validSession = {
        id: 'valid-session',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 1000000),
        user: {
          id: 'user-1',
          email: 'test@example.com',
          username: 'testuser',
          passwordHash: 'hash',
          avatarUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      }
      mockCookieStore.get.mockReturnValue({ value: 'valid-session' })
      vi.mocked(db.session.findUnique).mockResolvedValue(validSession)

      const session = await getSession()

      expect(session).toEqual(validSession)
    })
  })

  describe('deleteSession', () => {
    it('does nothing when no session cookie', async () => {
      mockCookieStore.get.mockReturnValue(undefined)

      await deleteSession()

      expect(db.session.delete).not.toHaveBeenCalled()
      expect(mockCookieStore.delete).toHaveBeenCalledWith('karakas_session')
    })

    it('deletes session from database and cookie', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'session-to-delete' })
      vi.mocked(db.session.delete).mockResolvedValue({
        id: 'session-to-delete',
        userId: 'user-1',
        expiresAt: new Date(),
      })

      await deleteSession()

      expect(db.session.delete).toHaveBeenCalledWith({
        where: { id: 'session-to-delete' },
      })
      expect(mockCookieStore.delete).toHaveBeenCalledWith('karakas_session')
    })

    it('handles already deleted session gracefully', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'already-deleted' })
      vi.mocked(db.session.delete).mockRejectedValue(new Error('Not found'))

      // Should not throw
      await expect(deleteSession()).resolves.not.toThrow()
      expect(mockCookieStore.delete).toHaveBeenCalledWith('karakas_session')
    })
  })

  describe('getCurrentUserId', () => {
    it('returns null when no session', async () => {
      mockCookieStore.get.mockReturnValue(undefined)

      const userId = await getCurrentUserId()

      expect(userId).toBeNull()
    })

    it('returns userId from valid session', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'valid-session' })
      vi.mocked(db.session.findUnique).mockResolvedValue({
        id: 'valid-session',
        userId: 'user-123',
        expiresAt: new Date(Date.now() + 1000000),
        user: {
          id: 'user-123',
          email: 'test@example.com',
          username: 'testuser',
          passwordHash: 'hash',
          avatarUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })

      const userId = await getCurrentUserId()

      expect(userId).toBe('user-123')
    })
  })
})
