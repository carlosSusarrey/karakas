import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the dependencies
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    playgroup: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    playgroupMember: {
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    playgroupInvitation: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  createPlaygroup,
  updatePlaygroup,
  deletePlaygroup,
  leavePlaygroup,
  inviteMember,
  removeMember,
  updateMemberRole,
  transferOwnership,
} from '../actions'

describe('Playgroup Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createPlaygroup', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await createPlaygroup({ name: 'Test Group' })

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when name is empty', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      const result = await createPlaygroup({ name: '' })

      expect(result).toEqual({ error: 'Playgroup name is required' })
    })

    it('returns error when name is only whitespace', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      const result = await createPlaygroup({ name: '   ' })

      expect(result).toEqual({ error: 'Playgroup name is required' })
    })

    it('returns error when name exceeds 100 characters', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      const longName = 'a'.repeat(101)
      const result = await createPlaygroup({ name: longName })

      expect(result).toEqual({ error: 'Playgroup name must be 100 characters or less' })
    })

    it('creates playgroup with valid data', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroup.create).mockResolvedValue({
        id: 'pg-1',
        name: 'Test Group',
        description: null,
        defaultFormat: null,
        ownerId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await createPlaygroup({ name: 'Test Group' })

      expect(result).toEqual({ playgroupId: 'pg-1' })
      expect(db.playgroup.create).toHaveBeenCalledWith({
        data: {
          name: 'Test Group',
          description: null,
          defaultFormat: null,
          ownerId: 'user-1',
          members: {
            create: {
              userId: 'user-1',
              role: 'owner',
            },
          },
        },
      })
    })

    it('creates playgroup with description and default format', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroup.create).mockResolvedValue({
        id: 'pg-1',
        name: 'Commander Night',
        description: 'Friday nights',
        defaultFormat: 'commander',
        ownerId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await createPlaygroup({
        name: 'Commander Night',
        description: 'Friday nights',
        defaultFormat: 'commander',
      })

      expect(result).toEqual({ playgroupId: 'pg-1' })
    })
  })

  describe('updatePlaygroup', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await updatePlaygroup('pg-1', { name: 'Updated' })

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when user is not admin or owner', async () => {
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

      const result = await updatePlaygroup('pg-1', { name: 'Updated' })

      expect(result).toEqual({ error: "You don't have permission to edit this playgroup" })
    })

    it('allows admin to update playgroup', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1',
        playgroupId: 'pg-1',
        userId: 'user-1',
        role: 'admin',
        joinedAt: new Date(),
        invitedById: null,
      })

      vi.mocked(db.playgroup.update).mockResolvedValue({
        id: 'pg-1',
        name: 'Updated Name',
        description: null,
        defaultFormat: null,
        ownerId: 'owner-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await updatePlaygroup('pg-1', { name: 'Updated Name' })

      expect(result).toEqual({ success: true })
    })
  })

  describe('deletePlaygroup', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await deletePlaygroup('pg-1')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when playgroup not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroup.findUnique).mockResolvedValue(null)

      const result = await deletePlaygroup('pg-1')

      expect(result).toEqual({ error: 'Playgroup not found' })
    })

    it('returns error when user is not owner', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroup.findUnique).mockResolvedValue({
        ownerId: 'other-user',
      })

      const result = await deletePlaygroup('pg-1')

      expect(result).toEqual({ error: 'Only the owner can delete this playgroup' })
    })
  })

  describe('leavePlaygroup', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await leavePlaygroup('pg-1')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when playgroup not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroup.findUnique).mockResolvedValue(null)

      const result = await leavePlaygroup('pg-1')

      expect(result).toEqual({ error: 'Playgroup not found' })
    })

    it('returns error when owner tries to leave', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroup.findUnique).mockResolvedValue({
        ownerId: 'user-1',
      })

      const result = await leavePlaygroup('pg-1')

      expect(result).toEqual({ error: 'Owner cannot leave the playgroup. Transfer ownership first.' })
    })
  })

  describe('inviteMember', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await inviteMember('pg-1', 'test@example.com')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when user lacks permission', async () => {
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

      const result = await inviteMember('pg-1', 'new@example.com')

      expect(result).toEqual({ error: "You don't have permission to invite members" })
    })

    it('returns error when user already a member', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique)
        .mockResolvedValueOnce({
          id: 'member-1',
          playgroupId: 'pg-1',
          userId: 'user-1',
          role: 'admin',
          joinedAt: new Date(),
          invitedById: null,
        })
        .mockResolvedValueOnce({
          id: 'member-2',
          playgroupId: 'pg-1',
          userId: 'user-2',
          role: 'member',
          joinedAt: new Date(),
          invitedById: null,
        })

      vi.mocked(db.user.findUnique).mockResolvedValue({
        id: 'user-2',
      })

      const result = await inviteMember('pg-1', 'existing@example.com')

      expect(result).toEqual({ error: 'User is already a member of this playgroup' })
    })
  })

  describe('removeMember', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await removeMember('pg-1', 'user-2')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when trying to remove owner', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1',
        playgroupId: 'pg-1',
        userId: 'user-1',
        role: 'admin',
        joinedAt: new Date(),
        invitedById: null,
      })

      vi.mocked(db.playgroup.findUnique).mockResolvedValue({
        ownerId: 'user-2',
      })

      const result = await removeMember('pg-1', 'user-2')

      expect(result).toEqual({ error: 'Cannot remove the owner' })
    })
  })

  describe('updateMemberRole', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await updateMemberRole('pg-1', 'user-2', 'admin')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when not owner', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroup.findUnique).mockResolvedValue({
        ownerId: 'other-user',
      })

      const result = await updateMemberRole('pg-1', 'user-2', 'admin')

      expect(result).toEqual({ error: 'Only the owner can change member roles' })
    })

    it('returns error for invalid role', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroup.findUnique).mockResolvedValue({
        ownerId: 'user-1',
      })

      const result = await updateMemberRole('pg-1', 'user-2', 'superadmin')

      expect(result).toEqual({ error: 'Invalid role' })
    })
  })

  describe('transferOwnership', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await transferOwnership('pg-1', 'user-2')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when not owner', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroup.findUnique).mockResolvedValue({
        ownerId: 'other-user',
      })

      const result = await transferOwnership('pg-1', 'user-2')

      expect(result).toEqual({ error: 'Only the owner can transfer ownership' })
    })

    it('returns error when new owner is not a member', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroup.findUnique).mockResolvedValue({
        ownerId: 'user-1',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue(null)

      const result = await transferOwnership('pg-1', 'user-2')

      expect(result).toEqual({ error: 'New owner must be a member of the playgroup' })
    })
  })
})
