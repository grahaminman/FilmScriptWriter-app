import { describe, it, expect } from 'vitest'
import { classifyDocumentLines } from '../src/renderer/editor/fountain-line-highlighter'
import { Text } from '@codemirror/state'

function docFrom(source: string) {
  // Text.of expects an array of lines, not a raw string
  return Text.of(source.replace(/\r\n/g, '\n').split('\n'))
}

describe('Fountain line classifier (syntax highlighting)', () => {
  it('assigns distinct kinds to core elements', () => {
    const source = `Title: Test

INT. ROOM - DAY

Action line here.

ALICE
(softly)
Hello.

CUT TO:

/* bone */

[[note]]
`
    const doc = docFrom(source)
    const kinds = classifyDocumentLines(doc)
    const values = []
    for (let i = 1; i <= doc.lines; i++) values.push(kinds[i])
    expect(values).toContain('meta')
    expect(values).toContain('scene')
    expect(values).toContain('action')
    expect(values).toContain('character')
    expect(values).toContain('parenthetical')
    expect(values).toContain('dialogue')
    expect(values).toContain('transition')
    expect(values).toContain('boneyard')
    expect(values).toContain('note')
  })

  it('does not classify everything as the same kind', () => {
    const doc = docFrom(`INT. A - DAY

Action.

BOB
Hi.
`)
    const kinds = classifyDocumentLines(doc)
    const set = new Set(Object.values(kinds).filter(Boolean))
    expect(set.size).toBeGreaterThan(3)
  })
})
