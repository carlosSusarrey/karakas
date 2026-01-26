import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    passwordResetToken: {
      deleteMany: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

// Mock crypto
vi.stubGlobal('crypto', {
  getRandomValues: vi.fn((arr: Uint8Array) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = i % 256
    }
    return arr
  }),
})

import { db } from '@/lib/db'
import {
  createPasswordResetToken,
  validatePasswordResetToken,
  consumePasswordResetToken,
} from '@/lib/password-reset'

describe('Password Reset Library', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createPasswordResetToken', () => {
    it('deletes existing tokens for user before creating new one', async () => {
      vi.mocked(db.passwordResetToken.deleteMany).mockResolvedValue({ count: 1 })
      vi.mocked(db.passwordResetToken.create).mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        token: 'hashed-token',
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      })

      const token = await createPasswordResetToken('user-1')

      expect(db.passwordResetToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      })
      expect(db.passwordResetToken.create).toHaveBeenCalled()
      expect(typeof token).toBe('string')
      expect(token.length).toBeGreaterThan(0)
    })

    it('creates token with 1 hour expiry', async () => {
      vi.mocked(db.passwordResetToken.deleteMany).mockResolvedValue({ count: 0 })
      vi.mocked(db.passwordResetToken.create).mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        token: 'hashed-token',
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      })

      const beforeCall = Date.now()
      await createPasswordResetToken('user-1')
      const afterCall = Date.now()

      const createCall = vi.mocked(db.passwordResetToken.create).mock.calls[0][0]
      const expiresAt = createCall.data.expiresAt.getTime()

      // Token should expire approximately 1 hour from now
      expect(expiresAt).toBeGreaterThanOrEqual(beforeCall + 3600000 - 1000)
      expect(expiresAt).toBeLessThanOrEqual(afterCall + 3600000 + 1000)
    })
  })

  describe('validatePasswordResetToken', () => {
    it('returns invalid for non-existent token', async () => {
      vi.mocked(db.passwordResetToken.findUnique).mockResolvedValue(null)

      const result = await validatePasswordResetToken('invalid-token')

      expect(result).toEqual({
        valid: false,
        error: 'Invalid or expired reset link',
      })
    })

    it('returns invalid and deletes expired token', async () => {
      vi.mocked(db.passwordResetToken.findUnique).mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        token: 'hashed-token',
        expiresAt: new Date(Date.now() - 1000), // expired
        createdAt: new Date(),
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
      vi.mocked(db.passwordResetToken.delete).mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        token: 'hashed-token',
        expiresAt: new Date(),
        createdAt: new Date(),
      })

      const result = await validatePasswordResetToken('expired-token')

      expect(result).toEqual({
        valid: false,
        error: 'Reset link has expired',
      })
      expect(db.passwordResetToken.delete).toHaveBeenCalledWith({
        where: { id: 'token-1' },
      })
    })

    it('returns valid with userId for valid token', async () => {
      vi.mocked(db.passwordResetToken.findUnique).mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        token: 'hashed-token',
        expiresAt: new Date(Date.now() + 3600000), // valid
        createdAt: new Date(),
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

      const result = await validatePasswordResetToken('valid-token')

      expect(result).toEqual({
        valid: true,
        userId: 'user-1',
      })
    })
  })

  describe('consumePasswordResetToken', () => {
    it('returns error for invalid token', async () => {
      vi.mocked(db.passwordResetToken.findUnique).mockResolvedValue(null)

      const result = await consumePasswordResetToken('invalid-token')

      expect(result).toEqual({
        success: false,
        error: 'Invalid or expired reset link',
      })
    })

    it('deletes token after successful consumption', async () => {
      vi.mocked(db.passwordResetToken.findUnique).mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        token: 'hashed-token',
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
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
      vi.mocked(db.passwordResetToken.delete).mockResolvedValue({
        id: 'token-1',
        userId: 'user-1',
        token: 'hashed-token',
        expiresAt: new Date(),
        createdAt: new Date(),
      })

      const result = await consumePasswordResetToken('valid-token')

      expect(result).toEqual({
        success: true,
        userId: 'user-1',
      })
      expect(db.passwordResetToken.delete).toHaveBeenCalled()
    })
  })
})
