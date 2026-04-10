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

import { createSession, getSession, deleteSession } from '@/lib/session'

describe('Session Library', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createSession', () => {
    it('sets cookie with userId', async () => {
      await createSession('user-1')

      expect(mockCookieStore.set).toHaveBeenCalledWith(
        'session',
        'user-1',
        expect.objectContaining({
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 7,
        })
      )
    })
  })

  describe('getSession', () => {
    it('returns null when no session cookie', async () => {
      mockCookieStore.get.mockReturnValue(undefined)

      const userId = await getSession()

      expect(userId).toBeNull()
    })

    it('returns userId from cookie', async () => {
      mockCookieStore.get.mockReturnValue({ value: 'user-123' })

      const userId = await getSession()

      expect(userId).toBe('user-123')
    })
  })

  describe('deleteSession', () => {
    it('deletes the session cookie', async () => {
      await deleteSession()

      expect(mockCookieStore.delete).toHaveBeenCalledWith('session')
    })
  })
})
