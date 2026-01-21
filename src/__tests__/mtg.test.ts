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
      expect(MTG_FORMATS).toContain('Standard')
      expect(MTG_FORMATS).toContain('Modern')
      expect(MTG_FORMATS).toContain('Legacy')
      expect(MTG_FORMATS).toContain('Vintage')
      expect(MTG_FORMATS).toContain('Pioneer')
      expect(MTG_FORMATS).toContain('Pauper')
    })

    it('contains commander formats', () => {
      expect(MTG_FORMATS).toContain('Commander')
      expect(MTG_FORMATS).toContain('Duel Commander')
    })

    it('contains limited formats', () => {
      expect(MTG_FORMATS).toContain('Draft')
      expect(MTG_FORMATS).toContain('Sealed')
    })
  })

  describe('COMMANDER_FORMATS', () => {
    it('is a subset of MTG_FORMATS', () => {
      COMMANDER_FORMATS.forEach((format) => {
        expect(MTG_FORMATS).toContain(format)
      })
    })

    it('contains only commander-related formats', () => {
      expect(COMMANDER_FORMATS).toContain('Commander')
    })

    it('does not contain non-commander formats', () => {
      expect(COMMANDER_FORMATS).not.toContain('Standard')
      expect(COMMANDER_FORMATS).not.toContain('Modern')
      expect(COMMANDER_FORMATS).not.toContain('Draft')
    })
  })

  describe('EDH_BRACKETS', () => {
    it('contains brackets 1 through 4', () => {
      expect(EDH_BRACKETS).toEqual([1, 2, 3, 4])
    })

    it('has exactly 4 brackets', () => {
      expect(EDH_BRACKETS).toHaveLength(4)
    })
  })

  describe('POWER_PLAY_TYPES', () => {
    it('contains core power play types', () => {
      expect(POWER_PLAY_TYPES).toContain('Combo')
      expect(POWER_PLAY_TYPES).toContain('Board Wipe')
      expect(POWER_PLAY_TYPES).toContain('Theft')
      expect(POWER_PLAY_TYPES).toContain('Win Condition')
      expect(POWER_PLAY_TYPES).toContain('Removal')
      expect(POWER_PLAY_TYPES).toContain('Counterspell')
    })

    it('contains resource power play types', () => {
      expect(POWER_PLAY_TYPES).toContain('Big Ramp')
      expect(POWER_PLAY_TYPES).toContain('Card Draw')
      expect(POWER_PLAY_TYPES).toContain('Tutor')
    })

    it('contains Other as a catch-all', () => {
      expect(POWER_PLAY_TYPES).toContain('Other')
    })
  })
})
