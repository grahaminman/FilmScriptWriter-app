import { describe, it, expect } from 'vitest'
import {
  emphasisToHtml,
  emphasisToPlain,
  stripInlineNotes
} from '../src/shared/fountain/emphasis'
import { parseFountain } from '../src/shared/fountain/parser'
import { elementsToLayoutLines } from '../src/shared/fountain/page-counter'
import { enforceCharacterUppercase } from '../src/shared/fountain/characters'
import { globToRegExpSource } from '../src/renderer/editor/smart-search'

describe('Fountain emphasis', () => {
  it('renders italics, bold, bold-italic, underline', () => {
    expect(emphasisToHtml('say *hi* now')).toBe('say <em>hi</em> now')
    expect(emphasisToHtml('say **hi** now')).toBe('say <strong>hi</strong> now')
    expect(emphasisToHtml('say ***hi*** now')).toBe(
      'say <em><strong>hi</strong></em> now'
    )
    expect(emphasisToHtml('say _hi_ now')).toBe('say <u>hi</u> now')
  })

  it('strips markers for plain text', () => {
    expect(emphasisToPlain('A *good* **day**')).toBe('A good day')
  })

  it('strips inline notes', () => {
    expect(stripInlineNotes('Hello [[fix me]] world')).toBe('Hello  world')
  })

  it('does not treat spaced asterisks as emphasis', () => {
    // fountain.io: space after opening * prevents italics
    const html = emphasisToHtml('dialed *69 and then *23, ok')
    expect(html).toContain('*69')
  })
})

describe('Forced @ character case', () => {
  it('preserves mixed case for @ names in parse', () => {
    const doc = parseFountain(`
@McClane
Yippie ki-yay!
`)
    const ch = doc.elements.find((e) => e.type === 'character')
    expect(ch?.text).toBe('McClane')
    expect(ch?.forced).toBe(true)
  })

  it('uppercases unforced character cues', () => {
    const doc = parseFountain(`
JOHN
Hello.
`)
    const ch = doc.elements.find((e) => e.type === 'character')
    expect(ch?.text).toBe('JOHN')
  })

  it('does not uppercase forced names on Enter', () => {
    expect(enforceCharacterUppercase('@McClane')).toBe('@McClane')
    expect(enforceCharacterUppercase('alice')).toBe('ALICE')
  })
})

describe('Dual dialogue layout', () => {
  it('marks left/right columns when second cue has ^', () => {
    const doc = parseFountain(`
BRICK
Screw retirement.

STEEL ^
Screw retirement.
`)
    const layout = elementsToLayoutLines(doc.elements)
    const left = layout.filter((l) => l.dualColumn === 'left')
    const right = layout.filter((l) => l.dualColumn === 'right')
    expect(left.some((l) => l.type === 'character' && l.text === 'BRICK')).toBe(
      true
    )
    expect(right.some((l) => l.type === 'character' && l.text === 'STEEL')).toBe(
      true
    )
    expect(left[0]?.dualGroup).toBe(right[0]?.dualGroup)
  })
})

describe('Find/replace wildcards', () => {
  it('converts #*# to a pattern that matches scene numbers', () => {
    const re = new RegExp(globToRegExpSource('#*#'), 'g')
    const sample = 'INT. HOUSE - DAY #1#\nINT. HOUSE - NIGHT #2A#'
    const matches = sample.match(re)
    expect(matches).toEqual(['#1#', '#2A#'])
    expect(sample.replace(re, '')).toBe(
      'INT. HOUSE - DAY \nINT. HOUSE - NIGHT '
    )
  })

  it('does not use regex * quantifier semantics for #*#', () => {
    // Broken behaviour was: #*# as regex matches single # → leaves digits
    const broken = new RegExp('#*#', 'g')
    const sample = '#1#'
    // broken leaves "1"
    expect(sample.replace(broken, '')).toBe('1')
    // fixed removes whole token
    const fixed = new RegExp(globToRegExpSource('#*#'), 'g')
    expect(sample.replace(fixed, '')).toBe('')
  })
})
