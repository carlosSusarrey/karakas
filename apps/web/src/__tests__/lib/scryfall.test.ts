import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock fetch globally
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import {
  autocompleteCards,
  getCardByName,
  getCardImageUrlFromCard,
  isLegendaryCreature,
  canBeCommander,
  getCardImageUrl,
  searchCommanders,
  type ScryfallCard,
} from '@/lib/scryfall'

describe('Scryfall Library', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear module cache to reset the in-memory caches
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('autocompleteCards', () => {
    it('returns empty array for queries shorter than 2 characters', async () => {
      const result = await autocompleteCards('a')
      expect(result).toEqual([])
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('returns card names from Scryfall API', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          object: 'catalog',
          total_values: 3,
          data: ['Lightning Bolt', 'Lightning Helix', 'Lightning Strike'],
        }),
      })

      const result = await autocompleteCards('lightning')

      expect(result).toEqual(['Lightning Bolt', 'Lightning Helix', 'Lightning Strike'])
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.scryfall.com/cards/autocomplete?q=lightning',
        expect.objectContaining({
          headers: { 'User-Agent': 'Karakas/1.0' },
        })
      )
    })

    it('returns empty array on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await autocompleteCards('test')

      expect(result).toEqual([])
    })

    it('returns empty array on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await autocompleteCards('test')

      expect(result).toEqual([])
    })
  })

  describe('getCardByName', () => {
    it('returns card data from Scryfall API', async () => {
      const mockCard: ScryfallCard = {
        id: 'card-123',
        name: 'Lightning Bolt',
        type_line: 'Instant',
        oracle_text: 'Lightning Bolt deals 3 damage to any target.',
        legalities: { standard: 'not_legal', modern: 'legal' },
        image_uris: {
          small: 'https://example.com/small.jpg',
          normal: 'https://example.com/normal.jpg',
          art_crop: 'https://example.com/art.jpg',
        },
      }

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockCard),
      })

      const result = await getCardByName('Lightning Bolt')

      expect(result).toEqual(mockCard)
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.scryfall.com/cards/named?exact=Lightning%20Bolt',
        expect.objectContaining({
          headers: { 'User-Agent': 'Karakas/1.0' },
        })
      )
    })

    it('returns null for non-existent card', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await getCardByName('NonexistentCard123')

      expect(result).toBeNull()
    })

    it('returns null on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await getCardByName('Test Card')

      expect(result).toBeNull()
    })
  })

  describe('getCardImageUrlFromCard', () => {
    it('returns image URL for normal card', () => {
      const card: ScryfallCard = {
        id: 'card-123',
        name: 'Lightning Bolt',
        type_line: 'Instant',
        legalities: {},
        image_uris: {
          small: 'https://example.com/small.jpg',
          normal: 'https://example.com/normal.jpg',
          art_crop: 'https://example.com/art.jpg',
        },
      }

      expect(getCardImageUrlFromCard(card)).toBe('https://example.com/small.jpg')
      expect(getCardImageUrlFromCard(card, 'normal')).toBe('https://example.com/normal.jpg')
      expect(getCardImageUrlFromCard(card, 'art_crop')).toBe('https://example.com/art.jpg')
    })

    it('returns image URL from first face for double-faced card', () => {
      const card: ScryfallCard = {
        id: 'card-123',
        name: 'Delver of Secrets // Insectile Aberration',
        type_line: 'Creature — Human Wizard // Creature — Human Insect',
        legalities: {},
        card_faces: [
          {
            name: 'Delver of Secrets',
            image_uris: {
              small: 'https://example.com/front-small.jpg',
              normal: 'https://example.com/front-normal.jpg',
              art_crop: 'https://example.com/front-art.jpg',
            },
          },
          {
            name: 'Insectile Aberration',
            image_uris: {
              small: 'https://example.com/back-small.jpg',
              normal: 'https://example.com/back-normal.jpg',
              art_crop: 'https://example.com/back-art.jpg',
            },
          },
        ],
      }

      expect(getCardImageUrlFromCard(card)).toBe('https://example.com/front-small.jpg')
    })

    it('returns null when no image available', () => {
      const card: ScryfallCard = {
        id: 'card-123',
        name: 'Token Card',
        type_line: 'Token',
        legalities: {},
      }

      expect(getCardImageUrlFromCard(card)).toBeNull()
    })
  })

  describe('isLegendaryCreature', () => {
    it('returns true for legendary creatures', () => {
      const card: ScryfallCard = {
        id: 'card-123',
        name: 'Atraxa, Praetors\' Voice',
        type_line: 'Legendary Creature — Phyrexian Angel Horror',
        legalities: {},
      }

      expect(isLegendaryCreature(card)).toBe(true)
    })

    it('returns false for non-legendary creatures', () => {
      const card: ScryfallCard = {
        id: 'card-123',
        name: 'Llanowar Elves',
        type_line: 'Creature — Elf Druid',
        legalities: {},
      }

      expect(isLegendaryCreature(card)).toBe(false)
    })

    it('returns false for legendary non-creatures', () => {
      const card: ScryfallCard = {
        id: 'card-123',
        name: 'The Great Henge',
        type_line: 'Legendary Artifact',
        legalities: {},
      }

      expect(isLegendaryCreature(card)).toBe(false)
    })
  })

  describe('canBeCommander', () => {
    it('returns true for legendary creatures', () => {
      const card: ScryfallCard = {
        id: 'card-123',
        name: 'Kenrith, the Returned King',
        type_line: 'Legendary Creature — Human Noble',
        legalities: {},
      }

      expect(canBeCommander(card)).toBe(true)
    })

    it('returns true for cards with "can be your commander" text', () => {
      const planeswalker: ScryfallCard = {
        id: 'card-123',
        name: 'Aminatou, the Fateshifter',
        type_line: 'Legendary Planeswalker — Aminatou',
        oracle_text: 'Aminatou, the Fateshifter can be your commander.',
        legalities: {},
      }

      expect(canBeCommander(planeswalker)).toBe(true)
    })

    it('returns true for backgrounds with commander text', () => {
      const background: ScryfallCard = {
        id: 'card-123',
        name: 'Noble Heritage',
        type_line: 'Legendary Enchantment — Background',
        oracle_text: 'Commander creatures you own have "At the beginning of your end step, if you have the initiative, Noble Heritage can be your commander."',
        legalities: {},
      }

      expect(canBeCommander(background)).toBe(true)
    })

    it('returns false for non-legendary creatures', () => {
      const card: ScryfallCard = {
        id: 'card-123',
        name: 'Birds of Paradise',
        type_line: 'Creature — Bird',
        legalities: {},
      }

      expect(canBeCommander(card)).toBe(false)
    })

    it('returns false for regular planeswalkers', () => {
      const planeswalker: ScryfallCard = {
        id: 'card-123',
        name: 'Jace, the Mind Sculptor',
        type_line: 'Legendary Planeswalker — Jace',
        oracle_text: '+2: Look at the top card of target player\'s library.',
        legalities: {},
      }

      expect(canBeCommander(planeswalker)).toBe(false)
    })

    it('handles double-faced cards with oracle text on first face', () => {
      const card: ScryfallCard = {
        id: 'card-123',
        name: 'Westvale Abbey // Ormendahl, Profane Prince',
        type_line: 'Legendary Land // Legendary Creature — Demon',
        card_faces: [
          {
            name: 'Westvale Abbey',
            oracle_text: '{T}: Add {C}. This can be your commander in certain formats.',
          },
          {
            name: 'Ormendahl, Profane Prince',
          },
        ],
        legalities: {},
      }

      expect(canBeCommander(card)).toBe(true)
    })
  })

  describe('searchCommanders', () => {
    it('returns empty array for queries shorter than 2 characters', async () => {
      const result = await searchCommanders('a')
      expect(result).toEqual([])
      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('returns commander cards from Scryfall search API', async () => {
      const mockCards: ScryfallCard[] = [
        {
          id: 'card-1',
          name: 'Atraxa, Praetors\' Voice',
          type_line: 'Legendary Creature — Phyrexian Angel Horror',
          legalities: {},
          image_uris: {
            small: 'https://example.com/atraxa-small.jpg',
            normal: 'https://example.com/atraxa-normal.jpg',
            art_crop: 'https://example.com/atraxa-art.jpg',
          },
        },
        {
          id: 'card-2',
          name: 'Atraxa, Grand Unifier',
          type_line: 'Legendary Creature — Phyrexian Angel',
          legalities: {},
          image_uris: {
            small: 'https://example.com/atraxa2-small.jpg',
            normal: 'https://example.com/atraxa2-normal.jpg',
            art_crop: 'https://example.com/atraxa2-art.jpg',
          },
        },
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ object: 'list', total_cards: 2, has_more: false, data: mockCards }),
      })

      const result = await searchCommanders('atraxa')

      expect(result).toEqual(mockCards)
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('cards/search'),
        expect.objectContaining({
          headers: { 'User-Agent': 'Karakas/1.0' },
        })
      )
      // Verify the query includes is:commander
      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(decodeURIComponent(calledUrl)).toContain('is:commander')
      expect(decodeURIComponent(calledUrl)).toContain('name:atraxa')
    })

    it('returns empty array when no commanders match (404)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await searchCommanders('xyznotacard')

      expect(result).toEqual([])
    })

    it('returns empty array on API error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      })

      const result = await searchCommanders('test')

      expect(result).toEqual([])
    })

    it('returns empty array on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'))

      const result = await searchCommanders('test')

      expect(result).toEqual([])
    })

    it('handles empty data array in response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ object: 'list', total_cards: 0, has_more: false, data: [] }),
      })

      const result = await searchCommanders('ab')

      expect(result).toEqual([])
    })
  })

  describe('getCardImageUrl', () => {
    it('returns image URL for existing card', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'card-123',
          name: 'Lightning Bolt',
          type_line: 'Instant',
          legalities: {},
          image_uris: {
            small: 'https://example.com/small.jpg',
            normal: 'https://example.com/normal.jpg',
            art_crop: 'https://example.com/art.jpg',
          },
        }),
      })

      const result = await getCardImageUrl('Lightning Bolt')

      expect(result).toBe('https://example.com/normal.jpg')
    })

    it('returns null for non-existent card', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      })

      const result = await getCardImageUrl('NonexistentCard')

      expect(result).toBeNull()
    })

    it('returns front face image for double-faced cards', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          id: 'card-123',
          name: 'Delver of Secrets // Insectile Aberration',
          type_line: 'Creature',
          legalities: {},
          card_faces: [
            {
              name: 'Delver of Secrets',
              image_uris: {
                small: 'https://example.com/front-small.jpg',
                normal: 'https://example.com/front-normal.jpg',
                art_crop: 'https://example.com/front-art.jpg',
              },
            },
          ],
        }),
      })

      const result = await getCardImageUrl('Delver of Secrets')

      expect(result).toBe('https://example.com/front-normal.jpg')
    })
  })
})
