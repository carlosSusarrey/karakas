import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the dependencies
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    deck: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { redirect } from 'next/navigation'
import { createDeck } from '../new/actions'
import { deleteDeck, toggleArchiveDeck, updateDeck } from '../[id]/actions'

// Helper to create FormData
function createFormData(data: Record<string, string | null>): FormData {
  const formData = new FormData()
  for (const [key, value] of Object.entries(data)) {
    if (value !== null) {
      formData.set(key, value)
    }
  }
  return formData
}

describe('Deck Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createDeck', () => {
    it('redirects to login when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const formData = createFormData({ name: 'Test Deck', format: 'commander' })

      await expect(createDeck(formData)).rejects.toThrow('REDIRECT:/login')
      expect(redirect).toHaveBeenCalledWith('/login')
    })

    it('returns error when name is empty', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      const formData = createFormData({ name: '', format: 'commander' })
      const result = await createDeck(formData)

      expect(result).toEqual({ error: 'Deck name is required.' })
    })

    it('returns error when name is only whitespace', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      const formData = createFormData({ name: '   ', format: 'commander' })
      const result = await createDeck(formData)

      expect(result).toEqual({ error: 'Deck name is required.' })
    })

    it('returns error when format is empty', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      const formData = createFormData({ name: 'Test Deck', format: '' })
      const result = await createDeck(formData)

      expect(result).toEqual({ error: 'Invalid format "(empty)". Please select a valid format.' })
    })

    it('returns error when format is invalid', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      const formData = createFormData({ name: 'Test Deck', format: 'invalid-format' })
      const result = await createDeck(formData)

      expect(result).toEqual({ error: 'Invalid format "invalid-format". Please select a valid format.' })
    })

    it('returns error when bracket is invalid (less than 1)', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      const formData = createFormData({ name: 'Test Deck', format: 'commander', bracket: '0' })
      const result = await createDeck(formData)

      expect(result).toEqual({ error: 'Invalid bracket value "0". Must be between 1 and 4.' })
    })

    it('returns error when bracket is invalid (greater than 4)', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      const formData = createFormData({ name: 'Test Deck', format: 'commander', bracket: '5' })
      const result = await createDeck(formData)

      expect(result).toEqual({ error: 'Invalid bracket value "5". Must be between 1 and 4.' })
    })

    it('creates deck with minimal data', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.create).mockResolvedValue({
        id: 'deck-1',
        userId: 'user-1',
        name: 'Test Deck',
        format: 'modern',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const formData = createFormData({ name: 'Test Deck', format: 'modern' })
      const result = await createDeck(formData)

      expect(result).toEqual({ success: true, deckId: 'deck-1' })
      expect(db.deck.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
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

      vi.mocked(db.deck.create).mockResolvedValue({
        id: 'deck-1',
        userId: 'user-1',
        name: 'Atraxa Superfriends',
        format: 'commander',
        commander1: 'Atraxa, Praetors\' Voice',
        commander2: null,
        bracket: 3,
        decklistUrl: 'https://moxfield.com/decks/abc123',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const formData = createFormData({
        name: 'Atraxa Superfriends',
        format: 'commander',
        commander1: 'Atraxa, Praetors\' Voice',
        bracket: '3',
        decklistUrl: 'https://moxfield.com/decks/abc123',
      })
      const result = await createDeck(formData)

      expect(result).toEqual({ success: true, deckId: 'deck-1' })
      expect(db.deck.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          name: 'Atraxa Superfriends',
          format: 'commander',
          commander1: 'Atraxa, Praetors\' Voice',
          commander2: null,
          bracket: 3,
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

      vi.mocked(db.deck.create).mockResolvedValue({
        id: 'deck-1',
        userId: 'user-1',
        name: 'Partner Deck',
        format: 'commander',
        commander1: 'Thrasios, Triton Hero',
        commander2: 'Tymna the Weaver',
        bracket: 4,
        decklistUrl: null,
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
      const result = await createDeck(formData)

      expect(result).toEqual({ success: true, deckId: 'deck-1' })
    })

    it('trims whitespace from name and commander', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.create).mockResolvedValue({
        id: 'deck-1',
        userId: 'user-1',
        name: 'Test Deck',
        format: 'commander',
        commander1: 'Atraxa',
        commander2: null,
        bracket: null,
        decklistUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const formData = createFormData({
        name: '  Test Deck  ',
        format: 'commander',
        commander1: '  Atraxa  ',
      })
      const result = await createDeck(formData)

      expect(result).toEqual({ success: true, deckId: 'deck-1' })
      expect(db.deck.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Test Deck',
          commander1: 'Atraxa',
        }),
      })
    })

    it('handles database unique constraint error', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.create).mockRejectedValue(new Error('Unique constraint failed'))

      const formData = createFormData({ name: 'Duplicate Deck', format: 'modern' })
      const result = await createDeck(formData)

      expect(result).toEqual({ error: 'A deck with this name already exists.' })
    })

    it('supports all valid MTG formats', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      const validFormats = ['standard', 'modern', 'legacy', 'vintage', 'pioneer', 'pauper', 'commander', 'oathbreaker', 'brawl', 'draft', 'sealed']

      for (const format of validFormats) {
        vi.mocked(db.deck.create).mockResolvedValue({
          id: `deck-${format}`,
          userId: 'user-1',
          name: `${format} Deck`,
          format,
          commander1: null,
          commander2: null,
          bracket: null,
          decklistUrl: null,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        })

        const formData = createFormData({ name: `${format} Deck`, format })
        const result = await createDeck(formData)

        expect(result).toEqual({ success: true, deckId: `deck-${format}` })
      }
    })
  })

  describe('deleteDeck', () => {
    it('redirects to login when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      await expect(deleteDeck('deck-1')).rejects.toThrow('REDIRECT:/login')
      expect(redirect).toHaveBeenCalledWith('/login')
    })

    it('returns error when deck not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.findUnique).mockResolvedValue(null)

      const result = await deleteDeck('nonexistent-deck')

      expect(result).toEqual({ error: 'Deck not found' })
    })

    it('returns error when deck belongs to another user', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.findUnique).mockResolvedValue({
        id: 'deck-1',
        userId: 'other-user',
        name: 'Other User Deck',
        format: 'modern',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await deleteDeck('deck-1')

      expect(result).toEqual({ error: 'Deck not found' })
    })

    it('successfully deletes deck', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.findUnique).mockResolvedValue({
        id: 'deck-1',
        userId: 'user-1',
        name: 'My Deck',
        format: 'modern',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.deck.delete).mockResolvedValue({
        id: 'deck-1',
        userId: 'user-1',
        name: 'My Deck',
        format: 'modern',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await deleteDeck('deck-1')

      expect(result).toEqual({ success: true })
      expect(db.deck.delete).toHaveBeenCalledWith({ where: { id: 'deck-1' } })
    })

    it('handles delete failure', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.findUnique).mockResolvedValue({
        id: 'deck-1',
        userId: 'user-1',
        name: 'My Deck',
        format: 'modern',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.deck.delete).mockRejectedValue(new Error('Database error'))

      const result = await deleteDeck('deck-1')

      expect(result).toEqual({ error: 'Failed to delete deck' })
    })
  })

  describe('toggleArchiveDeck', () => {
    it('redirects to login when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      await expect(toggleArchiveDeck('deck-1')).rejects.toThrow('REDIRECT:/login')
      expect(redirect).toHaveBeenCalledWith('/login')
    })

    it('returns error when deck not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.findUnique).mockResolvedValue(null)

      const result = await toggleArchiveDeck('nonexistent-deck')

      expect(result).toEqual({ error: 'Deck not found' })
    })

    it('returns error when deck belongs to another user', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.findUnique).mockResolvedValue({
        id: 'deck-1',
        userId: 'other-user',
        name: 'Other User Deck',
        format: 'modern',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await toggleArchiveDeck('deck-1')

      expect(result).toEqual({ error: 'Deck not found' })
    })

    it('archives an active deck', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.findUnique).mockResolvedValue({
        id: 'deck-1',
        userId: 'user-1',
        name: 'My Deck',
        format: 'modern',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.deck.update).mockResolvedValue({
        id: 'deck-1',
        userId: 'user-1',
        name: 'My Deck',
        format: 'modern',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await toggleArchiveDeck('deck-1')

      expect(result).toEqual({ success: true })
      expect(db.deck.update).toHaveBeenCalledWith({
        where: { id: 'deck-1' },
        data: { isActive: false },
      })
    })

    it('restores an archived deck', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.findUnique).mockResolvedValue({
        id: 'deck-1',
        userId: 'user-1',
        name: 'My Deck',
        format: 'modern',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        isActive: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.deck.update).mockResolvedValue({
        id: 'deck-1',
        userId: 'user-1',
        name: 'My Deck',
        format: 'modern',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await toggleArchiveDeck('deck-1')

      expect(result).toEqual({ success: true })
      expect(db.deck.update).toHaveBeenCalledWith({
        where: { id: 'deck-1' },
        data: { isActive: true },
      })
    })

    it('handles update failure', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.findUnique).mockResolvedValue({
        id: 'deck-1',
        userId: 'user-1',
        name: 'My Deck',
        format: 'modern',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.deck.update).mockRejectedValue(new Error('Database error'))

      const result = await toggleArchiveDeck('deck-1')

      expect(result).toEqual({ error: 'Failed to update deck' })
    })
  })

  describe('updateDeck', () => {
    it('redirects to login when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const formData = createFormData({ name: 'Updated Deck', format: 'modern' })

      await expect(updateDeck('deck-1', formData)).rejects.toThrow('REDIRECT:/login')
      expect(redirect).toHaveBeenCalledWith('/login')
    })

    it('returns error when deck not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.findUnique).mockResolvedValue(null)

      const formData = createFormData({ name: 'Updated Deck', format: 'modern' })
      const result = await updateDeck('nonexistent-deck', formData)

      expect(result).toEqual({ error: 'Deck not found' })
    })

    it('returns error when deck belongs to another user', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.findUnique).mockResolvedValue({
        id: 'deck-1',
        userId: 'other-user',
        name: 'Other User Deck',
        format: 'modern',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const formData = createFormData({ name: 'Updated Deck', format: 'modern' })
      const result = await updateDeck('deck-1', formData)

      expect(result).toEqual({ error: 'Deck not found' })
    })

    it('returns error when name is empty', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.findUnique).mockResolvedValue({
        id: 'deck-1',
        userId: 'user-1',
        name: 'My Deck',
        format: 'modern',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const formData = createFormData({ name: '', format: 'modern' })
      const result = await updateDeck('deck-1', formData)

      expect(result).toEqual({ error: 'Deck name is required' })
    })

    it('returns error when format is invalid', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.findUnique).mockResolvedValue({
        id: 'deck-1',
        userId: 'user-1',
        name: 'My Deck',
        format: 'modern',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const formData = createFormData({ name: 'Updated Deck', format: 'invalid-format' })
      const result = await updateDeck('deck-1', formData)

      expect(result).toEqual({ error: 'Invalid format selected' })
    })

    it('returns error when bracket is invalid', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.findUnique).mockResolvedValue({
        id: 'deck-1',
        userId: 'user-1',
        name: 'My Deck',
        format: 'commander',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const formData = createFormData({ name: 'Updated Deck', format: 'commander', bracket: '5' })
      const result = await updateDeck('deck-1', formData)

      expect(result).toEqual({ error: 'Invalid bracket value' })
    })

    it('successfully updates deck', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.findUnique).mockResolvedValue({
        id: 'deck-1',
        userId: 'user-1',
        name: 'My Deck',
        format: 'modern',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.deck.update).mockResolvedValue({
        id: 'deck-1',
        userId: 'user-1',
        name: 'Updated Deck',
        format: 'commander',
        commander1: 'Kenrith, the Returned King',
        commander2: null,
        bracket: 3,
        decklistUrl: 'https://moxfield.com/decks/xyz',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const formData = createFormData({
        name: 'Updated Deck',
        format: 'commander',
        commander1: 'Kenrith, the Returned King',
        bracket: '3',
        decklistUrl: 'https://moxfield.com/decks/xyz',
      })
      const result = await updateDeck('deck-1', formData)

      expect(result).toEqual({ success: true })
      expect(db.deck.update).toHaveBeenCalledWith({
        where: { id: 'deck-1' },
        data: {
          name: 'Updated Deck',
          format: 'commander',
          commander1: 'Kenrith, the Returned King',
          commander2: null,
          bracket: 3,
          decklistUrl: 'https://moxfield.com/decks/xyz',
        },
      })
    })

    it('handles update failure', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.findUnique).mockResolvedValue({
        id: 'deck-1',
        userId: 'user-1',
        name: 'My Deck',
        format: 'modern',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.deck.update).mockRejectedValue(new Error('Database error'))

      const formData = createFormData({ name: 'Updated Deck', format: 'modern' })
      const result = await updateDeck('deck-1', formData)

      expect(result).toEqual({ error: 'Failed to update deck' })
    })
  })
})
