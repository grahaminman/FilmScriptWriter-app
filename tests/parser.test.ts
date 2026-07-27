import { describe, it, expect } from 'vitest'
import {
  parseFountain,
  isCharacterCue,
  isSceneHeading,
  countWords,
  bodyTextForWordCount
} from '../src/shared/fountain/parser'

describe('Fountain parser', () => {
  it('parses an empty document', () => {
    const doc = parseFountain('')
    expect(doc.elements).toEqual([])
    expect(doc.titlePage.extra).toEqual({})
  })

  it('parses title page and body', () => {
    const source = `Title: My Script
Author: Jane Doe

INT. ROOM - DAY

Hello there.
`
    const doc = parseFountain(source)
    expect(doc.titlePage.title).toBe('My Script')
    expect(doc.titlePage.author).toBe('Jane Doe')
    expect(doc.elements.some((e) => e.type === 'scene_heading')).toBe(true)
    expect(doc.elements.some((e) => e.type === 'action')).toBe(true)
  })

  it('classifies scene headings (natural and forced)', () => {
    expect(isSceneHeading('INT. HOUSE - NIGHT')).toBe(true)
    expect(isSceneHeading('ext. park - day')).toBe(true)
    expect(isSceneHeading('.THE VOID')).toBe(true)
    expect(isSceneHeading('Just action')).toBe(false)
  })

  it('classifies character cues', () => {
    expect(isCharacterCue('ALICE')).toBe(true)
    expect(isCharacterCue('BOB (V.O.)')).toBe(true)
    expect(isCharacterCue('ALICE ^')).toBe(true)
    expect(isCharacterCue('@Narrator')).toBe(true)
    expect(isCharacterCue('not a character')).toBe(false)
    expect(isCharacterCue('INT. ROOM - DAY')).toBe(false)
  })

  it('parses dialogue blocks with parentheticals', () => {
    const source = `
INT. OFFICE - DAY

ALICE
(whispering)
We need to talk.

BOB
I know.
`
    const doc = parseFountain(source)
    const types = doc.elements.filter((e) => e.type !== 'empty').map((e) => e.type)
    expect(types).toContain('character')
    expect(types).toContain('parenthetical')
    expect(types).toContain('dialogue')
    const alice = doc.elements.find((e) => e.type === 'character' && e.text.includes('ALICE'))
    expect(alice?.text).toBe('ALICE')
  })

  it('parses transitions', () => {
    const doc = parseFountain(`
INT. ROOM - DAY

Something happens.

CUT TO:

EXT. STREET - DAY
`)
    expect(doc.elements.some((e) => e.type === 'transition')).toBe(true)
  })

  it('ignores boneyard and notes for structure', () => {
    const doc = parseFountain(`
INT. ROOM - DAY

/* this is hidden */

[[a note]]

Visible action.
`)
    expect(doc.elements.some((e) => e.type === 'boneyard')).toBe(true)
    expect(doc.elements.some((e) => e.type === 'note')).toBe(true)
    expect(doc.elements.some((e) => e.type === 'action' && e.text.includes('Visible'))).toBe(
      true
    )
  })

  it('handles page breaks', () => {
    const doc = parseFountain(`
Action one.

===

Action two.
`)
    expect(doc.elements.some((e) => e.type === 'page_break')).toBe(true)
  })

  it('counts words excluding notes/boneyard', () => {
    const doc = parseFountain(`
INT. ROOM - DAY

Hello world friends.

[[ignore me]]
`)
    const text = bodyTextForWordCount(doc)
    expect(countWords(text)).toBeGreaterThanOrEqual(3)
    expect(text).not.toContain('ignore')
  })

  it('handles very long documents without throwing', () => {
    const lines: string[] = ['INT. WAREHOUSE - NIGHT', '']
    for (let i = 0; i < 500; i++) {
      lines.push(`CHARACTER${i % 20}`)
      lines.push(`Dialogue line number ${i}.`)
      lines.push('')
      lines.push(`Action beat ${i}.`)
      lines.push('')
    }
    const doc = parseFountain(lines.join('\n'))
    expect(doc.elements.length).toBeGreaterThan(1000)
  })
})
