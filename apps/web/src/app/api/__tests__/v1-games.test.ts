import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/api-auth', () => ({
  requireAuth: vi.fn(),
}))

const tx = {
  deck: { create: vi.fn() },
  playgroupPlayerDeck: { create: vi.fn() },
  game: { create: vi.fn() },
  gamePlayer: { create: vi.fn() },
  powerPlay: { create: vi.fn() },
}

vi.mock('@/lib/db', () => ({
  db: {
    playgroupMember: { findMany: vi.fn(), findUnique: vi.fn() },
    playgroupPlayer: { findMany: vi.fn() },
    deck: { findMany: vi.fn() },
    playgroupPlayerDeck: { findMany: vi.fn() },
    game: { findUnique: vi.fn(), update: vi.fn() },
    gamePlayer: { update: vi.fn() },
    user: { findUnique: vi.fn() },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/commander-detector', () => ({
  detectCommanders: vi.fn(),
  DetectionError: class DetectionError extends Error {},
}))

vi.mock('@/lib/pod-candidates', () => ({
  loadCandidates: vi.fn(),
  knownCommanderNames: vi.fn(() => []),
}))

import { requireAuth } from '@/lib/api-auth'
import { db } from '@/lib/db'
import { detectCommanders, DetectionError } from '@/lib/commander-detector'
import { loadCandidates } from '@/lib/pod-candidates'
import { resetRateLimits } from '@/lib/rate-limit'
import { POST as completeGame } from '../v1/games/complete/route'
import { POST as endGame } from '../v1/games/[id]/end/route'
import { PATCH as patchGame } from '../v1/games/[id]/route'
import { POST as detect } from '../v1/games/setup/detect/route'

function jsonRequest(url: string, body: unknown, method = 'POST') {
  return new NextRequest(url, {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

const params = (id: string) => ({ params: Promise.resolve({ id }) })

beforeEach(() => {
  vi.clearAllMocks()
  resetRateLimits()
  vi.mocked(requireAuth).mockResolvedValue('u1')
  vi.mocked(db.$transaction).mockImplementation(((fn: (t: typeof tx) => unknown) => fn(tx)) as never)
  let gpCount = 0
  tx.game.create.mockResolvedValue({ id: 'game1' })
  tx.gamePlayer.create.mockImplementation(async ({ data }: { data: { userId: string | null } }) => ({
    id: `gp${++gpCount}`,
    userId: data.userId,
  }))
  tx.deck.create.mockResolvedValue({ id: 'new-deck' })
  tx.playgroupPlayerDeck.create.mockResolvedValue({ id: 'new-pp-deck' })
  vi.mocked(db.deck.findMany).mockResolvedValue([])
  vi.mocked(db.playgroupPlayerDeck.findMany).mockResolvedValue([])
  vi.mocked(db.playgroupPlayer.findMany).mockResolvedValue([])
})

describe('POST /api/v1/games/complete', () => {
  const url = 'http://localhost/api/v1/games/complete'
  const members = [{ userId: 'u1' }, { userId: 'u2' }]

  it('rejects non-members of the playgroup', async () => {
    vi.mocked(db.playgroupMember.findMany).mockResolvedValue([{ userId: 'u2' }] as never)
    const res = await completeGame(
      jsonRequest(url, {
        format: 'commander',
        playgroupId: 'pg1',
        isDraw: false,
        winnerSeat: 0,
        totalTurns: 5,
        seats: [
          { seat: 0, userId: 'u2' },
          { seat: 1, guestName: 'Dan' },
        ],
      })
    )
    expect(res.status).toBe(403)
  })

  it('rejects a guest deck sent as the wrong kind / from another playgroup', async () => {
    vi.mocked(db.playgroupMember.findMany).mockResolvedValue(members as never)
    vi.mocked(db.playgroupPlayerDeck.findMany).mockResolvedValue([
      { id: 'pd1', commander1: 'X', commander2: null, bracket: null, playgroupPlayer: { playgroupId: 'other' } },
    ] as never)
    const res = await completeGame(
      jsonRequest(url, {
        format: 'commander',
        playgroupId: 'pg1',
        isDraw: false,
        winnerSeat: 0,
        totalTurns: 5,
        seats: [
          { seat: 0, userId: 'u1', deck: { kind: 'playgroupPlayerDeck', id: 'pd1' } },
          { seat: 1, userId: 'u2' },
        ],
      })
    )
    expect(res.status).toBe(400)
    expect(db.$transaction).not.toHaveBeenCalled()
  })

  it('rejects a seat with both a registered player and a guest name', async () => {
    const res = await completeGame(
      jsonRequest(url, {
        format: 'commander',
        playgroupId: null,
        isDraw: true,
        winnerSeat: null,
        totalTurns: 1,
        seats: [
          { seat: 0, userId: 'u1', guestName: 'x' },
          { seat: 1, guestName: 'Dan' },
        ],
      })
    )
    expect(res.status).toBe(400)
  })

  it('creates pending decks, players with placements and power plays in one transaction', async () => {
    vi.mocked(db.playgroupMember.findMany).mockResolvedValue(members as never)
    vi.mocked(db.playgroupPlayer.findMany).mockResolvedValue([{ id: 'pp1' }] as never)
    vi.mocked(db.deck.findMany).mockResolvedValue([
      { id: 'd1', commander1: 'Krenko, Mob Boss', commander2: null, bracket: 3 },
    ] as never)

    const res = await completeGame(
      jsonRequest(url, {
        format: 'commander',
        playgroupId: 'pg1',
        isDraw: false,
        winnerSeat: 2,
        totalTurns: 9,
        seats: [
          { seat: 0, userId: 'u1', deck: { kind: 'deck', id: 'd1' }, eliminatedTurn: 4 },
          { seat: 1, userId: 'u2', pendingNewDeck: { name: 'Edgar', commander1: 'Edgar Markov' }, eliminatedTurn: 7 },
          { seat: 2, playgroupPlayerId: 'pp1', pendingNewDeck: { name: 'Atraxa', commander1: "Atraxa, Praetors' Voice" } },
          { seat: 3, guestName: 'Dan', commanderUsed1: 'Ms. Bumbleflower' },
        ],
        powerPlays: [{ seat: 2, turn: 9, type: 'wincon', description: 'Combo' }],
      })
    )

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.createdDecks).toEqual([
      { seat: 1, deck: { kind: 'deck', id: 'new-deck' } },
      { seat: 2, deck: { kind: 'playgroupPlayerDeck', id: 'new-pp-deck' } },
    ])
    expect(body.game.players.map((p: { seat: number }) => p.seat)).toEqual([0, 1, 2, 3])

    expect(tx.deck.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'u2', playgroupId: 'pg1', commander1: 'Edgar Markov', name: 'Edgar' }),
    })
    const created = tx.gamePlayer.create.mock.calls.map((c) => c[0].data)
    expect(created[0]).toMatchObject({ deckId: 'd1', commanderUsed1: 'Krenko, Mob Boss', bracketUsed: 3, placement: 4, isFirstOut: true })
    expect(created[1]).toMatchObject({ deckId: 'new-deck', commanderUsed1: 'Edgar Markov', placement: 3 })
    expect(created[2]).toMatchObject({ playgroupPlayerDeckId: 'new-pp-deck', placement: 1, isWinner: true })
    expect(created[3]).toMatchObject({ guestName: 'Dan', commanderUsed1: 'Ms. Bumbleflower', placement: 2 })
    expect(tx.powerPlay.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ gamePlayerId: 'gp3', type: 'wincon' }),
    })
  })

  it('only creates decks for yourself outside a playgroup', async () => {
    const res = await completeGame(
      jsonRequest(url, {
        format: 'commander',
        playgroupId: null,
        isDraw: false,
        winnerSeat: 0,
        totalTurns: 3,
        seats: [
          { seat: 0, userId: 'u1' },
          { seat: 1, userId: 'u2', pendingNewDeck: { name: 'X', commander1: 'X' } },
        ],
      })
    )
    expect(res.status).toBe(400)
  })
})

describe('game edit permissions', () => {
  const game = {
    id: 'g1',
    createdById: 'u9',
    totalTurns: 3,
    players: [{ id: 'gp1', userId: 'u8', eliminatedTurn: null }],
  }

  it('blocks ending a game you neither created nor played', async () => {
    vi.mocked(db.game.findUnique).mockResolvedValue(game as never)
    const res = await endGame(jsonRequest('http://localhost/api/v1/games/g1/end', { isDraw: true }), params('g1'))
    expect(res.status).toBe(403)
    expect(db.gamePlayer.update).not.toHaveBeenCalled()
  })

  it('blocks editing a game you neither created nor played', async () => {
    vi.mocked(db.game.findUnique).mockResolvedValue(game as never)
    const res = await patchGame(
      jsonRequest('http://localhost/api/v1/games/g1', { notes: 'hi' }, 'PATCH'),
      params('g1')
    )
    expect(res.status).toBe(403)
    expect(db.game.update).not.toHaveBeenCalled()
  })

  it('lets a player edit the game', async () => {
    vi.mocked(db.game.findUnique).mockResolvedValue({ ...game, players: [{ userId: 'u1' }] } as never)
    vi.mocked(db.game.update).mockResolvedValue({ id: 'g1' } as never)
    const res = await patchGame(
      jsonRequest('http://localhost/api/v1/games/g1', { notes: 'hi' }, 'PATCH'),
      params('g1')
    )
    expect(res.status).toBe(200)
  })
})

describe('POST /api/v1/games/setup/detect', () => {
  const url = 'http://localhost/api/v1/games/setup/detect'
  const body = {
    image: 'aGVsbG8=',
    mediaType: 'image/jpeg',
    playgroupId: 'pg1',
    format: 'commander',
    players: [{ key: 'a', name: 'Alice', userId: 'u1' }],
  }
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv, AI_ENABLED_USERS: 'alice', ANTHROPIC_API_KEY: 'test' }
    vi.mocked(db.user.findUnique).mockResolvedValue({ username: 'alice' } as never)
    vi.mocked(db.playgroupMember.findUnique).mockResolvedValue({ id: 'm1' } as never)
    vi.mocked(loadCandidates).mockResolvedValue([
      {
        ref: { kind: 'deck', id: 'd1' },
        name: 'Goblins',
        format: 'commander',
        commander1: 'Krenko, Mob Boss',
        commander2: null,
        bracket: null,
        owner: { userId: 'u1', name: 'alice' },
        pilots: [],
      },
    ])
  })

  it('is gated by the AI feature flag', async () => {
    process.env.AI_ENABLED_USERS = 'someone-else'
    const res = await detect(jsonRequest(url, body))
    expect(res.status).toBe(403)
    expect(detectCommanders).not.toHaveBeenCalled()
  })

  it('returns 503 without an API key', async () => {
    delete process.env.ANTHROPIC_API_KEY
    const res = await detect(jsonRequest(url, body))
    expect(res.status).toBe(503)
  })

  it('rejects oversized images and data URLs', async () => {
    expect((await detect(jsonRequest(url, { ...body, image: 'a'.repeat(3_500_001) }))).status).toBe(400)
    expect((await detect(jsonRequest(url, { ...body, image: 'data:image/jpeg;base64,xx' }))).status).toBe(400)
  })

  it('rejects non-members', async () => {
    vi.mocked(db.playgroupMember.findUnique).mockResolvedValue(null)
    const res = await detect(jsonRequest(url, body))
    expect(res.status).toBe(403)
  })

  it('detects commanders and proposes seats', async () => {
    vi.mocked(detectCommanders).mockResolvedValue([
      {
        id: 'c1',
        rawName: 'Krenko, Mob Boss',
        name: 'Krenko, Mob Boss',
        confidence: 'high',
        position: { x: 0.5, y: 0.5 },
        suggestions: [],
      },
    ])
    const res = await detect(jsonRequest(url, body))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.result.questions).toEqual([])
    expect(data.result.seats[0]).toMatchObject({ playerKey: 'a', status: 'owned', deck: { id: 'd1' } })
    expect(data.candidates).toHaveLength(1)
  })

  it('returns 502 with a friendly message when detection fails', async () => {
    vi.mocked(detectCommanders).mockRejectedValue(new DetectionError('The model response was cut off'))
    const res = await detect(jsonRequest(url, body))
    expect(res.status).toBe(502)
    expect((await res.json()).error).toBe('The model response was cut off')
  })
})
