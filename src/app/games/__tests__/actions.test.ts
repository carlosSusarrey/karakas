import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the dependencies
vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    game: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    gamePlayer: {
      update: vi.fn(),
    },
    powerPlay: {
      create: vi.fn(),
      delete: vi.fn(),
    },
    playgroupMember: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    deck: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    playgroup: {
      findUnique: vi.fn(),
    },
    playgroupPlayer: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    playgroupPlayerDeck: {
      create: vi.fn(),
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
import { createGame, getUserDecks, getPlaygroupData, getPlaygroupDecks, getPlaygroupPlayerDecks, getRematchData, saveNewDeckFromGame } from '../new/actions'
import { updateGame, deleteGame } from '../[id]/edit/actions'
import {
  updateTurnCount,
  eliminatePlayer,
  reinstatePlayer,
  addPowerPlay,
  removePowerPlay,
  endGame,
} from '../[id]/play/actions'

describe('Game Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createGame', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await createGame({
        format: 'commander',
        players: [
          { id: '1', type: 'guest', guestName: 'Player 1' },
          { id: '2', type: 'guest', guestName: 'Player 2' },
        ],
      })
      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when format is missing', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      const result = await createGame({
        format: '' as 'commander',
        players: [
          { id: '1', type: 'guest', guestName: 'Player 1' },
          { id: '2', type: 'guest', guestName: 'Player 2' },
        ],
      })

      expect(result).toEqual({ error: 'Format is required' })
    })

    it('returns error when less than 2 players', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      const result = await createGame({
        format: 'commander',
        players: [{ id: '1', type: 'guest', guestName: 'Player 1' }],
      })

      expect(result).toEqual({ error: 'At least 2 players are required' })
    })

    it('returns error when user is not a member of the playgroup', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue(null)

      const result = await createGame({
        format: 'commander',
        playgroupId: 'pg-1',
        players: [
          { id: '1', type: 'guest', guestName: 'Player 1' },
          { id: '2', type: 'guest', guestName: 'Player 2' },
        ],
      })

      expect(result).toEqual({ error: 'You are not a member of this playgroup' })
    })

    it('returns error when playgroup member has no user ID', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      const result = await createGame({
        format: 'commander',
        players: [
          { id: '1', type: 'playgroup_member' }, // Missing userId
          { id: '2', type: 'guest', guestName: 'Player 2' },
        ],
      })

      expect(result).toEqual({ error: 'Playgroup members must have a user ID' })
    })

    it('returns error when playgroup player has no player ID', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      const result = await createGame({
        format: 'commander',
        players: [
          { id: '1', type: 'playgroup_player' }, // Missing playgroupPlayerId
          { id: '2', type: 'guest', guestName: 'Player 2' },
        ],
      })

      expect(result).toEqual({ error: 'Playgroup players must have a player ID' })
    })

    it('returns error when guest has no name', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      const result = await createGame({
        format: 'commander',
        players: [
          { id: '1', type: 'guest', guestName: '' },
          { id: '2', type: 'guest', guestName: 'Player 2' },
        ],
      })

      expect(result).toEqual({ error: 'Guest players must have a name' })
    })

    it('creates game with guest players', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.create).mockResolvedValue({
        id: 'game-1',
        createdById: 'user-1',
        playgroupId: null,
        format: 'commander',
        totalTurns: 0,
        notes: null,
        playedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await createGame({
        format: 'commander',
        players: [
          { id: '1', type: 'guest', guestName: 'Player 1' },
          { id: '2', type: 'guest', guestName: 'Player 2' },
        ],
      })

      expect(result).toEqual({ success: true, gameId: 'game-1' })
      expect(db.game.create).toHaveBeenCalledWith({
        data: {
          createdById: 'user-1',
          playgroupId: null,
          format: 'commander',
          totalTurns: 0,
          players: {
            create: expect.arrayContaining([
              expect.objectContaining({ guestName: 'Player 1' }),
              expect.objectContaining({ guestName: 'Player 2' }),
            ]),
          },
        },
      })
    })

    it('creates game with playgroup members', async () => {
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

      vi.mocked(db.game.create).mockResolvedValue({
        id: 'game-1',
        createdById: 'user-1',
        playgroupId: 'pg-1',
        format: 'commander',
        totalTurns: 0,
        notes: null,
        playedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await createGame({
        format: 'commander',
        playgroupId: 'pg-1',
        players: [
          { id: '1', type: 'playgroup_member', userId: 'user-1' },
          { id: '2', type: 'playgroup_member', userId: 'user-2' },
        ],
      })

      expect(result).toEqual({ success: true, gameId: 'game-1' })
    })

    it('creates game with commander info', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.create).mockResolvedValue({
        id: 'game-1',
        createdById: 'user-1',
        playgroupId: null,
        format: 'commander',
        totalTurns: 0,
        notes: null,
        playedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await createGame({
        format: 'commander',
        players: [
          {
            id: '1',
            type: 'guest',
            guestName: 'Player 1',
            commanderUsed1: 'Atraxa, Praetors\' Voice',
            bracketUsed: 3,
          },
          {
            id: '2',
            type: 'guest',
            guestName: 'Player 2',
            commanderUsed1: 'Thrasios, Triton Hero',
            commanderUsed2: 'Tymna the Weaver',
            bracketUsed: 4,
          },
        ],
      })

      expect(result).toEqual({ success: true, gameId: 'game-1' })
      expect(db.game.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          players: {
            create: expect.arrayContaining([
              expect.objectContaining({
                commanderUsed1: 'Atraxa, Praetors\' Voice',
                bracketUsed: 3,
              }),
              expect.objectContaining({
                commanderUsed1: 'Thrasios, Triton Hero',
                commanderUsed2: 'Tymna the Weaver',
                bracketUsed: 4,
              }),
            ]),
          },
        }),
      })
    })
  })

  describe('getUserDecks', () => {
    it('returns empty array when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await getUserDecks()

      expect(result).toEqual([])
    })

    it('returns user decks when authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.findMany).mockResolvedValue([
        {
          id: 'deck-1',
          userId: 'user-1',
          name: 'Deck 1',
          format: 'commander',
          commander1: 'Atraxa',
          commander2: null,
          bracket: 3,
          decklistUrl: null,
          isActive: true,
          playgroupId: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      const result = await getUserDecks()

      expect(result).toHaveLength(1)
      expect(db.deck.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          isActive: true,
        },
        orderBy: { name: 'asc' },
      })
    })

    it('filters decks by format', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.deck.findMany).mockResolvedValue([])

      await getUserDecks('commander')

      expect(db.deck.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-1',
          isActive: true,
          format: 'commander',
        },
        orderBy: { name: 'asc' },
      })
    })
  })

  describe('getPlaygroupData', () => {
    it('returns null when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await getPlaygroupData('pg-1')

      expect(result).toBeNull()
    })

    it('returns null when user is not a member', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue(null)

      const result = await getPlaygroupData('pg-1')

      expect(result).toBeNull()
    })
  })

  describe('updateGame', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await updateGame('game-1', {
        totalTurns: 10,
        notes: null,
        playedAt: new Date(),
        players: [],
      })
      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when game not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue(null)

      const result = await updateGame('nonexistent', {
        totalTurns: 10,
        notes: null,
        playedAt: new Date(),
        players: [],
      })

      expect(result).toEqual({ error: 'Game not found' })
    })

    it('returns error when user is not the creator', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game-1',
        createdById: 'other-user',
        playgroupId: null,
        format: 'commander',
        totalTurns: 0,
        notes: null,
        playedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [],
      })

      const result = await updateGame('game-1', {
        totalTurns: 10,
        notes: null,
        playedAt: new Date(),
        players: [],
      })

      expect(result).toEqual({ error: 'You can only edit games you created' })
    })

    it('returns error when totalTurns is negative', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game-1',
        createdById: 'user-1',
        playgroupId: null,
        format: 'commander',
        totalTurns: 0,
        notes: null,
        playedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [],
      })

      const result = await updateGame('game-1', {
        totalTurns: -1,
        notes: null,
        playedAt: new Date(),
        players: [],
      })

      expect(result).toEqual({ error: 'Total turns must be 0 or greater' })
    })

    it('returns error when multiple winners', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game-1',
        createdById: 'user-1',
        playgroupId: null,
        format: 'commander',
        totalTurns: 0,
        notes: null,
        playedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [],
      })

      const result = await updateGame('game-1', {
        totalTurns: 10,
        notes: null,
        playedAt: new Date(),
        players: [
          { id: 'p1', placement: 1, isWinner: true, isFirstOut: false, eliminatedTurn: null },
          { id: 'p2', placement: 2, isWinner: true, isFirstOut: false, eliminatedTurn: null },
        ],
      })

      expect(result).toEqual({ error: 'Only one player can be marked as winner' })
    })

    it('returns error when no winner and not a draw', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game-1',
        createdById: 'user-1',
        playgroupId: null,
        format: 'commander',
        totalTurns: 0,
        notes: null,
        playedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [],
      })

      const result = await updateGame('game-1', {
        totalTurns: 10,
        notes: null,
        playedAt: new Date(),
        players: [
          { id: 'p1', placement: 1, isWinner: false, isFirstOut: false, eliminatedTurn: null },
          { id: 'p2', placement: 2, isWinner: false, isFirstOut: false, eliminatedTurn: null },
        ],
      })

      expect(result).toEqual({ error: 'A winner must be selected (or mark as draw with all placement 1)' })
    })

    it('allows draw when all players have placement 1', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game-1',
        createdById: 'user-1',
        playgroupId: null,
        format: 'commander',
        totalTurns: 0,
        notes: null,
        playedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [],
      })

      vi.mocked(db.game.update).mockResolvedValue({} as never)
      vi.mocked(db.gamePlayer.update).mockResolvedValue({} as never)

      const result = await updateGame('game-1', {
        totalTurns: 10,
        notes: null,
        playedAt: new Date(),
        players: [
          { id: 'p1', placement: 1, isWinner: false, isFirstOut: false, eliminatedTurn: null },
          { id: 'p2', placement: 1, isWinner: false, isFirstOut: false, eliminatedTurn: null },
        ],
      })

      expect(result).toEqual({ success: true })
    })

    it('returns error when multiple first out', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game-1',
        createdById: 'user-1',
        playgroupId: null,
        format: 'commander',
        totalTurns: 0,
        notes: null,
        playedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [],
      })

      const result = await updateGame('game-1', {
        totalTurns: 10,
        notes: null,
        playedAt: new Date(),
        players: [
          { id: 'p1', placement: 1, isWinner: true, isFirstOut: true, eliminatedTurn: 5 },
          { id: 'p2', placement: 2, isWinner: false, isFirstOut: true, eliminatedTurn: 3 },
        ],
      })

      expect(result).toEqual({ error: 'Only one player can be marked as first out' })
    })

    it('successfully updates game', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game-1',
        createdById: 'user-1',
        playgroupId: null,
        format: 'commander',
        totalTurns: 0,
        notes: null,
        playedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [],
      })

      vi.mocked(db.game.update).mockResolvedValue({} as never)
      vi.mocked(db.gamePlayer.update).mockResolvedValue({} as never)

      const result = await updateGame('game-1', {
        totalTurns: 15,
        notes: 'Great game!',
        playedAt: new Date(),
        players: [
          { id: 'p1', placement: 1, isWinner: true, isFirstOut: false, eliminatedTurn: null },
          { id: 'p2', placement: 2, isWinner: false, isFirstOut: false, eliminatedTurn: null },
        ],
      })

      expect(result).toEqual({ success: true })
    })
  })

  describe('deleteGame', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await deleteGame('game-1')
      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when game not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue(null)

      const result = await deleteGame('nonexistent')

      expect(result).toEqual({ error: 'Game not found' })
    })

    it('returns error when user is not the creator of a non-playgroup game', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game-1',
        createdById: 'other-user',
        playgroupId: null,
        format: 'commander',
        totalTurns: 0,
        notes: null,
        playedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await deleteGame('game-1')

      expect(result).toEqual({ error: 'You can only delete games you created' })
    })

    it('allows playgroup member to delete a game they did not create', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game-1',
        createdById: 'other-user',
        playgroupId: 'pg-1',
        format: 'commander',
        totalTurns: 0,
        notes: null,
        playedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1',
        playgroupId: 'pg-1',
        userId: 'user-1',
        role: 'member',
        joinedAt: new Date(),
        invitedById: null,
      })

      vi.mocked(db.game.delete).mockResolvedValue({} as never)

      const result = await deleteGame('game-1')

      expect(result).toEqual({ success: true })
      expect(db.game.delete).toHaveBeenCalledWith({ where: { id: 'game-1' } })
    })

    it('rejects non-member trying to delete a playgroup game', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game-1',
        createdById: 'other-user',
        playgroupId: 'pg-1',
        format: 'commander',
        totalTurns: 0,
        notes: null,
        playedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue(null)

      const result = await deleteGame('game-1')

      expect(result).toEqual({ error: 'Only playgroup members can delete this game' })
    })

    it('successfully deletes game as creator', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game-1',
        createdById: 'user-1',
        playgroupId: null,
        format: 'commander',
        totalTurns: 0,
        notes: null,
        playedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.game.delete).mockResolvedValue({} as never)

      const result = await deleteGame('game-1')

      expect(result).toEqual({ success: true })
      expect(db.game.delete).toHaveBeenCalledWith({ where: { id: 'game-1' } })
    })

    it('creator can delete their own playgroup game without membership check', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game-1',
        createdById: 'user-1',
        playgroupId: 'pg-1',
        format: 'commander',
        totalTurns: 0,
        notes: null,
        playedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      vi.mocked(db.game.delete).mockResolvedValue({} as never)

      const result = await deleteGame('game-1')

      expect(result).toEqual({ success: true })
      // Should not check membership since user is the creator
      expect(db.playgroupMember.findUnique).not.toHaveBeenCalled()
    })
  })

  describe('updateTurnCount', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await updateTurnCount('game-1', 10)
      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('successfully updates turn count', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.update).mockResolvedValue({} as never)

      const result = await updateTurnCount('game-1', 10)

      expect(result).toEqual({ success: true })
      expect(db.game.update).toHaveBeenCalledWith({
        where: { id: 'game-1' },
        data: { totalTurns: 10 },
      })
    })

    it('handles update failure', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.update).mockRejectedValue(new Error('Database error'))

      const result = await updateTurnCount('game-1', 10)

      expect(result).toEqual({ error: 'Failed to update turn count' })
    })
  })

  describe('eliminatePlayer', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await eliminatePlayer('game-1', 'player-1', 5, true)
      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('successfully eliminates player', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.gamePlayer.update).mockResolvedValue({} as never)

      const result = await eliminatePlayer('game-1', 'player-1', 5, true)

      expect(result).toEqual({ success: true })
      expect(db.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: 'player-1' },
        data: {
          eliminatedTurn: 5,
          isFirstOut: true,
        },
      })
    })
  })

  describe('reinstatePlayer', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await reinstatePlayer('game-1', 'player-1')
      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('successfully reinstates player', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.gamePlayer.update).mockResolvedValue({} as never)

      const result = await reinstatePlayer('game-1', 'player-1')

      expect(result).toEqual({ success: true })
      expect(db.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: 'player-1' },
        data: {
          eliminatedTurn: null,
          isFirstOut: false,
        },
      })
    })
  })

  describe('addPowerPlay', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await addPowerPlay('game-1', 'player-1', 'user-1', 5, 'combo', 'Infinite combo')
      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('successfully adds power play', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.powerPlay.create).mockResolvedValue({
        id: 'pp-1',
        gameId: 'game-1',
        gamePlayerId: 'player-1',
        userId: 'user-1',
        turn: 5,
        type: 'combo',
        description: 'Infinite combo',
        cardName: 'Thassa\'s Oracle',
        createdAt: new Date(),
      })

      const result = await addPowerPlay(
        'game-1',
        'player-1',
        'user-1',
        5,
        'combo',
        'Infinite combo',
        'Thassa\'s Oracle'
      )

      expect(result).toEqual({ success: true, id: 'pp-1' })
      expect(db.powerPlay.create).toHaveBeenCalledWith({
        data: {
          gameId: 'game-1',
          gamePlayerId: 'player-1',
          userId: 'user-1',
          turn: 5,
          type: 'combo',
          description: 'Infinite combo',
          cardName: 'Thassa\'s Oracle',
        },
      })
    })

    it('adds power play without card name', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.powerPlay.create).mockResolvedValue({
        id: 'pp-1',
        gameId: 'game-1',
        gamePlayerId: 'player-1',
        userId: null,
        turn: 3,
        type: 'boardwipe',
        description: 'Wrath of God',
        cardName: null,
        createdAt: new Date(),
      })

      const result = await addPowerPlay('game-1', 'player-1', null, 3, 'boardwipe', 'Wrath of God')

      expect(result).toEqual({ success: true, id: 'pp-1' })
      expect(db.powerPlay.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          cardName: null,
        }),
      })
    })
  })

  describe('removePowerPlay', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await removePowerPlay('game-1', 'pp-1')
      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('successfully removes power play', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.powerPlay.delete).mockResolvedValue({} as never)

      const result = await removePowerPlay('game-1', 'pp-1')

      expect(result).toEqual({ success: true })
      expect(db.powerPlay.delete).toHaveBeenCalledWith({ where: { id: 'pp-1' } })
    })
  })

  describe('endGame', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await endGame('game-1', 'winner-1', false)
      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when game not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue(null)

      const result = await endGame('nonexistent', 'winner-1', false)

      expect(result).toEqual({ error: 'Game not found' })
    })

    it('successfully ends game with winner', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game-1',
        createdById: 'user-1',
        playgroupId: null,
        format: 'commander',
        totalTurns: 10,
        notes: null,
        playedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [
          { id: 'p1', eliminatedTurn: null },
          { id: 'p2', eliminatedTurn: null },
          { id: 'p3', eliminatedTurn: 5 },
        ],
      })

      vi.mocked(db.gamePlayer.update).mockResolvedValue({} as never)
      vi.mocked(db.game.update).mockResolvedValue({} as never)

      const result = await endGame('game-1', 'p1', false)

      expect(result).toEqual({ success: true })
    })

    it('successfully ends game as draw', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game-1',
        createdById: 'user-1',
        playgroupId: null,
        format: 'commander',
        totalTurns: 10,
        notes: null,
        playedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [
          { id: 'p1', eliminatedTurn: null },
          { id: 'p2', eliminatedTurn: null },
        ],
      })

      vi.mocked(db.gamePlayer.update).mockResolvedValue({} as never)
      vi.mocked(db.game.update).mockResolvedValue({} as never)

      const result = await endGame('game-1', null, true)

      expect(result).toEqual({ success: true })
      // Both players should get placement 1 and isWinner: false for draw
      expect(db.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { placement: 1, isWinner: false },
      })
      expect(db.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: 'p2' },
        data: { placement: 1, isWinner: false },
      })
    })

    it('saves totalTurns when provided', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game-1',
        createdById: 'user-1',
        playgroupId: null,
        format: 'commander',
        totalTurns: 0,
        notes: null,
        playedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [
          { id: 'p1', eliminatedTurn: null },
          { id: 'p2', eliminatedTurn: null },
        ],
      })

      vi.mocked(db.gamePlayer.update).mockResolvedValue({} as never)
      vi.mocked(db.game.update).mockResolvedValue({} as never)

      const result = await endGame('game-1', 'p1', false, 12)

      expect(result).toEqual({ success: true })
      expect(db.game.update).toHaveBeenCalledWith({
        where: { id: 'game-1' },
        data: {
          playedAt: expect.any(Date),
          totalTurns: 12,
        },
      })
    })

    it('does not set totalTurns when not provided', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game-1',
        createdById: 'user-1',
        playgroupId: null,
        format: 'commander',
        totalTurns: 0,
        notes: null,
        playedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [
          { id: 'p1', eliminatedTurn: null },
          { id: 'p2', eliminatedTurn: null },
        ],
      })

      vi.mocked(db.gamePlayer.update).mockResolvedValue({} as never)
      vi.mocked(db.game.update).mockResolvedValue({} as never)

      await endGame('game-1', 'p1', false)

      expect(db.game.update).toHaveBeenCalledWith({
        where: { id: 'game-1' },
        data: {
          playedAt: expect.any(Date),
        },
      })
    })

    it('does not set totalTurns when null is passed', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game-1',
        createdById: 'user-1',
        playgroupId: null,
        format: 'commander',
        totalTurns: 0,
        notes: null,
        playedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [
          { id: 'p1', eliminatedTurn: null },
          { id: 'p2', eliminatedTurn: null },
        ],
      })

      vi.mocked(db.gamePlayer.update).mockResolvedValue({} as never)
      vi.mocked(db.game.update).mockResolvedValue({} as never)

      await endGame('game-1', 'p1', false, null)

      expect(db.game.update).toHaveBeenCalledWith({
        where: { id: 'game-1' },
        data: {
          playedAt: expect.any(Date),
        },
      })
    })

    it('calculates correct placements with eliminated players', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game-1',
        createdById: 'user-1',
        playgroupId: null,
        format: 'commander',
        totalTurns: 0,
        notes: null,
        playedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [
          { id: 'p1', eliminatedTurn: null },  // active - winner
          { id: 'p2', eliminatedTurn: null },  // active - 2nd
          { id: 'p3', eliminatedTurn: 8 },     // eliminated last (better)
          { id: 'p4', eliminatedTurn: 3 },     // eliminated first (worst)
        ],
      })

      vi.mocked(db.gamePlayer.update).mockResolvedValue({} as never)
      vi.mocked(db.game.update).mockResolvedValue({} as never)

      await endGame('game-1', 'p1', false, 10)

      // Winner: placement 1
      expect(db.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { placement: 1, isWinner: true },
      })
      // Other active: placement 2
      expect(db.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: 'p2' },
        data: { placement: 2, isWinner: false },
      })
      // Last eliminated (turn 8): placement 3
      expect(db.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: 'p3' },
        data: { placement: 3, isWinner: false },
      })
      // First eliminated (turn 3): placement 4
      expect(db.gamePlayer.update).toHaveBeenCalledWith({
        where: { id: 'p4' },
        data: { placement: 4, isWinner: false },
      })
    })
  })

  describe('getPlaygroupDecks', () => {
    it('returns empty array when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await getPlaygroupDecks('pg-1')

      expect(result).toEqual([])
    })

    it('returns empty array when user is not a member', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findMany).mockResolvedValue([
        { userId: 'other-user', playgroupId: 'pg-1', id: 'm1', role: 'member', joinedAt: new Date(), invitedById: null },
      ])

      const result = await getPlaygroupDecks('pg-1')

      expect(result).toEqual([])
    })

    it('returns decks with userId field', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findMany).mockResolvedValue([
        { userId: 'user-1', playgroupId: 'pg-1', id: 'm1', role: 'member', joinedAt: new Date(), invitedById: null },
        { userId: 'user-2', playgroupId: 'pg-1', id: 'm2', role: 'member', joinedAt: new Date(), invitedById: null },
      ])

      vi.mocked(db.deck.findMany).mockResolvedValue([
        {
          id: 'deck-1', userId: 'user-1', name: 'Atraxa Deck', format: 'commander',
          commander1: 'Atraxa', commander2: null, bracket: 3, decklistUrl: null,
          isActive: true, playgroupId: 'pg-1', createdAt: new Date(), updatedAt: new Date(),
          user: { username: 'testuser' },
        },
        {
          id: 'deck-2', userId: 'user-2', name: 'Thrasios Deck', format: 'commander',
          commander1: 'Thrasios', commander2: null, bracket: 4, decklistUrl: null,
          isActive: true, playgroupId: 'pg-1', createdAt: new Date(), updatedAt: new Date(),
          user: { username: 'otheruser' },
        },
      ] as never)

      const result = await getPlaygroupDecks('pg-1')

      expect(result).toHaveLength(2)
      expect(result[0]).toHaveProperty('userId', 'user-1')
      expect(result[1]).toHaveProperty('userId', 'user-2')
      expect(result[0]).toHaveProperty('createdBy', { username: 'testuser' })
    })

    it('filters decks by format', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findMany).mockResolvedValue([
        { userId: 'user-1', playgroupId: 'pg-1', id: 'm1', role: 'member', joinedAt: new Date(), invitedById: null },
      ])

      vi.mocked(db.deck.findMany).mockResolvedValue([])

      await getPlaygroupDecks('pg-1', 'modern')

      expect(db.deck.findMany).toHaveBeenCalledWith({
        where: {
          userId: { in: ['user-1'] },
          isActive: true,
          format: 'modern',
        },
        include: { user: { select: { username: true } } },
        orderBy: { name: 'asc' },
      })
    })
  })

  describe('getPlaygroupPlayerDecks', () => {
    it('returns empty array when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await getPlaygroupPlayerDecks('pg-1')

      expect(result).toEqual([])
    })

    it('returns empty array when user is not a member', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue(null)

      const result = await getPlaygroupPlayerDecks('pg-1')

      expect(result).toEqual([])
    })

    it('returns player decks with playgroupPlayerId field', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1', playgroupId: 'pg-1', userId: 'user-1',
        role: 'member', joinedAt: new Date(), invitedById: null,
      })

      vi.mocked(db.playgroupPlayer.findMany).mockResolvedValue([
        {
          id: 'player-1', playgroupId: 'pg-1', name: 'Bob',
          email: null, linkedUserId: null, createdAt: new Date(),
          decks: [
            {
              id: 'pdeck-1', playgroupPlayerId: 'player-1', name: 'Bob Commander',
              format: 'commander', commander1: 'Muldrotha', commander2: null,
              bracket: 2, decklistUrl: null, linkedDeckId: null,
              isActive: true, createdAt: new Date(), updatedAt: new Date(),
            },
          ],
        },
      ] as never)

      const result = await getPlaygroupPlayerDecks('pg-1')

      expect(result).toHaveLength(1)
      expect(result[0]).toHaveProperty('playgroupPlayerId', 'player-1')
      expect(result[0]).toHaveProperty('playerName', 'Bob')
      expect(result[0]).toHaveProperty('name', 'Bob Commander')
    })
  })

  describe('saveNewDeckFromGame', () => {
    it('returns error when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await saveNewDeckFromGame({
        playgroupId: 'pg-1',
        playerType: 'playgroup_member',
        userId: 'user-1',
        format: 'commander',
        commander1: 'Atraxa',
      })

      expect(result).toEqual({ error: 'Not authenticated' })
    })

    it('returns error when user is not a playgroup member', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue(null)

      const result = await saveNewDeckFromGame({
        playgroupId: 'pg-1',
        playerType: 'playgroup_member',
        userId: 'user-1',
        format: 'commander',
        commander1: 'Atraxa',
      })

      expect(result).toEqual({ error: 'You are not a member of this playgroup' })
    })

    it('returns error when commander1 is empty', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1', playgroupId: 'pg-1', userId: 'user-1',
        role: 'member', joinedAt: new Date(), invitedById: null,
      })

      const result = await saveNewDeckFromGame({
        playgroupId: 'pg-1',
        playerType: 'playgroup_member',
        userId: 'user-1',
        format: 'commander',
        commander1: '',
      })

      expect(result).toEqual({ error: 'Commander name is required to save a deck' })
    })

    it('returns error when commander1 is whitespace only', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1', playgroupId: 'pg-1', userId: 'user-1',
        role: 'member', joinedAt: new Date(), invitedById: null,
      })

      const result = await saveNewDeckFromGame({
        playgroupId: 'pg-1',
        playerType: 'playgroup_member',
        userId: 'user-1',
        format: 'commander',
        commander1: '   ',
      })

      expect(result).toEqual({ error: 'Commander name is required to save a deck' })
    })

    it('creates a Deck for playgroup_member', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1', playgroupId: 'pg-1', userId: 'user-1',
        role: 'member', joinedAt: new Date(), invitedById: null,
      })

      vi.mocked(db.deck.create).mockResolvedValue({
        id: 'deck-new', userId: 'user-1', playgroupId: 'pg-1',
        name: "Atraxa, Praetors' Voice", format: 'commander',
        commander1: "Atraxa, Praetors' Voice", commander2: null,
        bracket: 3, decklistUrl: null, isActive: true,
        createdAt: new Date(), updatedAt: new Date(),
      })

      const result = await saveNewDeckFromGame({
        playgroupId: 'pg-1',
        playerType: 'playgroup_member',
        userId: 'user-1',
        format: 'commander',
        commander1: "Atraxa, Praetors' Voice",
        bracket: 3,
      })

      expect(result).toEqual({ success: true, deckId: 'deck-new', deckType: 'deck' })
      expect(db.deck.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          playgroupId: 'pg-1',
          name: "Atraxa, Praetors' Voice",
          format: 'commander',
          commander1: "Atraxa, Praetors' Voice",
          commander2: null,
          bracket: 3,
        },
      })
    })

    it('creates a Deck with partner commander', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1', playgroupId: 'pg-1', userId: 'user-1',
        role: 'member', joinedAt: new Date(), invitedById: null,
      })

      vi.mocked(db.deck.create).mockResolvedValue({
        id: 'deck-new', userId: 'user-1', playgroupId: 'pg-1',
        name: 'Thrasios, Triton Hero', format: 'commander',
        commander1: 'Thrasios, Triton Hero', commander2: 'Tymna the Weaver',
        bracket: 4, decklistUrl: null, isActive: true,
        createdAt: new Date(), updatedAt: new Date(),
      })

      const result = await saveNewDeckFromGame({
        playgroupId: 'pg-1',
        playerType: 'playgroup_member',
        userId: 'user-1',
        format: 'commander',
        commander1: 'Thrasios, Triton Hero',
        commander2: 'Tymna the Weaver',
        bracket: 4,
      })

      expect(result).toEqual({ success: true, deckId: 'deck-new', deckType: 'deck' })
      expect(db.deck.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          commander1: 'Thrasios, Triton Hero',
          commander2: 'Tymna the Weaver',
          bracket: 4,
        }),
      })
    })

    it('returns error when member userId is missing', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1', playgroupId: 'pg-1', userId: 'user-1',
        role: 'member', joinedAt: new Date(), invitedById: null,
      })

      const result = await saveNewDeckFromGame({
        playgroupId: 'pg-1',
        playerType: 'playgroup_member',
        format: 'commander',
        commander1: 'Atraxa',
      })

      expect(result).toEqual({ error: 'User ID is required for member decks' })
    })

    it('creates a PlaygroupPlayerDeck for playgroup_player', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1', playgroupId: 'pg-1', userId: 'user-1',
        role: 'member', joinedAt: new Date(), invitedById: null,
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue({
        id: 'player-1', playgroupId: 'pg-1', name: 'Bob',
        email: null, linkedUserId: null, createdAt: new Date(),
      })

      vi.mocked(db.playgroupPlayerDeck.create).mockResolvedValue({
        id: 'pdeck-new', playgroupPlayerId: 'player-1',
        name: 'Muldrotha, the Gravetide', format: 'commander',
        commander1: 'Muldrotha, the Gravetide', commander2: null,
        bracket: 2, decklistUrl: null, linkedDeckId: null,
        isActive: true, createdAt: new Date(), updatedAt: new Date(),
      })

      const result = await saveNewDeckFromGame({
        playgroupId: 'pg-1',
        playerType: 'playgroup_player',
        playgroupPlayerId: 'player-1',
        format: 'commander',
        commander1: 'Muldrotha, the Gravetide',
        bracket: 2,
      })

      expect(result).toEqual({ success: true, deckId: 'pdeck-new', deckType: 'playgroupPlayerDeck' })
      expect(db.playgroupPlayerDeck.create).toHaveBeenCalledWith({
        data: {
          playgroupPlayerId: 'player-1',
          name: 'Muldrotha, the Gravetide',
          format: 'commander',
          commander1: 'Muldrotha, the Gravetide',
          commander2: null,
          bracket: 2,
        },
      })
    })

    it('returns error when playgroupPlayerId is missing', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1', playgroupId: 'pg-1', userId: 'user-1',
        role: 'member', joinedAt: new Date(), invitedById: null,
      })

      const result = await saveNewDeckFromGame({
        playgroupId: 'pg-1',
        playerType: 'playgroup_player',
        format: 'commander',
        commander1: 'Atraxa',
      })

      expect(result).toEqual({ error: 'Player ID is required for player decks' })
    })

    it('returns error when playgroup player not found in playgroup', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1', playgroupId: 'pg-1', userId: 'user-1',
        role: 'member', joinedAt: new Date(), invitedById: null,
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue({
        id: 'player-1', playgroupId: 'pg-OTHER', name: 'Bob',
        email: null, linkedUserId: null, createdAt: new Date(),
      })

      const result = await saveNewDeckFromGame({
        playgroupId: 'pg-1',
        playerType: 'playgroup_player',
        playgroupPlayerId: 'player-1',
        format: 'commander',
        commander1: 'Atraxa',
      })

      expect(result).toEqual({ error: 'Player not found in this playgroup' })
    })

    it('returns error when playgroup player does not exist', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1', playgroupId: 'pg-1', userId: 'user-1',
        role: 'member', joinedAt: new Date(), invitedById: null,
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue(null)

      const result = await saveNewDeckFromGame({
        playgroupId: 'pg-1',
        playerType: 'playgroup_player',
        playgroupPlayerId: 'nonexistent',
        format: 'commander',
        commander1: 'Atraxa',
      })

      expect(result).toEqual({ error: 'Player not found in this playgroup' })
    })

    it('handles db error gracefully for member deck creation', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1', playgroupId: 'pg-1', userId: 'user-1',
        role: 'member', joinedAt: new Date(), invitedById: null,
      })

      vi.mocked(db.deck.create).mockRejectedValue(new Error('DB error'))

      const result = await saveNewDeckFromGame({
        playgroupId: 'pg-1',
        playerType: 'playgroup_member',
        userId: 'user-1',
        format: 'commander',
        commander1: 'Atraxa',
      })

      expect(result).toEqual({ error: 'Failed to save deck. Please try again.' })
    })

    it('handles db error gracefully for player deck creation', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1', playgroupId: 'pg-1', userId: 'user-1',
        role: 'member', joinedAt: new Date(), invitedById: null,
      })

      vi.mocked(db.playgroupPlayer.findUnique).mockResolvedValue({
        id: 'player-1', playgroupId: 'pg-1', name: 'Bob',
        email: null, linkedUserId: null, createdAt: new Date(),
      })

      vi.mocked(db.playgroupPlayerDeck.create).mockRejectedValue(new Error('DB error'))

      const result = await saveNewDeckFromGame({
        playgroupId: 'pg-1',
        playerType: 'playgroup_player',
        playgroupPlayerId: 'player-1',
        format: 'commander',
        commander1: 'Atraxa',
      })

      expect(result).toEqual({ error: 'Failed to save deck. Please try again.' })
    })

    it('trims commander names', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1', playgroupId: 'pg-1', userId: 'user-1',
        role: 'member', joinedAt: new Date(), invitedById: null,
      })

      vi.mocked(db.deck.create).mockResolvedValue({
        id: 'deck-new', userId: 'user-1', playgroupId: 'pg-1',
        name: 'Atraxa', format: 'commander',
        commander1: 'Atraxa', commander2: 'Tymna',
        bracket: null, decklistUrl: null, isActive: true,
        createdAt: new Date(), updatedAt: new Date(),
      })

      await saveNewDeckFromGame({
        playgroupId: 'pg-1',
        playerType: 'playgroup_member',
        userId: 'user-1',
        format: 'commander',
        commander1: '  Atraxa  ',
        commander2: '  Tymna  ',
      })

      expect(db.deck.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          name: 'Atraxa',
          commander1: 'Atraxa',
          commander2: 'Tymna',
        }),
      })
    })

    it('creates deck without bracket when not provided', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({
        id: 'member-1', playgroupId: 'pg-1', userId: 'user-1',
        role: 'member', joinedAt: new Date(), invitedById: null,
      })

      vi.mocked(db.deck.create).mockResolvedValue({
        id: 'deck-new', userId: 'user-1', playgroupId: 'pg-1',
        name: 'Atraxa', format: 'commander',
        commander1: 'Atraxa', commander2: null,
        bracket: null, decklistUrl: null, isActive: true,
        createdAt: new Date(), updatedAt: new Date(),
      })

      const result = await saveNewDeckFromGame({
        playgroupId: 'pg-1',
        playerType: 'playgroup_member',
        userId: 'user-1',
        format: 'commander',
        commander1: 'Atraxa',
      })

      expect(result).toEqual({ success: true, deckId: 'deck-new', deckType: 'deck' })
      expect(db.deck.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          bracket: null,
          commander2: null,
        }),
      })
    })
  })

  describe('getRematchData', () => {
    it('returns null when not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const result = await getRematchData('game-1')

      expect(result).toBeNull()
    })

    it('returns null when game not found', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue(null)

      const result = await getRematchData('nonexistent')

      expect(result).toBeNull()
    })

    it('returns game data with players for rematch', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game-1',
        createdById: 'user-1',
        playgroupId: 'pg-1',
        format: 'commander',
        totalTurns: 10,
        notes: null,
        playedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [
          { userId: 'user-1', playgroupPlayerId: null, guestName: null },
          { userId: 'user-2', playgroupPlayerId: null, guestName: null },
          { userId: null, playgroupPlayerId: 'pp-1', guestName: null },
        ],
      })

      const result = await getRematchData('game-1')

      expect(result).toEqual({
        format: 'commander',
        playgroupId: 'pg-1',
        players: [
          { type: 'playgroup_member', userId: 'user-1', playgroupPlayerId: null, guestName: null },
          { type: 'playgroup_member', userId: 'user-2', playgroupPlayerId: null, guestName: null },
          { type: 'playgroup_player', userId: null, playgroupPlayerId: 'pp-1', guestName: null },
        ],
      })
    })

    it('correctly identifies guest players', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue({
        id: 'game-1',
        createdById: 'user-1',
        playgroupId: null,
        format: 'standard',
        totalTurns: 5,
        notes: null,
        playedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        players: [
          { userId: null, playgroupPlayerId: null, guestName: 'Alice' },
          { userId: null, playgroupPlayerId: null, guestName: 'Bob' },
        ],
      })

      const result = await getRematchData('game-1')

      expect(result).toEqual({
        format: 'standard',
        playgroupId: null,
        players: [
          { type: 'guest', userId: null, playgroupPlayerId: null, guestName: 'Alice' },
          { type: 'guest', userId: null, playgroupPlayerId: null, guestName: 'Bob' },
        ],
      })
    })

    it('queries game with correct include', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        username: 'testuser',
      })

      vi.mocked(db.game.findUnique).mockResolvedValue(null)

      await getRematchData('game-1')

      expect(db.game.findUnique).toHaveBeenCalledWith({
        where: { id: 'game-1' },
        include: {
          players: {
            select: {
              userId: true,
              playgroupPlayerId: true,
              guestName: true,
            },
          },
        },
      })
    })
  })
})
