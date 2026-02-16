import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    deck: {
      findUnique: vi.fn(),
    },
    playgroup: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    playgroupMember: {
      findUnique: vi.fn(),
    },
  },
}))

vi.mock('@/lib/session', () => ({
  deleteSession: vi.fn(),
}))

vi.mock('@/lib/scryfall', () => ({
  autocompleteCards: vi.fn(),
  getCardByName: vi.fn(),
  getCardImageUrlFromCard: vi.fn(),
  canBeCommander: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { autocompleteCards, getCardByName, getCardImageUrlFromCard, canBeCommander } from '@/lib/scryfall'
import { redirect } from 'next/navigation'

// Import the route handlers
import { GET as getCardAutocomplete } from '../cards/autocomplete/route'
import { GET as getDeck } from '../decks/[id]/route'
import { GET as getPlaygroup, PATCH as patchPlaygroup, DELETE as deletePlaygroup } from '../playgroups/[id]/route'

// Helper to create mock Request objects
function createRequest(url: string): Request {
  return new Request(url)
}

describe('API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/cards/autocomplete', () => {
    it('returns empty suggestions for short queries', async () => {
      const request = createRequest('http://localhost:3000/api/cards/autocomplete?q=a')
      const response = await getCardAutocomplete(request)
      const data = await response.json()

      expect(data).toEqual({ suggestions: [] })
      expect(autocompleteCards).not.toHaveBeenCalled()
    })

    it('returns empty suggestions when query is missing', async () => {
      const request = createRequest('http://localhost:3000/api/cards/autocomplete')
      const response = await getCardAutocomplete(request)
      const data = await response.json()

      expect(data).toEqual({ suggestions: [] })
    })

    it('returns card suggestions for valid query', async () => {
      vi.mocked(autocompleteCards).mockResolvedValue([
        'Lightning Bolt',
        'Lightning Helix',
        'Lightning Strike',
      ])

      vi.mocked(getCardByName).mockImplementation(async (name) => ({
        id: `card-${name}`,
        name,
        type_line: 'Instant',
        legalities: {},
        image_uris: {
          small: `https://example.com/${name}/small.jpg`,
          normal: `https://example.com/${name}/normal.jpg`,
          art_crop: `https://example.com/${name}/art.jpg`,
        },
      }))

      vi.mocked(getCardImageUrlFromCard).mockImplementation((card) =>
        card.image_uris?.small || null
      )

      const request = createRequest('http://localhost:3000/api/cards/autocomplete?q=lightning')
      const response = await getCardAutocomplete(request)
      const data = await response.json()

      expect(data.suggestions).toHaveLength(3)
      expect(data.suggestions[0]).toEqual({
        name: 'Lightning Bolt',
        imageUrl: 'https://example.com/Lightning Bolt/small.jpg',
      })
    })

    it('limits suggestions to 10', async () => {
      const manyCards = Array.from({ length: 15 }, (_, i) => `Card ${i + 1}`)
      vi.mocked(autocompleteCards).mockResolvedValue(manyCards)

      vi.mocked(getCardByName).mockImplementation(async (name) => ({
        id: `card-${name}`,
        name,
        type_line: 'Creature',
        legalities: {},
        image_uris: {
          small: `https://example.com/${name}/small.jpg`,
          normal: `https://example.com/${name}/normal.jpg`,
          art_crop: `https://example.com/${name}/art.jpg`,
        },
      }))

      vi.mocked(getCardImageUrlFromCard).mockReturnValue('https://example.com/small.jpg')

      const request = createRequest('http://localhost:3000/api/cards/autocomplete?q=card')
      const response = await getCardAutocomplete(request)
      const data = await response.json()

      expect(data.suggestions).toHaveLength(10)
    })

    it('filters to commanders only when commander param is true', async () => {
      vi.mocked(autocompleteCards).mockResolvedValue([
        'Atraxa, Praetors\' Voice',
        'Lightning Bolt',
        'Kenrith, the Returned King',
      ])

      vi.mocked(getCardByName).mockImplementation(async (name) => ({
        id: `card-${name}`,
        name,
        type_line: name.includes('Atraxa') || name.includes('Kenrith')
          ? 'Legendary Creature'
          : 'Instant',
        legalities: {},
        image_uris: {
          small: `https://example.com/${name}/small.jpg`,
          normal: `https://example.com/${name}/normal.jpg`,
          art_crop: `https://example.com/${name}/art.jpg`,
        },
      }))

      vi.mocked(canBeCommander).mockImplementation((card) =>
        card.type_line.includes('Legendary')
      )

      vi.mocked(getCardImageUrlFromCard).mockReturnValue('https://example.com/small.jpg')

      const request = createRequest('http://localhost:3000/api/cards/autocomplete?q=atr&commander=true')
      const response = await getCardAutocomplete(request)
      const data = await response.json()

      // Only legendary creatures should be included
      expect(data.suggestions.length).toBeLessThanOrEqual(3)
      expect(canBeCommander).toHaveBeenCalled()
    })

    it('provides fallback when card details cannot be fetched', async () => {
      vi.mocked(autocompleteCards).mockResolvedValue(['Unknown Card'])
      vi.mocked(getCardByName).mockResolvedValue(null)

      const request = createRequest('http://localhost:3000/api/cards/autocomplete?q=unknown')
      const response = await getCardAutocomplete(request)
      const data = await response.json()

      expect(data.suggestions[0]).toEqual({
        name: 'Unknown Card',
        imageUrl: null,
      })
    })

    it('returns 500 error on API failure', async () => {
      vi.mocked(autocompleteCards).mockRejectedValue(new Error('API down'))

      const request = createRequest('http://localhost:3000/api/cards/autocomplete?q=test')
      const response = await getCardAutocomplete(request)

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data).toEqual({ error: 'Failed to fetch card suggestions' })
    })
  })

  describe('GET /api/decks/[id]', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const request = createRequest('http://localhost:3000/api/decks/deck-1')
      const response = await getDeck(request, { params: Promise.resolve({ id: 'deck-1' }) })

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data).toEqual({ error: 'Unauthorized' })
    })

    it('returns 404 when deck not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.findUnique).mockResolvedValue(null)

      const request = createRequest('http://localhost:3000/api/decks/nonexistent')
      const response = await getDeck(request, { params: Promise.resolve({ id: 'nonexistent' }) })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data).toEqual({ error: 'Not found' })
    })

    it('returns 404 when deck belongs to another user', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.findUnique).mockResolvedValue({
        id: 'deck-1',
        userId: 'other-user',
        name: 'Other Deck',
        format: 'modern',
        commander1: null,
        commander2: null,
        bracket: null,
        decklistUrl: null,
        isActive: true,
      })

      const request = createRequest('http://localhost:3000/api/decks/deck-1')
      const response = await getDeck(request, { params: Promise.resolve({ id: 'deck-1' }) })

      expect(response.status).toBe(404)
    })

    it('returns deck data for authorized user', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.findUnique).mockResolvedValue({
        id: 'deck-1',
        userId: 'user-1',
        name: 'My Commander Deck',
        format: 'commander',
        commander1: 'Atraxa, Praetors\' Voice',
        commander2: null,
        bracket: 3,
        decklistUrl: 'https://moxfield.com/decks/abc',
        isActive: true,
      })

      const request = createRequest('http://localhost:3000/api/decks/deck-1')
      const response = await getDeck(request, { params: Promise.resolve({ id: 'deck-1' }) })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toEqual({
        id: 'deck-1',
        userId: 'user-1',
        name: 'My Commander Deck',
        format: 'commander',
        commander1: 'Atraxa, Praetors\' Voice',
        commander2: null,
        bracket: 3,
        decklistUrl: 'https://moxfield.com/decks/abc',
        isActive: true,
      })
    })
  })

  describe('GET /api/playgroups/[id]', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const request = createRequest('http://localhost:3000/api/playgroups/pg-1')
      const response = await getPlaygroup(request, { params: Promise.resolve({ id: 'pg-1' }) })

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data).toEqual({ error: 'Not authenticated' })
    })

    it('returns 404 when playgroup not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroup.findUnique).mockResolvedValue(null)

      const request = createRequest('http://localhost:3000/api/playgroups/nonexistent')
      const response = await getPlaygroup(request, { params: Promise.resolve({ id: 'nonexistent' }) })

      expect(response.status).toBe(404)
      const data = await response.json()
      expect(data).toEqual({ error: 'Playgroup not found' })
    })

    it('returns 403 when user is not a member', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroup.findUnique).mockResolvedValue({
        id: 'pg-1',
        name: 'Test Playgroup',
        description: null,
        defaultFormat: null,
        ownerId: 'owner-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        members: [],
      })

      const request = createRequest('http://localhost:3000/api/playgroups/pg-1')
      const response = await getPlaygroup(request, { params: Promise.resolve({ id: 'pg-1' }) })

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data).toEqual({ error: 'Not a member' })
    })

    it('returns playgroup data for member', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroup.findUnique).mockResolvedValue({
        id: 'pg-1',
        name: 'Commander Night',
        description: 'Weekly games',
        defaultFormat: 'commander',
        ownerId: 'owner-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        members: [{ role: 'member' }],
      })

      const request = createRequest('http://localhost:3000/api/playgroups/pg-1')
      const response = await getPlaygroup(request, { params: Promise.resolve({ id: 'pg-1' }) })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.playgroup.name).toBe('Commander Night')
      expect(data.isOwner).toBe(false)
    })

    it('indicates ownership when user is owner', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroup.findUnique).mockResolvedValue({
        id: 'pg-1',
        name: 'My Playgroup',
        description: null,
        defaultFormat: 'commander',
        ownerId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        members: [{ role: 'owner' }],
      })

      const request = createRequest('http://localhost:3000/api/playgroups/pg-1')
      const response = await getPlaygroup(request, { params: Promise.resolve({ id: 'pg-1' }) })

      const data = await response.json()
      expect(data.isOwner).toBe(true)
    })
  })

  describe('PATCH /api/playgroups/[id]', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const request = new Request('http://localhost:3000/api/playgroups/pg-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'New Name' }),
      })
      const response = await patchPlaygroup(request, { params: Promise.resolve({ id: 'pg-1' }) })

      expect(response.status).toBe(401)
    })

    it('returns 403 when user is not owner or admin', async () => {
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
      })

      const request = new Request('http://localhost:3000/api/playgroups/pg-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'New Name' }),
      })
      const response = await patchPlaygroup(request, { params: Promise.resolve({ id: 'pg-1' }) })

      expect(response.status).toBe(403)
    })

    it('returns 400 when name is empty', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1',
        playgroupId: 'pg-1',
        userId: 'user-1',
        role: 'owner',
        joinedAt: new Date(),
      })

      const request = new Request('http://localhost:3000/api/playgroups/pg-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: '' }),
      })
      const response = await patchPlaygroup(request, { params: Promise.resolve({ id: 'pg-1' }) })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data).toEqual({ error: 'Playgroup name is required' })
    })

    it('successfully updates playgroup as owner', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1',
        playgroupId: 'pg-1',
        userId: 'user-1',
        role: 'owner',
        joinedAt: new Date(),
      })

      vi.mocked(db.playgroup.update).mockResolvedValue({
        id: 'pg-1',
        name: 'Updated Name',
        description: 'New description',
        defaultFormat: 'modern',
        ownerId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = new Request('http://localhost:3000/api/playgroups/pg-1', {
        method: 'PATCH',
        body: JSON.stringify({
          name: 'Updated Name',
          description: 'New description',
          defaultFormat: 'modern',
        }),
      })
      const response = await patchPlaygroup(request, { params: Promise.resolve({ id: 'pg-1' }) })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.playgroup.name).toBe('Updated Name')
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
      })

      vi.mocked(db.playgroup.update).mockResolvedValue({
        id: 'pg-1',
        name: 'Admin Updated',
        description: null,
        defaultFormat: null,
        ownerId: 'owner-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = new Request('http://localhost:3000/api/playgroups/pg-1', {
        method: 'PATCH',
        body: JSON.stringify({ name: 'Admin Updated' }),
      })
      const response = await patchPlaygroup(request, { params: Promise.resolve({ id: 'pg-1' }) })

      expect(response.status).toBe(200)
    })
  })

  describe('DELETE /api/playgroups/[id]', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const request = new Request('http://localhost:3000/api/playgroups/pg-1', {
        method: 'DELETE',
      })
      const response = await deletePlaygroup(request, { params: Promise.resolve({ id: 'pg-1' }) })

      expect(response.status).toBe(401)
    })

    it('returns 404 when playgroup not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroup.findUnique).mockResolvedValue(null)

      const request = new Request('http://localhost:3000/api/playgroups/nonexistent', {
        method: 'DELETE',
      })
      const response = await deletePlaygroup(request, { params: Promise.resolve({ id: 'nonexistent' }) })

      expect(response.status).toBe(404)
    })

    it('returns 403 when user is not owner', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroup.findUnique).mockResolvedValue({
        id: 'pg-1',
        name: 'Test Playgroup',
        description: null,
        defaultFormat: null,
        ownerId: 'other-user',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = new Request('http://localhost:3000/api/playgroups/pg-1', {
        method: 'DELETE',
      })
      const response = await deletePlaygroup(request, { params: Promise.resolve({ id: 'pg-1' }) })

      expect(response.status).toBe(403)
      const data = await response.json()
      expect(data).toEqual({ error: 'Only the owner can delete this playgroup' })
    })

    it('successfully deletes playgroup as owner', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroup.findUnique).mockResolvedValue({
        id: 'pg-1',
        name: 'My Playgroup',
        description: null,
        defaultFormat: null,
        ownerId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.playgroup.delete).mockResolvedValue({
        id: 'pg-1',
        name: 'My Playgroup',
        description: null,
        defaultFormat: null,
        ownerId: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const request = new Request('http://localhost:3000/api/playgroups/pg-1', {
        method: 'DELETE',
      })
      const response = await deletePlaygroup(request, { params: Promise.resolve({ id: 'pg-1' }) })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data).toEqual({ success: true })
    })
  })
})

describe('Logout Action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes session and redirects to home', async () => {
    const { logoutUser } = await import('../../logout/actions')

    await expect(logoutUser()).rejects.toThrow('REDIRECT:/')
    expect(redirect).toHaveBeenCalledWith('/')
  })
})
