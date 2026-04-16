import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/session', () => ({
  getSession: vi.fn(),
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn((password: string) => Promise.resolve(`hashed_${password}`)),
    compare: vi.fn((password: string, hash: string) => Promise.resolve(hash === `hashed_${password}`)),
  },
}))

import { db } from '@/lib/db'
import { getSession } from '@/lib/session'
import {
  hashPassword,
  verifyPassword,
  getCurrentUser,
  updatePassword,
} from '@/lib/auth'

describe('Auth Library', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('hashPassword', () => {
    it('hashes a password', async () => {
      const hash = await hashPassword('testpassword')
      expect(hash).toBe('hashed_testpassword')
    })
  })

  describe('verifyPassword', () => {
    it('returns true for matching password', async () => {
      const result = await verifyPassword('testpassword', 'hashed_testpassword')
      expect(result).toBe(true)
    })

    it('returns false for non-matching password', async () => {
      const result = await verifyPassword('wrongpassword', 'hashed_testpassword')
      expect(result).toBe(false)
    })
  })

  describe('getCurrentUser', () => {
    it('returns null when no session', async () => {
      vi.mocked(getSession).mockResolvedValue(null)

      const result = await getCurrentUser()

      expect(result).toBeNull()
    })

    it('returns null when user not found in DB', async () => {
      vi.mocked(getSession).mockResolvedValue('nonexistent-user')
      vi.mocked(db.user.findUnique).mockResolvedValue(null)

      const result = await getCurrentUser()

      expect(result).toBeNull()
    })

    it('returns user without passwordHash when session exists', async () => {
      vi.mocked(getSession).mockResolvedValue('user-1')
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        avatarUrl: 'https://example.com/avatar.jpg',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await getCurrentUser()

      expect(result).not.toBeNull()
      expect(result?.email).toBe('test@example.com')
      expect(result?.username).toBe('testuser')
      expect(result).not.toHaveProperty('passwordHash')
    })

    it('calls db with select to exclude passwordHash', async () => {
      vi.mocked(getSession).mockResolvedValue('user-1')
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await getCurrentUser()

      expect(db.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        select: {
          id: true,
          email: true,
          username: true,
          avatarUrl: true,
          createdAt: true,
          updatedAt: true,
        },
      })
    })
  })

  describe('updatePassword', () => {
    it('updates user password with hashed value', async () => {
      vi.mocked(db.user.update).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hashed_newpassword',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await updatePassword('user-1', 'newpassword')

      expect(db.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'hashed_newpassword' },
      })
    })
  })
})
