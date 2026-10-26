import { describe, it, expect } from 'vitest'
import {
  computePlacements,
  buildCompleteGameRequest,
  rematchSetup,
  createInitialState,
  gameReducer,
} from '@karakas/shared'

describe('computePlacements', () => {
  it('ranks winner, survivors, then eliminated by turn', () => {
    const result = computePlacements(
      [
        { seat: 0, eliminatedTurn: 3 },
        { seat: 1, eliminatedTurn: null },
        { seat: 2, eliminatedTurn: 7 },
        { seat: 3, eliminatedTurn: null },
      ],
      { winnerSeat: 1, isDraw: false }
    )
    expect(result).toEqual([
      { seat: 0, placement: 4, isWinner: false, isFirstOut: true },
      { seat: 1, placement: 1, isWinner: true, isFirstOut: false },
      { seat: 2, placement: 3, isWinner: false, isFirstOut: false },
      { seat: 3, placement: 2, isWinner: false, isFirstOut: false },
    ])
  })

  it('gives tied eliminations the same placement and both first out', () => {
    const result = computePlacements(
      [
        { seat: 0, eliminatedTurn: 5 },
        { seat: 1, eliminatedTurn: 5 },
        { seat: 2, eliminatedTurn: null },
      ],
      { winnerSeat: 2, isDraw: false }
    )
    expect(result.map((r) => r.placement)).toEqual([2, 2, 1])
    expect(result.map((r) => r.isFirstOut)).toEqual([true, true, false])
  })

  it('shares first place among survivors on a draw', () => {
    const result = computePlacements(
      [
        { seat: 0, eliminatedTurn: null },
        { seat: 1, eliminatedTurn: null },
        { seat: 2, eliminatedTurn: 4 },
      ],
      { winnerSeat: null, isDraw: true }
    )
    expect(result.map((r) => r.placement)).toEqual([1, 1, 3])
    expect(result.every((r) => !r.isWinner)).toBe(true)
  })

  it('handles a draw where everyone died on the same turn', () => {
    const result = computePlacements(
      [
        { seat: 0, eliminatedTurn: 6 },
        { seat: 1, eliminatedTurn: 6 },
        { seat: 2, eliminatedTurn: 2 },
      ],
      { winnerSeat: null, isDraw: true }
    )
    expect(result.map((r) => r.placement)).toEqual([1, 1, 3])
    expect(result[2].isFirstOut).toBe(true)
  })

  it('handles no eliminations', () => {
    const result = computePlacements(
      [
        { seat: 0, eliminatedTurn: null },
        { seat: 1, eliminatedTurn: null },
      ],
      { winnerSeat: 0, isDraw: false }
    )
    expect(result.map((r) => r.placement)).toEqual([1, 2])
    expect(result.some((r) => r.isFirstOut)).toBe(false)
  })

  it('honors a winner who had been marked eliminated', () => {
    const result = computePlacements(
      [
        { seat: 0, eliminatedTurn: 9 },
        { seat: 1, eliminatedTurn: 4 },
      ],
      { winnerSeat: 0, isDraw: false }
    )
    expect(result[0]).toMatchObject({ placement: 1, isWinner: true })
    expect(result[1]).toMatchObject({ placement: 2, isFirstOut: true })
  })
})

describe('buildCompleteGameRequest', () => {
  it('maps players to seats with deck kinds, guests and the winner seat', () => {
    let state = createInitialState(
      'commander',
      [
        { name: 'Alice', userId: 'u1', deckId: 'd1' },
        { name: 'Cara', playgroupPlayerId: 'pp1', playgroupPlayerDeckId: 'pd1' },
        { name: 'Dan', commanderUsed1: 'Krenko, Mob Boss' },
        {
          name: 'Bob',
          userId: 'u2',
          pendingNewDeck: { name: 'Edgar', commander1: 'Edgar Markov' },
        },
      ],
      'pg1'
    )
    state = gameReducer(state, { type: 'ELIMINATE_PLAYER', playerId: state.players[2].id })

    const req = buildCompleteGameRequest(state, {
      winnerPlayerId: state.players[1].id,
      isDraw: false,
    })

    expect(req.playgroupId).toBe('pg1')
    expect(req.winnerSeat).toBe(1)
    expect(req.seats[0]).toMatchObject({ seat: 0, userId: 'u1', deck: { kind: 'deck', id: 'd1' } })
    expect(req.seats[1]).toMatchObject({ deck: { kind: 'playgroupPlayerDeck', id: 'pd1' } })
    expect(req.seats[2]).toMatchObject({ guestName: 'Dan', eliminatedTurn: 1, commanderUsed1: 'Krenko, Mob Boss' })
    expect(req.seats[3].pendingNewDeck).toEqual({ name: 'Edgar', commander1: 'Edgar Markov' })
  })

  it('sends no winner on a draw', () => {
    const state = createInitialState('commander', [{ name: 'A' }, { name: 'B' }])
    const req = buildCompleteGameRequest(state, { winnerPlayerId: state.players[0].id, isDraw: true })
    expect(req.winnerSeat).toBeNull()
  })
})

describe('rematchSetup', () => {
  it('swaps created decks in for pending ones', () => {
    const state = createInitialState('commander', [
      { name: 'Alice', userId: 'u1', deckId: 'd1' },
      { name: 'Bob', userId: 'u2', pendingNewDeck: { name: 'Edgar', commander1: 'Edgar Markov' } },
    ])
    const setup = rematchSetup(state, [{ seat: 1, deck: { kind: 'deck', id: 'new-deck' } }])
    expect(setup[0]).toMatchObject({ name: 'Alice', deckId: 'd1' })
    expect(setup[1]).toMatchObject({ name: 'Bob', deckId: 'new-deck', pendingNewDeck: undefined })
  })
})

describe('gameReducer', () => {
  it('keeps setup metadata through undo', () => {
    let state = createInitialState('commander', [
      { name: 'Alice', userId: 'u1', playgroupPlayerDeckId: 'pd1', deckOwnerName: 'Zoe' },
      { name: 'Bob' },
    ])
    state = gameReducer(state, { type: 'CHANGE_LIFE', playerId: state.players[0].id, amount: -5 })
    state = gameReducer(state, { type: 'UNDO' })
    expect(state.players[0]).toMatchObject({
      lifeTotal: 40,
      serverPlaygroupPlayerDeckId: 'pd1',
      deckOwnerName: 'Zoe',
    })
  })

  it('eliminates a player at 0 life on the current turn', () => {
    let state = createInitialState('commander', [{ name: 'A' }, { name: 'B' }])
    state = gameReducer(state, { type: 'CHANGE_LIFE', playerId: state.players[0].id, amount: -40 })
    expect(state.players[0]).toMatchObject({ isEliminated: true, eliminatedTurn: 1 })
  })
})
