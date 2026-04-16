import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the dependencies
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    playgroupMember: {
      findUnique: vi.fn(),
    },
    playgroupPlayer: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  createPlaygroupPlayer,
  updatePlaygroupPlayer,
  deletePlaygroupPlayer,
} from '../[id]/players/actions'

describe('Playgroup Player Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createPlaygroupPlayer', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await createPlaygroupPlayer('pg-1', 'John')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when user is not a member', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue(null)

      const result = await createPlaygroupPlayer('pg-1', 'John')

      expect(result).toEqual({ error: 'You are not a member of this playgroup' })
    })

    it('returns error when name is empty', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1',
        playgroupId: 'pg-1',
        userId: 'user-1',
        role: 'member',
        joinedAt: new Date(),
        invitedById: null,
      })

      const result = await createPlaygroupPlayer('pg-1', '')

      expect(result).toEqual({ error: 'Player name is required' })
    })

    it('returns error when name is only whitespace', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1',
        playgroupId: 'pg-1',
        userId: 'user-1',
        role: 'member',
        joinedAt: new Date(),
        invitedById: null,
      })

      const result = await createPlaygroupPlayer('pg-1', '   ')

      expect(result).toEqual({ error: 'Player name is required' })
    })

    it('creates player with valid data', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1',
        playgroupId: 'pg-1',
        userId: 'user-1',
        role: 'member',
        joinedAt: new Date(),
        invitedById: null,
      })

      vi.mocked(db.playgroupPlayer.create).mockResolvedValue({
        id: 'player-1',
        playgroupId: 'pg-1',
        name: 'John',
        email: null,
        linkedUserId: null,
        createdAt: new Date(),
      })

      const result = await createPlaygroupPlayer('pg-1', 'John')

      expect(result).toEqual({ playerId: 'player-1' })
      expect(db.playgroupPlayer.create).toHaveBeenCalledWith({
        data: {
          playgroupId: 'pg-1',
          name: 'John',
          email: null,
        },
      })
    })

    it('creates player with email', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1',
        playgroupId: 'pg-1',
        userId: 'user-1',
        role: 'member',
        joinedAt: new Date(),
        invitedById: null,
      })

      vi.mocked(db.playgroupPlayer.create).mockResolvedValue({
        id: 'player-1',
        playgroupId: 'pg-1',
        name: 'John',
        email: 'john@example.com',
        linkedUserId: null,
        createdAt: new Date(),
      })

      const result = await createPlaygroupPlayer('pg-1', 'John', 'john@example.com')

      expect(result).toEqual({ playerId: 'player-1' })
    })
  })

  describe('updatePlaygroupPlayer', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await updatePlaygroupPlayer('player-1', 'Updated Name')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when player not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue(null)

      const result = await updatePlaygroupPlayer('player-1', 'Updated Name')

      expect(result).toEqual({ error: 'Player not found' })
    })

    it('returns error when user is not a member', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue({
        playgroupId: 'pg-1',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue(null)

      const result = await updatePlaygroupPlayer('player-1', 'Updated Name')

      expect(result).toEqual({ error: 'You are not a member of this playgroup' })
    })

    it('returns error when name is empty', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue({
        playgroupId: 'pg-1',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1',
        playgroupId: 'pg-1',
        userId: 'user-1',
        role: 'member',
        joinedAt: new Date(),
        invitedById: null,
      })

      const result = await updatePlaygroupPlayer('player-1', '')

      expect(result).toEqual({ error: 'Player name is required' })
    })

    it('updates player with valid data', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue({
        playgroupId: 'pg-1',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1',
        playgroupId: 'pg-1',
        userId: 'user-1',
        role: 'member',
        joinedAt: new Date(),
        invitedById: null,
      })

      vi.mocked(db.playgroupPlayer.update).mockResolvedValue({
        id: 'player-1',
        playgroupId: 'pg-1',
        name: 'Updated Name',
        email: null,
        linkedUserId: null,
        createdAt: new Date(),
      })

      const result = await updatePlaygroupPlayer('player-1', 'Updated Name')

      expect(result).toEqual({ success: true })
    })
  })

  describe('deletePlaygroupPlayer', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await deletePlaygroupPlayer('player-1')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when player not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue(null)

      const result = await deletePlaygroupPlayer('player-1')

      expect(result).toEqual({ error: 'Player not found' })
    })

    it('returns error when user is not admin', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue({
        playgroupId: 'pg-1',
        _count: { gamePlayers: 0 },
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1',
        playgroupId: 'pg-1',
        userId: 'user-1',
        role: 'member',
        joinedAt: new Date(),
        invitedById: null,
      })

      const result = await deletePlaygroupPlayer('player-1')

      expect(result).toEqual({ error: 'Only admins can delete players' })
    })

    it('returns error when player has game history', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue({
        playgroupId: 'pg-1',
        _count: { gamePlayers: 5 },
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1',
        playgroupId: 'pg-1',
        userId: 'user-1',
        role: 'admin',
        joinedAt: new Date(),
        invitedById: null,
      })

      const result = await deletePlaygroupPlayer('player-1')

      expect(result).toEqual({ error: 'Cannot delete player with game history. Consider linking them to an account instead.' })
    })

    it('deletes player when admin and no game history', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue({
        playgroupId: 'pg-1',
        _count: { gamePlayers: 0 },
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1',
        playgroupId: 'pg-1',
        userId: 'user-1',
        role: 'admin',
        joinedAt: new Date(),
        invitedById: null,
      })

      vi.mocked(db.playgroupPlayer.delete).mockResolvedValue({
        id: 'player-1',
        playgroupId: 'pg-1',
        name: 'John',
        email: null,
        linkedUserId: null,
        createdAt: new Date(),
      })

      const result = await deletePlaygroupPlayer('player-1')

      expect(result).toEqual({ success: true })
    })
  })
})
