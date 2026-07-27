/**
 * Character name memory for intelligent auto-completion.
 *
 * Scans a Fountain document (or raw text) and builds a frequency-ranked
 * list of character cues. The editor uses this list for CodeMirror
 * autocomplete when the user is typing on a blank-line-preceded cue line.
 */

import {
  parseFountain,
  isCharacterCue,
  isSceneHeading,
  stripForcePrefix
} from './parser'
import type { CharacterEntry, FountainDocument } from './types'

/**
 * Normalise a character cue for storage / comparison.
 * - Uppercase
 * - Strip dual-dialogue caret
 * - Strip @ force prefix
 * - Preserve parenthetical extensions like (V.O.) as part of the name key
 *   but also register the bare name for broader matching.
 */
export function normaliseCharacterName(raw: string): string {
  let name = raw.trim()
  if (name.startsWith('@')) name = name.slice(1)
  name = name.replace(/\s*\^\s*$/, '')
  return name.toUpperCase()
}

/**
 * Extract the bare character name without parenthetical extensions.
 * e.g. "JOHN (V.O.)" → "JOHN"
 */
export function bareCharacterName(name: string): string {
  return normaliseCharacterName(name).replace(/\s*\(.*\)\s*$/, '').trim()
}

/**
 * Collect every character cue from a parsed document, ranked by frequency
 * (most common first), then alphabetically as a stable tie-breaker.
 */
export function collectCharacters(doc: FountainDocument): CharacterEntry[] {
  const counts = new Map<string, number>()

  for (const el of doc.elements) {
    if (el.type !== 'character') continue
    const name = normaliseCharacterName(el.text)
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)

    // Also index bare name if an extension is present
    const bare = bareCharacterName(name)
    if (bare && bare !== name) {
      // Don't double-count bare as a cue appearance; only ensure it exists
      if (!counts.has(bare)) counts.set(bare, 0)
    }
  }

  const entries: CharacterEntry[] = []
  for (const [name, count] of counts) {
    // Skip bare placeholders that never appeared as full cues with count 0
    // unless they are pure bare names from real cues
    if (count === 0) {
      // Keep bare names only if no extended form is the sole entry —
      // actually we want bare names for autocomplete even if only "JOHN (V.O.)" exists
      entries.push({ name, count: 0 })
      continue
    }
    entries.push({ name, count })
  }

  entries.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return a.name.localeCompare(b.name)
  })

  return entries
}

/**
 * Convenience: collect characters directly from source text.
 */
export function collectCharactersFromSource(source: string): CharacterEntry[] {
  return collectCharacters(parseFountain(source))
}

/**
 * Filter character entries by a typed prefix (case-insensitive).
 * Empty prefix returns the full ranked list.
 */
export function filterCharacters(
  entries: CharacterEntry[],
  prefix: string
): CharacterEntry[] {
  const p = prefix.trim().toUpperCase()
  if (!p) return entries
  return entries.filter((e) => e.name.startsWith(p))
}

/**
 * Determine whether the cursor position is on a potential character cue line.
 *
 * A cue line is:
 *  - the current line of text (from line start to cursor)
 *  - preceded by a blank line (or start of document / after title page)
 *  - not a scene heading
 *  - looks like the start of a name (letters)
 *
 * Returns the partial text typed so far on that line, or null if not a cue context.
 */
export function getCharacterCuePrefix(
  fullText: string,
  cursorOffset: number
): string | null {
  if (cursorOffset < 0) return null
  const text = fullText.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const safeOffset = Math.min(cursorOffset, text.length)

  // Find start of current line
  const lineStart = text.lastIndexOf('\n', safeOffset - 1) + 1
  const linePrefix = text.slice(lineStart, safeOffset)

  // Character cues cannot contain newlines; reject if mid-line past weird chars
  if (linePrefix.includes('\t') && linePrefix.trim() === '') return null

  // Must be preceded by blank line or document start
  if (lineStart > 0) {
    // Character before the newline
    const prevNewline = text.lastIndexOf('\n', lineStart - 2)
    const prevLine = text.slice(prevNewline + 1, lineStart - 1)
    if (prevLine.trim() !== '') {
      return null
    }
  }

  const trimmedStart = linePrefix.trimStart()
  // Allow @ force prefix
  const candidate = trimmedStart.startsWith('@')
    ? trimmedStart.slice(1)
    : trimmedStart

  // Empty line at cue position → offer all characters
  if (candidate === '') return ''

  // Must look like a character name being typed (letters, spaces, .-' () )
  if (!/^[A-Za-z0-9][A-Za-z0-9\s.\-'()]*$/.test(candidate)) {
    return null
  }

  // Don't treat scene headings as character cues
  if (/^(INT\.|EXT\.|EST\.|I\/E\.|INT\/EXT\.)/i.test(candidate)) {
    return null
  }

  return candidate
}

/**
 * Given the raw line text for a completed character cue, return the
 * uppercase version that should replace it (preserving force prefix / dual).
 */
export function enforceCharacterUppercase(line: string): string {
  const trimmedEnd = line.replace(/\s+$/, '')
  const leadingWs = line.match(/^\s*/)?.[0] ?? ''
  let body = trimmedEnd.slice(leadingWs.length)

  if (!body) return line

  let force = false
  if (body.startsWith('@')) {
    force = true
    body = body.slice(1)
  }

  let dual = false
  if (/\^\s*$/.test(body)) {
    dual = true
    body = body.replace(/\s*\^\s*$/, '')
  }

  // Split optional parenthetical extension
  const parenMatch = body.match(/^(.*?)(\s*\(.*\))\s*$/)
  let namePart: string
  let extPart = ''
  if (parenMatch) {
    namePart = parenMatch[1]
    extPart = parenMatch[2]
  } else {
    namePart = body
  }

  const upper = namePart.toUpperCase() + extPart.toUpperCase()
  return leadingWs + (force ? '@' : '') + upper + (dual ? ' ^' : '')
}

/**
 * Enforce uppercase on a scene heading line (preserving leading `.` force).
 */
export function enforceSceneHeadingUppercase(line: string): string {
  const leadingWs = line.match(/^\s*/)?.[0] ?? ''
  let body = line.slice(leadingWs.length)
  if (!body.trim()) return line

  if (body.startsWith('.') && !body.startsWith('..')) {
    return leadingWs + '.' + body.slice(1).toUpperCase()
  }
  return leadingWs + body.toUpperCase()
}

/**
 * Quick check used by the editor transaction filter: is this line a scene heading?
 */
export function lineIsSceneHeading(line: string): boolean {
  return isSceneHeading(line.trim())
}

/**
 * Quick check: is this line a (completed) character cue?
 */
export function lineIsCharacterCue(line: string): boolean {
  return isCharacterCue(line.trim())
}

// Re-export for convenience in tests
export { isCharacterCue, isSceneHeading, stripForcePrefix }
