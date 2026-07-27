import { describe, it, expect } from 'vitest'
import {
  collectCharactersFromSource,
  filterCharacters,
  getCharacterCuePrefix,
  enforceCharacterUppercase,
  enforceSceneHeadingUppercase,
  normaliseCharacterName,
  bareCharacterName
} from '../src/shared/fountain/characters'

const SAMPLE = `
INT. LAB - DAY

ALICE
Hello.

BOB (V.O.)
Hi.

ALICE
Again.

CHARLIE
Yo.
`

describe('Character name memory', () => {
  it('collects unique character cues ranked by frequency', () => {
    const chars = collectCharactersFromSource(SAMPLE)
    const names = chars.map((c) => c.name)
    expect(names).toContain('ALICE')
    expect(names).toContain('BOB (V.O.)')
    expect(names).toContain('CHARLIE')
    const alice = chars.find((c) => c.name === 'ALICE')
    expect(alice?.count).toBe(2)
    // ALICE should rank above single-appearance characters
    expect(chars[0].name).toBe('ALICE')
  })

  it('filters by prefix', () => {
    const chars = collectCharactersFromSource(SAMPLE)
    const filtered = filterCharacters(chars, 'al')
    expect(filtered.every((c) => c.name.startsWith('AL'))).toBe(true)
    expect(filterCharacters(chars, '').length).toBe(chars.length)
  })

  it('normalises names', () => {
    expect(normaliseCharacterName('@alice ^')).toBe('ALICE')
    expect(bareCharacterName('BOB (V.O.)')).toBe('BOB')
  })

  it('detects character cue prefix at cursor', () => {
    const text = 'INT. ROOM - DAY\n\nAL'
    // cursor after "AL"
    const prefix = getCharacterCuePrefix(text, text.length)
    expect(prefix).toBe('AL')
  })

  it('returns empty prefix on blank cue line', () => {
    const text = 'INT. ROOM - DAY\n\n'
    const prefix = getCharacterCuePrefix(text, text.length)
    expect(prefix).toBe('')
  })

  it('returns null when not in cue context', () => {
    const text = 'INT. ROOM - DAY\nAction line AL'
    const prefix = getCharacterCuePrefix(text, text.length)
    expect(prefix).toBeNull()
  })

  it('returns null mid-action after non-blank previous line', () => {
    const text = 'Some action\nBO'
    expect(getCharacterCuePrefix(text, text.length)).toBeNull()
  })

  it('enforces character uppercase preserving dual and force markers', () => {
    expect(enforceCharacterUppercase('alice')).toBe('ALICE')
    expect(enforceCharacterUppercase('@bob (v.o.)')).toBe('@BOB (V.O.)')
    expect(enforceCharacterUppercase('carol ^')).toBe('CAROL ^')
  })

  it('enforces scene heading uppercase', () => {
    expect(enforceSceneHeadingUppercase('int. house - day')).toBe('INT. HOUSE - DAY')
    expect(enforceSceneHeadingUppercase('.the void')).toBe('.THE VOID')
  })

  it('handles empty document', () => {
    expect(collectCharactersFromSource('')).toEqual([])
    expect(collectCharactersFromSource('\n\n\n')).toEqual([])
  })
})
