import { describe, it, expect } from 'vitest'
import {
  estimateWrappedLines,
  paginateSource,
  countPages,
  elementsToLayoutLines,
  paginateLayoutLines
} from '../src/shared/fountain/page-counter'
import { parseFountain } from '../src/shared/fountain/parser'
import { LINES_PER_PAGE } from '../src/shared/constants/screenplay'

describe('Page counting / pagination', () => {
  it('returns 1 page for empty document', () => {
    const result = paginateSource('')
    expect(result.pageCount).toBe(1)
    expect(result.wordCount).toBe(0)
  })

  it('returns 1 page for a short scene', () => {
    const source = `
INT. ROOM - DAY

A short scene.

ALICE
Hi.
`
    expect(countPages(source)).toBe(1)
  })

  it('estimates wrapped lines for long action', () => {
    const long = 'word '.repeat(200).trim()
    const lines = estimateWrappedLines(long, 60)
    expect(lines).toBeGreaterThan(5)
  })

  it('estimateWrappedLines handles empty text', () => {
    expect(estimateWrappedLines('', 60)).toBe(1)
    expect(estimateWrappedLines('   ', 60)).toBe(1)
  })

  it('paginates across multiple pages for long scripts', () => {
    const parts: string[] = []
    for (let i = 0; i < 80; i++) {
      parts.push(`INT. LOCATION ${i} - DAY`)
      parts.push('')
      parts.push(`Action description number ${i}. `.repeat(8))
      parts.push('')
      parts.push('HERO')
      parts.push(`This is dialogue line ${i} that goes on for a bit.`)
      parts.push('')
    }
    const result = paginateSource(parts.join('\n'))
    expect(result.pageCount).toBeGreaterThan(2)
    expect(result.wordCount).toBeGreaterThan(100)
    // Each page (except possibly last) should not wildly exceed capacity
    for (const page of result.pages) {
      const used = page.lines.reduce((s, l) => s + l.lineCount, 0)
      // Allow slight overflow for unsplittable blocks
      expect(used).toBeLessThan(LINES_PER_PAGE * 2)
    }
  })

  it('honours explicit page breaks', () => {
    const source = `
INT. A - DAY

First.

===

INT. B - DAY

Second.
`
    const result = paginateSource(source)
    expect(result.pageCount).toBeGreaterThanOrEqual(2)
  })

  it('layout lines skip notes and boneyard', () => {
    const doc = parseFountain(`
INT. ROOM - DAY

[[secret]]

/* bone */

Visible.
`)
    const layout = elementsToLayoutLines(doc.elements)
    expect(layout.every((l) => l.type !== 'note' && l.type !== 'boneyard')).toBe(
      true
    )
  })

  it('paginateLayoutLines always yields at least one page', () => {
    const pages = paginateLayoutLines([])
    expect(pages.length).toBe(1)
  })

  it('preserves blank lines between action paragraphs', () => {
    const source = `INT. ROOM - DAY

First action paragraph.

Second action paragraph after a blank line.
`
    const doc = parseFountain(source)
    const layout = elementsToLayoutLines(doc.elements)
    const types = layout.map((l) => (l.isSpacer ? 'spacer' : l.type))

    // Expect: scene_heading, spacer, action, spacer, action
    expect(types).toContain('spacer')
    const firstAction = types.indexOf('action')
    const secondAction = types.indexOf('action', firstAction + 1)
    expect(secondAction).toBeGreaterThan(firstAction)
    // There must be a spacer between the two action blocks
    expect(types.slice(firstAction + 1, secondAction)).toContain('spacer')
  })

  it('keeps a blank line before character cues', () => {
    const source = `INT. ROOM - DAY

Some action.

ALICE
Hello there.
`
    const doc = parseFountain(source)
    const layout = elementsToLayoutLines(doc.elements)
    const types = layout.map((l) => (l.isSpacer ? 'spacer' : l.type))
    const charIdx = types.indexOf('character')
    expect(charIdx).toBeGreaterThan(0)
    expect(types[charIdx - 1]).toBe('spacer')
  })

  it('does not insert a blank between character and dialogue', () => {
    const source = `
ALICE
Hello there.
`
    const doc = parseFountain(source)
    const layout = elementsToLayoutLines(doc.elements)
    const types = layout.map((l) => (l.isSpacer ? 'spacer' : l.type))
    const charIdx = types.indexOf('character')
    const dialIdx = types.indexOf('dialogue')
    expect(dialIdx).toBe(charIdx + 1)
  })

  it('counts spacer lines toward page usage', () => {
    const source = `INT. A - DAY

Action one.

Action two.

Action three.
`
    const result = paginateSource(source)
    const page = result.pages[0]
    const spacerCount = page.lines.filter((l) => l.isSpacer).length
    expect(spacerCount).toBeGreaterThanOrEqual(2)
    const used = page.lines.reduce((s, l) => s + l.lineCount, 0)
    // More lines than just the non-blank content
    const contentLines = page.lines.filter((l) => !l.isSpacer).length
    expect(used).toBeGreaterThan(contentLines)
  })
})
