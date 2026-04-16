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
      findUnique: vi.fn(),
    },
    playgroupPlayerDeck: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import {
  createPlaygroupPlayerDeck,
  updatePlaygroupPlayerDeck,
  deletePlaygroupPlayerDeck,
  toggleArchivePlaygroupPlayerDeck,
} from '../[id]/players/[playerId]/decks/actions'

function createFormData(data: Record<string, string>): FormData {
  const formData = new FormData()
  for (const [key, value] of Object.entries(data)) {
    formData.append(key, value)
  }
  return formData
}

describe('Playgroup Player Deck Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createPlaygroupPlayerDeck', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const formData = createFormData({ name: 'Test Deck', format: 'commander' })
      const result = await createPlaygroupPlayerDeck('player-1', formData)

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when player not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue(null)

      const formData = createFormData({ name: 'Test Deck', format: 'commander' })
      const result = await createPlaygroupPlayerDeck('player-1', formData)

      expect(result).toEqual({ error: 'Player not found' })
    })

    it('returns error when user is not a member', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue({
        id: 'player-1',
        playgroupId: 'pg-1',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue(null)

      const formData = createFormData({ name: 'Test Deck', format: 'commander' })
      const result = await createPlaygroupPlayerDeck('player-1', formData)

      expect(result).toEqual({ error: 'You are not a member of this playgroup' })
    })

    it('returns error when name is empty', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue({
        id: 'player-1',
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

      const formData = createFormData({ name: '', format: 'commander' })
      const result = await createPlaygroupPlayerDeck('player-1', formData)

      expect(result).toEqual({ error: 'Deck name is required' })
    })

    it('returns error when name is only whitespace', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue({
        id: 'player-1',
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

      const formData = createFormData({ name: '   ', format: 'commander' })
      const result = await createPlaygroupPlayerDeck('player-1', formData)

      expect(result).toEqual({ error: 'Deck name is required' })
    })

    it('returns error when format is missing', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue({
        id: 'player-1',
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

      const formData = createFormData({ name: 'Test Deck', format: '' })
      const result = await createPlaygroupPlayerDeck('player-1', formData)

      expect(result).toEqual({ error: 'Invalid format selected' })
    })

    it('returns error when format is invalid', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue({
        id: 'player-1',
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

      const formData = createFormData({ name: 'Test Deck', format: 'invalid-format' })
      const result = await createPlaygroupPlayerDeck('player-1', formData)

      expect(result).toEqual({ error: 'Invalid format selected' })
    })

    it('returns error when bracket is invalid (too low)', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue({
        id: 'player-1',
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

      const formData = createFormData({ name: 'Test Deck', format: 'commander', bracket: '0' })
      const result = await createPlaygroupPlayerDeck('player-1', formData)

      expect(result).toEqual({ error: 'Invalid bracket value' })
    })

    it('returns error when bracket is invalid (too high)', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue({
        id: 'player-1',
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

      const formData = createFormData({ name: 'Test Deck', format: 'commander', bracket: '6' })
      const result = await createPlaygroupPlayerDeck('player-1', formData)

      expect(result).toEqual({ error: 'Invalid bracket value' })
    })

    it('creates deck with minimal valid data', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue({
        id: 'player-1',
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

      vi.mocked(db.playgroupPlayerDeck.create).mockResolvedValue({
        id: 'deck-1',
        playgroupPlayerId: 'player-1',
        name: 'Test Deck',
        format: 'modern',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        linkedDeckId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const formData = createFormData({ name: 'Test Deck', format: 'modern' })
      const result = await createPlaygroupPlayerDeck('player-1', formData)

      expect(result).toEqual({ success: true, deckId: 'deck-1' })
      expect(db.playgroupPlayerDeck.create).toHaveBeenCalledWith({
        data: {
          playgroupPlayerId: 'player-1',
          name: 'Test Deck',
          format: 'modern',
          commander1: null,
          commander2: null,
          bracket: null,
          decklistUrl: null,
        },
      })
    })

    it('creates commander deck with all fields', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue({
        id: 'player-1',
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

      vi.mocked(db.playgroupPlayerDeck.create).mockResolvedValue({
        id: 'deck-1',
        playgroupPlayerId: 'player-1',
        name: 'Krenko Goblins',
        format: 'commander',
        commander1: 'Krenko, Mob Boss',
        commander2: null,
        bracket: 2,
        decklistUrl: 'https://moxfield.com/decks/abc123',
        linkedDeckId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const formData = createFormData({
        name: 'Krenko Goblins',
        format: 'commander',
        commander1: 'Krenko, Mob Boss',
        bracket: '2',
        decklistUrl: 'https://moxfield.com/decks/abc123',
      })
      const result = await createPlaygroupPlayerDeck('player-1', formData)

      expect(result).toEqual({ success: true, deckId: 'deck-1' })
      expect(db.playgroupPlayerDeck.create).toHaveBeenCalledWith({
        data: {
          playgroupPlayerId: 'player-1',
          name: 'Krenko Goblins',
          format: 'commander',
          commander1: 'Krenko, Mob Boss',
          commander2: null,
          bracket: 2,
          decklistUrl: 'https://moxfield.com/decks/abc123',
        },
      })
    })

    it('creates deck with partner commanders', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue({
        id: 'player-1',
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

      vi.mocked(db.playgroupPlayerDeck.create).mockResolvedValue({
        id: 'deck-1',
        playgroupPlayerId: 'player-1',
        name: 'Partner Deck',
        format: 'commander',
        commander1: 'Thrasios, Triton Hero',
        commander2: 'Tymna the Weaver',
        bracket: 4,
        decklistUrl: null,
        linkedDeckId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const formData = createFormData({
        name: 'Partner Deck',
        format: 'commander',
        commander1: 'Thrasios, Triton Hero',
        commander2: 'Tymna the Weaver',
        bracket: '4',
      })
      const result = await createPlaygroupPlayerDeck('player-1', formData)

      expect(result).toEqual({ success: true, deckId: 'deck-1' })
      expect(db.playgroupPlayerDeck.create).toHaveBeenCalledWith({
        data: {
          playgroupPlayerId: 'player-1',
          name: 'Partner Deck',
          format: 'commander',
          commander1: 'Thrasios, Triton Hero',
          commander2: 'Tymna the Weaver',
          bracket: 4,
          decklistUrl: null,
        },
      })
    })

    it('trims whitespace from input fields', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue({
        id: 'player-1',
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

      vi.mocked(db.playgroupPlayerDeck.create).mockResolvedValue({
        id: 'deck-1',
        playgroupPlayerId: 'player-1',
        name: 'Test Deck',
        format: 'commander',
        commander1: 'Krenko, Mob Boss',
        commander2: null,
        bracket: null,
        decklistUrl: null,
        linkedDeckId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const formData = createFormData({
        name: '  Test Deck  ',
        format: 'commander',
        commander1: '  Krenko, Mob Boss  ',
      })
      const result = await createPlaygroupPlayerDeck('player-1', formData)

      expect(result).toEqual({ success: true, deckId: 'deck-1' })
      expect(db.playgroupPlayerDeck.create).toHaveBeenCalledWith({
        data: {
          playgroupPlayerId: 'player-1',
          name: 'Test Deck',
          format: 'commander',
          commander1: 'Krenko, Mob Boss',
          commander2: null,
          bracket: null,
          decklistUrl: null,
        },
      })
    })
  })

  describe('updatePlaygroupPlayerDeck', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const formData = createFormData({ name: 'Updated Deck', format: 'commander' })
      const result = await updatePlaygroupPlayerDeck('deck-1', formData)

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when deck not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayerDeck.findUnique).mockResolvedValue(null)

      const formData = createFormData({ name: 'Updated Deck', format: 'commander' })
      const result = await updatePlaygroupPlayerDeck('deck-1', formData)

      expect(result).toEqual({ error: 'Deck not found' })
    })

    it('returns error when user is not a member', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayerDeck.findUnique).mockResolvedValue({
        id: 'deck-1',
        playgroupPlayer: {
          playgroupId: 'pg-1',
          id: 'player-1',
        },
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue(null)

      const formData = createFormData({ name: 'Updated Deck', format: 'commander' })
      const result = await updatePlaygroupPlayerDeck('deck-1', formData)

      expect(result).toEqual({ error: 'You are not a member of this playgroup' })
    })

    it('returns error when name is empty', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayerDeck.findUnique).mockResolvedValue({
        id: 'deck-1',
        playgroupPlayer: {
          playgroupId: 'pg-1',
          id: 'player-1',
        },
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1',
        playgroupId: 'pg-1',
        userId: 'user-1',
        role: 'member',
        joinedAt: new Date(),
        invitedById: null,
      })

      const formData = createFormData({ name: '', format: 'commander' })
      const result = await updatePlaygroupPlayerDeck('deck-1', formData)

      expect(result).toEqual({ error: 'Deck name is required' })
    })

    it('returns error when format is invalid', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayerDeck.findUnique).mockResolvedValue({
        id: 'deck-1',
        playgroupPlayer: {
          playgroupId: 'pg-1',
          id: 'player-1',
        },
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1',
        playgroupId: 'pg-1',
        userId: 'user-1',
        role: 'member',
        joinedAt: new Date(),
        invitedById: null,
      })

      const formData = createFormData({ name: 'Updated Deck', format: 'invalid' })
      const result = await updatePlaygroupPlayerDeck('deck-1', formData)

      expect(result).toEqual({ error: 'Invalid format selected' })
    })

    it('updates deck with valid data', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayerDeck.findUnique).mockResolvedValue({
        id: 'deck-1',
        playgroupPlayer: {
          playgroupId: 'pg-1',
          id: 'player-1',
        },
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1',
        playgroupId: 'pg-1',
        userId: 'user-1',
        role: 'member',
        joinedAt: new Date(),
        invitedById: null,
      })

      vi.mocked(db.playgroupPlayerDeck.update).mockResolvedValue({
        id: 'deck-1',
        playgroupPlayerId: 'player-1',
        name: 'Updated Deck',
        format: 'modern',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        linkedDeckId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const formData = createFormData({ name: 'Updated Deck', format: 'modern' })
      const result = await updatePlaygroupPlayerDeck('deck-1', formData)

      expect(result).toEqual({ success: true })
      expect(db.playgroupPlayerDeck.update).toHaveBeenCalledWith({
        where: { id: 'deck-1' },
        data: {
          name: 'Updated Deck',
          format: 'modern',
          commander1: null,
          commander2: null,
          bracket: null,
          decklistUrl: null,
        },
      })
    })
  })

  describe('deletePlaygroupPlayerDeck', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await deletePlaygroupPlayerDeck('deck-1')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when deck not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayerDeck.findUnique).mockResolvedValue(null)

      const result = await deletePlaygroupPlayerDeck('deck-1')

      expect(result).toEqual({ error: 'Deck not found' })
    })

    it('returns error when user is not admin', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayerDeck.findUnique).mockResolvedValue({
        id: 'deck-1',
        playgroupPlayer: {
          playgroupId: 'pg-1',
          id: 'player-1',
        },
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

      const result = await deletePlaygroupPlayerDeck('deck-1')

      expect(result).toEqual({ error: 'Only admins can delete decks' })
    })

    it('returns error when deck has game history', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayerDeck.findUnique).mockResolvedValue({
        id: 'deck-1',
        playgroupPlayer: {
          playgroupId: 'pg-1',
          id: 'player-1',
        },
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

      const result = await deletePlaygroupPlayerDeck('deck-1')

      expect(result).toEqual({ error: 'Cannot delete deck with game history. Consider archiving it instead.' })
    })

    it('deletes deck when admin and no game history', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayerDeck.findUnique).mockResolvedValue({
        id: 'deck-1',
        playgroupPlayer: {
          playgroupId: 'pg-1',
          id: 'player-1',
        },
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

      vi.mocked(db.playgroupPlayerDeck.delete).mockResolvedValue({
        id: 'deck-1',
        playgroupPlayerId: 'player-1',
        name: 'Test Deck',
        format: 'commander',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        linkedDeckId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await deletePlaygroupPlayerDeck('deck-1')

      expect(result).toEqual({ success: true })
    })

    it('allows owner to delete deck', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayerDeck.findUnique).mockResolvedValue({
        id: 'deck-1',
        playgroupPlayer: {
          playgroupId: 'pg-1',
          id: 'player-1',
        },
        _count: { gamePlayers: 0 },
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1',
        playgroupId: 'pg-1',
        userId: 'user-1',
        role: 'owner',
        joinedAt: new Date(),
        invitedById: null,
      })

      vi.mocked(db.playgroupPlayerDeck.delete).mockResolvedValue({
        id: 'deck-1',
        playgroupPlayerId: 'player-1',
        name: 'Test Deck',
        format: 'commander',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        linkedDeckId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await deletePlaygroupPlayerDeck('deck-1')

      expect(result).toEqual({ success: true })
    })
  })

  describe('toggleArchivePlaygroupPlayerDeck', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await toggleArchivePlaygroupPlayerDeck('deck-1')

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when deck not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayerDeck.findUnique).mockResolvedValue(null)

      const result = await toggleArchivePlaygroupPlayerDeck('deck-1')

      expect(result).toEqual({ error: 'Deck not found' })
    })

    it('returns error when user is not a member', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayerDeck.findUnique).mockResolvedValue({
        id: 'deck-1',
        isActive: true,
        playgroupPlayer: {
          playgroupId: 'pg-1',
          id: 'player-1',
        },
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue(null)

      const result = await toggleArchivePlaygroupPlayerDeck('deck-1')

      expect(result).toEqual({ error: 'You are not a member of this playgroup' })
    })

    it('archives active deck', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayerDeck.findUnique).mockResolvedValue({
        id: 'deck-1',
        isActive: true,
        playgroupPlayer: {
          playgroupId: 'pg-1',
          id: 'player-1',
        },
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1',
        playgroupId: 'pg-1',
        userId: 'user-1',
        role: 'member',
        joinedAt: new Date(),
        invitedById: null,
      })

      vi.mocked(db.playgroupPlayerDeck.update).mockResolvedValue({
        id: 'deck-1',
        playgroupPlayerId: 'player-1',
        name: 'Test Deck',
        format: 'commander',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        linkedDeckId: null,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await toggleArchivePlaygroupPlayerDeck('deck-1')

      expect(result).toEqual({ success: true })
      expect(db.playgroupPlayerDeck.update).toHaveBeenCalledWith({
        where: { id: 'deck-1' },
        data: { isActive: false },
      })
    })

    it('restores archived deck', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupPlayerDeck.findUnique).mockResolvedValue({
        id: 'deck-1',
        isActive: false,
        playgroupPlayer: {
          playgroupId: 'pg-1',
          id: 'player-1',
        },
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1',
        playgroupId: 'pg-1',
        userId: 'user-1',
        role: 'member',
        joinedAt: new Date(),
        invitedById: null,
      })

      vi.mocked(db.playgroupPlayerDeck.update).mockResolvedValue({
        id: 'deck-1',
        playgroupPlayerId: 'player-1',
        name: 'Test Deck',
        format: 'commander',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        linkedDeckId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await toggleArchivePlaygroupPlayerDeck('deck-1')

      expect(result).toEqual({ success: true })
      expect(db.playgroupPlayerDeck.update).toHaveBeenCalledWith({
        where: { id: 'deck-1' },
        data: { isActive: true },
      })
    })
  })
})
