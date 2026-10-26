import { describe, it, expect, vi, beforeEach } from 'vitest'

const { create } = vi.hoisted(() => ({ create: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create }
  },
}))

vi.mock('@/lib/scryfall', () => ({
  autocompleteCards: vi.fn(),
  canBeCommander: vi.fn(() => true),
  getCardByName: vi.fn(),
  getCardFuzzy: vi.fn(),
  getCardImageUrlFromCard: vi.fn(() => 'https://img/art.jpg'),
}))

import { autocompleteCards, canBeCommander, getCardByName, getCardFuzzy } from '@/lib/scryfall'
import {
  buildDetectionPrompt,
  detectCommanders,
  levenshtein,
  parseDetection,
  snapToKnown,
  DetectionError,
} from '@/lib/commander-detector'

const card = (name: string) => ({ id: name, name, type_line: 'Legendary Creature', legalities: {} })

function modelReply(commanders: unknown[], stop_reason = 'end_turn') {
  return {
    model: 'claude-opus-5-5',
    stop_reason,
    usage: { input_tokens: 1, output_tokens: 1 },
    content: [{ type: 'text', text: JSON.stringify({ commanders }) }],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(canBeCommander).mockReturnValue(true)
})

describe('helpers', () => {
  it('computes edit distance', () => {
    expect(levenshtein('krenko', 'krenko')).toBe(0)
    expect(levenshtein('krenk', 'krenko')).toBe(1)
    expect(levenshtein('abc', 'xyz')).toBe(3)
  })

  it('snaps near-misses to registered names only', () => {
    const known = ["Atraxa, Praetors' Voice", 'Krenko, Mob Boss']
    expect(snapToKnown('Atraxa Praetors Voice', known)).toBe("Atraxa, Praetors' Voice")
    expect(snapToKnown('Krenko Mob Bos', known)).toBe('Krenko, Mob Boss')
    expect(snapToKnown('Krenko, Tin Street Kingpin', known)).toBeNull()
  })

  it('lists known commanders in the prompt, capped', () => {
    const prompt = buildDetectionPrompt(4, Array.from({ length: 200 }, (_, i) => `Card ${i}`))
    expect(prompt).toContain('4 players')
    expect(prompt).toContain('- Card 149')
    expect(prompt).not.toContain('- Card 150')
  })

  it('parses and sanitizes model output', () => {
    const parsed = parseDetection(
      JSON.stringify({
        commanders: [
          { name: ' Krenko ', confidence: 'weird', partner_index: 1.5, x: 4, y: -1 },
          { name: '', confidence: 'high', partner_index: null, x: 0, y: 0 },
        ],
      })
    )
    expect(parsed).toEqual([{ name: 'Krenko', confidence: 'low', partner_index: null, x: 1, y: 0 }])
    expect(() => parseDetection('nope')).toThrow(DetectionError)
  })
})

describe('detectCommanders', () => {
  const input = { image: 'SECRET_IMAGE_DATA', mediaType: 'image/jpeg' as const, playerCount: 2 }

  it('sends the image with a structured output schema and canonicalizes results', async () => {
    create.mockResolvedValue(
      modelReply([
        { name: 'Thrasios, Triton Hero', confidence: 'high', partner_index: 1, x: 0.2, y: 0.5 },
        { name: 'Tymna the Weaver', confidence: 'high', partner_index: null, x: 0.3, y: 0.5 },
        { name: 'Krenko Mob Bos', confidence: 'medium', partner_index: null, x: 0.8, y: 0.5 },
      ])
    )
    vi.mocked(getCardFuzzy).mockImplementation(async (n: string) => card(n) as never)
    vi.mocked(getCardByName).mockImplementation(async (n: string) => card(n) as never)

    const result = await detectCommanders({ ...input, knownCommanders: ['Krenko, Mob Boss'] })

    const request = create.mock.calls[0][0]
    expect(request.model).toBe('claude-opus-5-5')
    expect(request.tool_choice).toBeUndefined()
    expect(request.output_config.format.type).toBe('json_schema')
    expect(request.messages[0].content[0]).toEqual({
      type: 'image',
      source: { type: 'base64', media_type: 'image/jpeg', data: 'SECRET_IMAGE_DATA' },
    })

    expect(result.map((d) => d.name)).toEqual(['Thrasios, Triton Hero', 'Tymna the Weaver', 'Krenko, Mob Boss'])
    expect(result[0].partnerOf).toBe('c2')
    expect(result[2]).toMatchObject({ confidence: 'medium', imageUrl: 'https://img/art.jpg' })
  })

  it('marks unreadable cards with suggestions', async () => {
    create.mockResolvedValue(modelReply([{ name: 'Edg Mrkv', confidence: 'low', partner_index: null, x: 0.5, y: 0.5 }]))
    vi.mocked(getCardFuzzy).mockResolvedValue(null)
    vi.mocked(autocompleteCards).mockResolvedValue(['Edgar Markov', 'Edgar, Charmed Groom'])

    const [d] = await detectCommanders({ ...input, knownCommanders: [] })
    expect(d).toMatchObject({ name: null, rawName: 'Edg Mrkv', confidence: 'low', suggestions: ['Edgar Markov', 'Edgar, Charmed Groom'] })
  })

  it('flags cards that cannot be commanders', async () => {
    create.mockResolvedValue(modelReply([{ name: 'Sol Ring', confidence: 'high', partner_index: null, x: 0.5, y: 0.5 }]))
    vi.mocked(getCardFuzzy).mockResolvedValue(card('Sol Ring') as never)
    vi.mocked(canBeCommander).mockReturnValue(false)
    const [d] = await detectCommanders({ ...input, knownCommanders: [] })
    expect(d.confidence).toBe('low')
  })

  it('raises a DetectionError on refusals and truncation without leaking the image', async () => {
    create.mockResolvedValue(modelReply([], 'refusal'))
    await expect(detectCommanders({ ...input, knownCommanders: [] })).rejects.toThrow(DetectionError)

    create.mockResolvedValue(modelReply([], 'max_tokens'))
    const error = await detectCommanders({ ...input, knownCommanders: [] }).catch((e) => e)
    expect(error).toBeInstanceOf(DetectionError)
    expect(String(error.message)).not.toContain('SECRET_IMAGE_DATA')
  })
})
