import { describe, it, expect } from 'vitest'
import { fountainToPdf } from '../src/shared/export/pdf'

describe('PDF export', () => {
  it('generates a non-empty PDF buffer for a short script', async () => {
    const source = `
Title: PDF Test
Author: Tester

INT. ROOM - DAY

Action line here.

ALICE
Hello there, friend.

CUT TO:

EXT. PARK - NIGHT

The end.
`
    const buffer = await fountainToPdf(source, {
      title: 'PDF Test',
      author: 'Tester'
    })
    expect(Buffer.isBuffer(buffer)).toBe(true)
    expect(buffer.length).toBeGreaterThan(100)
    // PDF magic header
    expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF')
  })

  it('generates a PDF for an empty document', async () => {
    const buffer = await fountainToPdf('')
    expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF')
    expect(buffer.length).toBeGreaterThan(50)
  })

  it('handles a longer multi-page script', async () => {
    const parts: string[] = ['Title: Long\n\n']
    for (let i = 0; i < 40; i++) {
      parts.push(`INT. SET ${i} - DAY\n\n`)
      parts.push(`Action paragraph ${i}. `.repeat(10) + '\n\n')
      parts.push(`HERO\nLine ${i}.\n\n`)
    }
    const buffer = await fountainToPdf(parts.join(''))
    expect(buffer.subarray(0, 4).toString('utf8')).toBe('%PDF')
    expect(buffer.length).toBeGreaterThan(1000)
  }, 15_000)
})
