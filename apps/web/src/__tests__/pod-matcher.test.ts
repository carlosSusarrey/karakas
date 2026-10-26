import { describe, it, expect } from 'vitest'
import {
  matchPod,
  defaultPins,
  seatsToPlayerSetup,
  type CandidateDeck,
  type DetectedCommander,
  type MatchInput,
  type Pin,
  type SetupPlayer,
} from '@karakas/shared'

let detectionCount = 0
function det(name: string | null, extra: Partial<DetectedCommander> = {}): DetectedCommander {
  detectionCount++
  return {
    id: `d${detectionCount}`,
    rawName: name ?? '???',
    name,
    confidence: 'high',
    position: { x: 0.5, y: 0.5 },
    suggestions: [],
    ...extra,
  }
}

function deck(
  id: string,
  owner: { userId?: string; playgroupPlayerId?: string; name: string },
  commander1: string,
  extra: Partial<CandidateDeck> = {}
): CandidateDeck {
  return {
    ref: { kind: owner.userId ? 'deck' : 'playgroupPlayerDeck', id },
    name: `${commander1} deck`,
    format: 'commander',
    commander1,
    commander2: null,
    bracket: null,
    owner,
    pilots: [],
    ...extra,
  }
}

const alice: SetupPlayer = { key: 'a', name: 'Alice', userId: 'u-alice' }
const bob: SetupPlayer = { key: 'b', name: 'Bob', userId: 'u-bob' }
const cara: SetupPlayer = { key: 'c', name: 'Cara', playgroupPlayerId: 'pp-cara' }
const dan: SetupPlayer = { key: 'd', name: 'Dan' } // one-off guest

const ALICE = { userId: 'u-alice', name: 'Alice' }
const BOB = { userId: 'u-bob', name: 'Bob' }
const CARA = { playgroupPlayerId: 'pp-cara', name: 'Cara' }
const ZOE = { userId: 'u-zoe', name: 'Zoe' }

function run(input: Partial<MatchInput> & Pick<MatchInput, 'detections' | 'players'>) {
  return matchPod({ candidates: [], format: 'commander', ...input })
}

function seatOf(result: ReturnType<typeof matchPod>, key: string) {
  return result.seats.find((s) => s.playerKey === key)!
}

describe('matchPod', () => {
  it('auto-matches everyone to their own deck with no questions', () => {
    const result = run({
      detections: [det('Atraxa, Praetors\' Voice'), det('Krenko, Mob Boss'), det('Edgar Markov')],
      players: [alice, bob, cara],
      candidates: [
        deck('atraxa', ALICE, "Atraxa, Praetors' Voice"),
        deck('krenko', BOB, 'Krenko, Mob Boss'),
        deck('edgar', CARA, 'Edgar Markov'),
      ],
    })

    expect(result.questions).toEqual([])
    expect(seatOf(result, 'a')).toMatchObject({ status: 'owned', deck: { kind: 'deck', id: 'atraxa' } })
    expect(seatOf(result, 'b')).toMatchObject({ status: 'owned', deck: { id: 'krenko' } })
    expect(seatOf(result, 'c')).toMatchObject({
      status: 'owned',
      deck: { kind: 'playgroupPlayerDeck', id: 'edgar' },
    })
  })

  it('matches names regardless of accents, case and back faces', () => {
    const result = run({
      detections: [det('jotun grunt'), det('Esika, God of the Tree')],
      players: [alice, bob],
      candidates: [
        deck('j', ALICE, 'Jötun Grunt'),
        deck('e', BOB, 'Esika, God of the Tree // The Prismatic Bridge'),
      ],
    })
    expect(result.questions).toEqual([])
    expect(seatOf(result, 'a').deck?.id).toBe('j')
    expect(seatOf(result, 'b').deck?.id).toBe('e')
  })

  it('asks who is playing when two present players own the only detected commander', () => {
    const result = run({
      detections: [det('Atraxa, Praetors\' Voice'), det('Krenko, Mob Boss')],
      players: [alice, bob, cara],
      candidates: [
        deck('atraxa-a', ALICE, "Atraxa, Praetors' Voice"),
        deck('atraxa-b', BOB, "Atraxa, Praetors' Voice"),
        deck('krenko', CARA, 'Krenko, Mob Boss'),
      ],
    })

    const q = result.questions.find((q) => q.type === 'which_player')!
    expect(q).toBeDefined()
    expect(q.options.map((o) => o.label).sort()).toEqual(['Alice', 'Bob'])
    expect(seatOf(result, 'c').deck?.id).toBe('krenko')
  })

  it('does not ask when the same commander appears twice with two owners present', () => {
    const result = run({
      detections: [det('Atraxa, Praetors\' Voice'), det('Atraxa, Praetors\' Voice')],
      players: [alice, bob],
      candidates: [
        deck('atraxa-a', ALICE, "Atraxa, Praetors' Voice"),
        deck('atraxa-b', BOB, "Atraxa, Praetors' Voice"),
      ],
    })
    expect(result.questions).toEqual([])
    expect(seatOf(result, 'a').deck?.id).toBe('atraxa-a')
    expect(seatOf(result, 'b').deck?.id).toBe('atraxa-b')
  })

  it('does not ask when another owner of the commander is clearly playing something else', () => {
    const result = run({
      detections: [det('Atraxa, Praetors\' Voice'), det('Krenko, Mob Boss')],
      players: [alice, bob],
      candidates: [
        deck('atraxa-a', ALICE, "Atraxa, Praetors' Voice"),
        deck('atraxa-b', BOB, "Atraxa, Praetors' Voice"),
        deck('krenko', BOB, 'Krenko, Mob Boss'),
      ],
    })
    expect(result.questions).toEqual([])
    expect(seatOf(result, 'a').deck?.id).toBe('atraxa-a')
    expect(seatOf(result, 'b').deck?.id).toBe('krenko')
  })

  it('asks which deck when one owner has two decks with the same commander, defaulting to the most played', () => {
    const result = run({
      detections: [det('Atraxa, Praetors\' Voice')],
      players: [alice],
      candidates: [
        deck('atraxa-1', ALICE, "Atraxa, Praetors' Voice", { name: 'Superfriends' }),
        deck('atraxa-2', ALICE, "Atraxa, Praetors' Voice", {
          name: 'Infect',
          pilots: [{ userId: 'u-alice' }, { userId: 'u-alice' }],
        }),
      ],
    })

    const q = result.questions[0]
    expect(q.type).toBe('duplicate_deck')
    expect(q.options.map((o) => o.label).sort()).toEqual(['Infect', 'Superfriends'])
    const def = q.options.find((o) => o.id === q.defaultOptionId)!
    expect(def.label).toBe('Infect')
  })

  it('asks to confirm a borrowed deck when the owner is not playing', () => {
    const result = run({
      detections: [det('Krenko, Mob Boss')],
      players: [alice],
      candidates: [deck('krenko', ZOE, 'Krenko, Mob Boss')],
    })

    expect(seatOf(result, 'a')).toMatchObject({ status: 'borrowed', deckOwnerName: 'Zoe' })
    const q = result.questions[0]
    expect(q.type).toBe('borrowed_confirm')
    expect(q.prompt).toContain("Zoe's")

    const yes = q.options.find((o) => o.id === q.defaultOptionId)!
    const confirmed = run({
      detections: [result.groups[0].detectionIds.map((id) => ({ ...det('Krenko, Mob Boss'), id }))[0]],
      players: [alice],
      candidates: [deck('krenko', ZOE, 'Krenko, Mob Boss')],
      pins: yes.pins,
    })
    expect(confirmed.questions).toEqual([])
    expect(seatOf(confirmed, 'a').status).toBe('borrowed')
  })

  it('offers a new deck for an unknown commander and creates it pending on confirm', () => {
    const d = det('Ms. Bumbleflower')
    const input = { detections: [d], players: [alice] }
    const result = run(input)

    expect(seatOf(result, 'a')).toMatchObject({
      status: 'new_deck',
      pendingNewDeck: { name: 'Ms. Bumbleflower', commander1: 'Ms. Bumbleflower' },
    })
    const q = result.questions[0]
    expect(q.type).toBe('new_deck')

    const confirmed = run({ ...input, pins: q.options[0].pins })
    expect(confirmed.questions).toEqual([])
    expect(seatOf(confirmed, 'a').status).toBe('new_deck')

    const justOnce = run({ ...input, pins: q.options[1].pins })
    expect(seatOf(justOnce, 'a')).toMatchObject({ status: 'no_deck', pendingNewDeck: null })
  })

  it('records only the commander for a one-off guest with an unknown commander', () => {
    const result = run({
      detections: [det('Krenko, Mob Boss'), det('Ms. Bumbleflower')],
      players: [alice, dan],
      candidates: [deck('krenko', ALICE, 'Krenko, Mob Boss')],
    })
    expect(result.questions).toEqual([])
    expect(seatOf(result, 'd')).toMatchObject({ status: 'no_deck', commanders: ['Ms. Bumbleflower'] })
  })

  it('groups a partner pair into one deck', () => {
    const result = run({
      detections: [det('Thrasios, Triton Hero'), det('Krenko, Mob Boss'), det('Tymna the Weaver')],
      players: [alice, bob],
      candidates: [
        deck('tt', ALICE, 'Thrasios, Triton Hero', { commander2: 'Tymna the Weaver' }),
        deck('krenko', BOB, 'Krenko, Mob Boss'),
      ],
    })
    expect(result.groups).toHaveLength(2)
    expect(result.questions).toEqual([])
    expect(seatOf(result, 'a')).toMatchObject({
      deck: { id: 'tt' },
      commanders: ['Thrasios, Triton Hero', 'Tymna the Weaver'],
    })
  })

  it('matches a partner deck when only one partner is visible', () => {
    const result = run({
      detections: [det('Thrasios, Triton Hero')],
      players: [alice],
      candidates: [deck('tt', ALICE, 'Thrasios, Triton Hero', { commander2: 'Tymna the Weaver' })],
    })
    expect(result.questions).toEqual([])
    expect(seatOf(result, 'a').deck?.id).toBe('tt')
  })

  it('groups partners the model reported even without a registered deck', () => {
    const a = det('Thrasios, Triton Hero')
    const b = det('Tymna the Weaver', { partnerOf: a.id })
    const result = run({ detections: [a, b], players: [alice] })
    expect(result.groups).toHaveLength(1)
    expect(seatOf(result, 'a').pendingNewDeck).toEqual({
      name: 'Thrasios, Triton Hero',
      commander1: 'Thrasios, Triton Hero',
      commander2: 'Tymna the Weaver',
    })
  })

  it('asks about an extra commander when there are more commanders than players', () => {
    const result = run({
      detections: [det('Krenko, Mob Boss'), det('Edgar Markov')],
      players: [alice],
      candidates: [deck('krenko', ALICE, 'Krenko, Mob Boss')],
    })
    expect(seatOf(result, 'a').deck?.id).toBe('krenko')
    const q = result.questions[0]
    expect(q.type).toBe('which_player')
    expect(q.defaultOptionId).toBe('ignore')
  })

  it('asks what an unmatched player is playing, offering their decks', () => {
    const result = run({
      detections: [det('Krenko, Mob Boss')],
      players: [alice, bob],
      candidates: [
        deck('krenko', ALICE, 'Krenko, Mob Boss'),
        deck('edgar', BOB, 'Edgar Markov'),
      ],
    })
    const q = result.questions.find((q) => q.type === 'unmatched_player')!
    expect(q.playerKey).toBe('b')
    expect(q.options[0].label).toBe('Edgar Markov deck')

    const answered = run({
      detections: result.groups.flatMap((g) => g.detectionIds).map((id) => ({ ...det('Krenko, Mob Boss'), id })),
      players: [alice, bob],
      candidates: [deck('krenko', ALICE, 'Krenko, Mob Boss'), deck('edgar', BOB, 'Edgar Markov')],
      pins: q.options[0].pins,
    })
    expect(seatOf(answered, 'b')).toMatchObject({ status: 'owned', deck: { id: 'edgar' } })
  })

  it('asks to confirm low-confidence and unreadable cards first', () => {
    const fuzzy = det('Krenko, Mob Boss', { confidence: 'low', suggestions: ['Krenko, Tin Street Kingpin'] })
    const unreadable = det(null, { rawName: 'Ed?ar M', suggestions: ['Edgar Markov'] })
    const result = run({
      detections: [fuzzy, unreadable],
      players: [alice, bob],
      candidates: [deck('krenko', ALICE, 'Krenko, Mob Boss'), deck('edgar', BOB, 'Edgar Markov')],
    })
    expect(result.questions.slice(0, 2).map((q) => q.type)).toEqual(['confirm_commander', 'confirm_commander'])
    expect(result.questions[1].allowCustomName).toEqual({ detectionId: unreadable.id })

    const pins: Pin[] = [
      { type: 'rename', detectionId: fuzzy.id, name: 'Krenko, Mob Boss' },
      { type: 'rename', detectionId: unreadable.id, name: 'Edgar Markov' },
    ]
    const fixed = run({
      detections: [fuzzy, unreadable],
      players: [alice, bob],
      candidates: [deck('krenko', ALICE, 'Krenko, Mob Boss'), deck('edgar', BOB, 'Edgar Markov')],
      pins,
    })
    expect(fixed.questions).toEqual([])
    expect(seatOf(fixed, 'b').deck?.id).toBe('edgar')
  })

  it('walks through who-plays-what when nobody has registered decks', () => {
    const detections = [det('Krenko, Mob Boss'), det('Edgar Markov'), det('Atraxa, Praetors\' Voice')]
    const players = [alice, bob, cara]
    const pins: Pin[] = []
    let result = run({ detections, players })
    let rounds = 0
    while (result.questions.some((q) => q.type === 'which_player') && rounds < 5) {
      const q = result.questions.find((q) => q.type === 'which_player')!
      // Answer with the last listed player to prove pins drive the outcome
      pins.push(...q.options[q.options.length - 1].pins)
      result = run({ detections, players, pins })
      rounds++
    }
    expect(rounds).toBe(2) // the last commander resolves itself
    const assigned = new Set(result.seats.map((s) => s.groupId))
    expect(assigned.size).toBe(3)
  })

  it('removes a pinned player from other questions', () => {
    const detections = [det('Krenko, Mob Boss'), det('Edgar Markov'), det('Atraxa, Praetors\' Voice')]
    const players = [alice, bob, cara]
    const first = run({ detections, players })
    const q = first.questions.find((q) => q.type === 'which_player')!
    const bobOption = q.options.find((o) => o.label === 'Bob')!
    const next = run({ detections, players, pins: bobOption.pins })
    for (const other of next.questions.filter((x) => x.type === 'which_player')) {
      expect(other.options.map((o) => o.label)).not.toContain('Bob')
    }
  })

  it('prefers last game\'s deck on a rematch', () => {
    const result = run({
      detections: [det('Atraxa, Praetors\' Voice')],
      players: [alice],
      candidates: [
        deck('atraxa-1', ALICE, "Atraxa, Praetors' Voice", { pilots: [{ userId: 'u-alice' }] }),
        deck('atraxa-2', ALICE, "Atraxa, Praetors' Voice"),
      ],
      previous: [{ playerKey: 'a', deck: { kind: 'deck', id: 'atraxa-2' } }],
    })
    expect(seatOf(result, 'a').deck?.id).toBe('atraxa-2')
  })

  it('honors an ignore pin', () => {
    const extra = det('Edgar Markov')
    const result = run({
      detections: [det('Krenko, Mob Boss'), extra],
      players: [alice],
      candidates: [deck('krenko', ALICE, 'Krenko, Mob Boss')],
      pins: [{ type: 'ignore', groupId: extra.id }],
    })
    expect(result.questions).toEqual([])
  })

  it('defaultPins resolves every question', () => {
    const detections = [det('Krenko, Mob Boss'), det('Ms. Bumbleflower')]
    const players = [alice, bob]
    const candidates = [deck('krenko', ZOE, 'Krenko, Mob Boss')]
    const first = run({ detections, players, candidates })
    expect(first.questions.length).toBeGreaterThan(0)
    let pins = defaultPins(first)
    let result = run({ detections, players, candidates, pins })
    for (let i = 0; i < 5 && result.questions.length > 0; i++) {
      pins = [...pins, ...defaultPins(result)]
      result = run({ detections, players, candidates, pins })
    }
    expect(result.questions).toEqual([])
  })

  it('is deterministic', () => {
    const input = {
      detections: [det('Krenko, Mob Boss'), det('Edgar Markov'), det('Atraxa, Praetors\' Voice')],
      players: [alice, bob, cara, dan],
      candidates: [deck('krenko', ALICE, 'Krenko, Mob Boss'), deck('edgar', ZOE, 'Edgar Markov')],
    }
    expect(run(input)).toEqual(run(input))
  })
})

describe('seatsToPlayerSetup', () => {
  it('maps seats to live game setup data', () => {
    const result = run({
      detections: [det('Krenko, Mob Boss'), det('Edgar Markov'), det('Ms. Bumbleflower')],
      players: [alice, cara, dan],
      candidates: [deck('krenko', ZOE, 'Krenko, Mob Boss'), deck('edgar', CARA, 'Edgar Markov')],
    })
    const setup = seatsToPlayerSetup([alice, cara, dan], result.seats)
    expect(setup[0]).toMatchObject({ name: 'Alice', userId: 'u-alice', deckId: 'krenko', deckOwnerName: 'Zoe' })
    expect(setup[1]).toMatchObject({ playgroupPlayerId: 'pp-cara', playgroupPlayerDeckId: 'edgar' })
    expect(setup[2]).toMatchObject({ name: 'Dan', guestName: 'Dan', commanderUsed1: 'Ms. Bumbleflower' })
    expect(setup[2].deckId).toBeUndefined()
  })
})
