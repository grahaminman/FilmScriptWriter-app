import { describe, it, expect } from 'vitest'
import { fountainToFdx, escapeXml, documentToFdx } from '../src/shared/export/fdx'
import { prepareFountainExport } from '../src/shared/export/fountain-export'
import { parseFountain } from '../src/shared/fountain/parser'

describe('Export generation', () => {
  describe('Fountain export', () => {
    it('normalises line endings and ensures trailing newline', () => {
      expect(prepareFountainExport('Hello\r\nWorld')).toBe('Hello\nWorld\n')
      expect(prepareFountainExport('')).toBe('\n')
      expect(prepareFountainExport('Already\n')).toBe('Already\n')
    })
  })

  describe('FDX export', () => {
    it('escapes XML special characters', () => {
      expect(escapeXml(`A & B <C> "D" 'E'`)).toBe(
        'A &amp; B &lt;C&gt; &quot;D&quot; &apos;E&apos;'
      )
    })

    it('produces a valid Final Draft root structure', () => {
      const source = `
Title: Test Script
Author: Tester

INT. ROOM - DAY

Something happens.

ALICE
(softly)
Hello & goodbye.

CUT TO:
`
      const xml = fountainToFdx(source)
      expect(xml).toContain('<?xml version="1.0"')
      expect(xml).toContain('<FinalDraft')
      expect(xml).toContain('Type="Scene Heading"')
      expect(xml).toContain('Type="Action"')
      expect(xml).toContain('Type="Character"')
      expect(xml).toContain('Type="Parenthetical"')
      expect(xml).toContain('Type="Dialogue"')
      expect(xml).toContain('Type="Transition"')
      expect(xml).toContain('Hello &amp; goodbye.')
      expect(xml).toContain('</FinalDraft>')
    })

    it('exports empty document with a placeholder paragraph', () => {
      const xml = documentToFdx(parseFountain(''))
      expect(xml).toContain('<Paragraph Type="Action">')
    })

    it('includes title page when present', () => {
      const xml = fountainToFdx('Title: Epic\nAuthor: Ada\n\nINT. A - DAY\n\nGo.\n')
      expect(xml).toContain('<TitlePage>')
      expect(xml).toContain('Epic')
      expect(xml).toContain('Ada')
    })
  })
})
