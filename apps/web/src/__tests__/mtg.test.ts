import { describe, it, expect } from 'vitest'
import {
  MTG_FORMATS,
  COMMANDER_FORMATS,
  EDH_BRACKETS,
  POWER_PLAY_TYPES,
} from '@/types/mtg'

describe('MTG Types', () => {
  describe('MTG_FORMATS', () => {
    it('contains all standard formats', () => {
      expect(MTG_FORMATS).toContain('standard')
      expect(MTG_FORMATS).toContain('modern')
      expect(MTG_FORMATS).toContain('legacy')
      expect(MTG_FORMATS).toContain('vintage')
      expect(MTG_FORMATS).toContain('pioneer')
      expect(MTG_FORMATS).toContain('pauper')
    })

    it('contains commander formats', () => {
      expect(MTG_FORMATS).toContain('commander')
      expect(MTG_FORMATS).toContain('oathbreaker')
      expect(MTG_FORMATS).toContain('brawl')
    })

    it('contains limited formats', () => {
      expect(MTG_FORMATS).toContain('draft')
      expect(MTG_FORMATS).toContain('sealed')
    })
  })

  describe('COMMANDER_FORMATS', () => {
    it('is a subset of MTG_FORMATS', () => {
      COMMANDER_FORMATS.forEach((format) => {
        expect(MTG_FORMATS).toContain(format)
      })
    })

    it('contains only commander-related formats', () => {
      expect(COMMANDER_FORMATS).toContain('commander')
      expect(COMMANDER_FORMATS).toContain('oathbreaker')
      expect(COMMANDER_FORMATS).toContain('brawl')
    })

    it('does not contain non-commander formats', () => {
      expect(COMMANDER_FORMATS).not.toContain('standard')
      expect(COMMANDER_FORMATS).not.toContain('modern')
      expect(COMMANDER_FORMATS).not.toContain('draft')
    })
  })

  describe('EDH_BRACKETS', () => {
    it('contains brackets 1 through 5', () => {
      expect(EDH_BRACKETS).toEqual([1, 2, 3, 4, 5])
    })

    it('has exactly 5 brackets', () => {
      expect(EDH_BRACKETS).toHaveLength(5)
    })
  })

  describe('POWER_PLAY_TYPES', () => {
    it('contains core power play types', () => {
      expect(POWER_PLAY_TYPES).toContain('combo')
      expect(POWER_PLAY_TYPES).toContain('boardwipe')
      expect(POWER_PLAY_TYPES).toContain('theft')
      expect(POWER_PLAY_TYPES).toContain('wincon')
      expect(POWER_PLAY_TYPES).toContain('removal')
      expect(POWER_PLAY_TYPES).toContain('counter')
    })

    it('contains resource power play types', () => {
      expect(POWER_PLAY_TYPES).toContain('ramp')
      expect(POWER_PLAY_TYPES).toContain('draw')
      expect(POWER_PLAY_TYPES).toContain('tutor')
    })

    it('contains other as a catch-all', () => {
      expect(POWER_PLAY_TYPES).toContain('other')
    })
  })
})
