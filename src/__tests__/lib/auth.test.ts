import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('@/lib/db', () => ({
  db: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

vi.mock('@/lib/session', () => ({
  createSession: vi.fn(),
  getSession: vi.fn(),
  deleteSession: vi.fn(),
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn((password: string) => Promise.resolve(`hashed_${password}`)),
    compare: vi.fn((password: string, hash: string) => Promise.resolve(hash === `hashed_${password}`)),
  },
}))

import { db } from '@/lib/db'
import { createSession, getSession, deleteSession } from '@/lib/session'
import {
  hashPassword,
  verifyPassword,
  signUp,
  signIn,
  signOut,
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

  describe('signUp', () => {
    it('returns error when email already exists', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValueOnce({
        id: 'existing-user',
        email: 'test@example.com',
        username: 'existinguser',
        passwordHash: 'hash',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await signUp('test@example.com', 'newuser', 'password123')

      expect(result).toEqual({ error: 'Email already in use' })
    })

    it('returns error when username already exists', async () => {
      vi.mocked(db.user.findUnique)
        .mockResolvedValueOnce(null) // email check
        .mockResolvedValueOnce({
          id: 'existing-user',
          email: 'other@example.com',
          username: 'takenuser',
          passwordHash: 'hash',
          avatarUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

      const result = await signUp('new@example.com', 'takenuser', 'password123')

      expect(result).toEqual({ error: 'Username already taken' })
    })

    it('creates user and session on successful signup', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null)
      vi.mocked(db.user.create).mockResolvedValue({
        id: 'new-user-1',
        email: 'new@example.com',
        username: 'newuser',
        passwordHash: 'hashed_password123',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      vi.mocked(createSession).mockResolvedValue('session-1')

      const result = await signUp('new@example.com', 'newuser', 'password123')

      expect(result).toHaveProperty('user')
      if ('user' in result) {
        expect(result.user.email).toBe('new@example.com')
        expect(result.user.username).toBe('newuser')
        expect(result.user).not.toHaveProperty('passwordHash')
      }
      expect(createSession).toHaveBeenCalledWith('new-user-1')
    })
  })

  describe('signIn', () => {
    it('returns error when user not found', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue(null)

      const result = await signIn('nonexistent@example.com', 'password123')

      expect(result).toEqual({ error: 'Invalid email or password' })
    })

    it('returns error when user has no password (OAuth-only)', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'oauth-user',
        email: 'oauth@example.com',
        username: 'oauthuser',
        passwordHash: null,
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await signIn('oauth@example.com', 'password123')

      expect(result).toEqual({ error: 'Invalid email or password' })
    })

    it('returns error when password is incorrect', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hashed_correctpassword',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await signIn('test@example.com', 'wrongpassword')

      expect(result).toEqual({ error: 'Invalid email or password' })
    })

    it('creates session on successful login', async () => {
      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
        passwordHash: 'hashed_correctpassword',
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      vi.mocked(createSession).mockResolvedValue('session-1')

      const result = await signIn('test@example.com', 'correctpassword')

      expect(result).toHaveProperty('user')
      if ('user' in result) {
        expect(result.user.email).toBe('test@example.com')
        expect(result.user).not.toHaveProperty('passwordHash')
      }
      expect(createSession).toHaveBeenCalledWith('user-1')
    })
  })

  describe('signOut', () => {
    it('calls deleteSession', async () => {
      await signOut()
      expect(deleteSession).toHaveBeenCalled()
    })
  })

  describe('getCurrentUser', () => {
    it('returns null when no session', async () => {
      vi.mocked(getSession).mockResolvedValue(null)

      const result = await getCurrentUser()

      expect(result).toBeNull()
    })

    it('returns user without passwordHash when session exists', async () => {
      vi.mocked(getSession).mockResolvedValue({
        id: 'session-1',
        userId: 'user-1',
        expiresAt: new Date(Date.now() + 1000000),
        user: {
          id: 'user-1',
          email: 'test@example.com',
          username: 'testuser',
          passwordHash: 'secret_hash',
          avatarUrl: 'https://example.com/avatar.jpg',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })

      const result = await getCurrentUser()

      expect(result).not.toBeNull()
      expect(result?.email).toBe('test@example.com')
      expect(result).not.toHaveProperty('passwordHash')
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
