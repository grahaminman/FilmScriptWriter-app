/**
 * Fountain format parser.
 *
 * Implements a practical subset of the Fountain spec sufficient for a
 * professional screenplay editor:
 *   https://fountain.io/syntax
 *
 * Responsibilities:
 *  - Split title page from body
 *  - Classify each body line into a typed element
 *  - Strip common inline markup for plain-text export paths
 *  - Preserve line indices for editor features
 *
 * The parser is intentionally pure (no DOM / Electron deps) so unit tests
 * and both main/renderer processes can share it.
 */

import type {
  FountainDocument,
  FountainElement,
  ElementType,
  TitlePage
} from './types'

/** Scene heading patterns: INT./EXT./EST./I/E./INT/EXT. (case-insensitive). */
const SCENE_HEADING_RE =
  /^(INT\.|EXT\.|EST\.|I\/E\.|INT\/EXT\.|INT\.\/EXT\.)\s+/i

/** Transition lines end with TO: (e.g. CUT TO:) or are forced with >. */
const TRANSITION_RE = /^[A-Z0-9\s.]{2,}TO:$/

/** Centered text: >text< */
const CENTERED_RE = /^>\s*(.+?)\s*<\s*$/

/** Section headings start with one or more #. */
const SECTION_RE = /^(#{1,6})\s+(.*)$/

/** Synopsis lines start with = (but not === page break). */
const SYNOPSIS_RE = /^=(?!=)\s*(.*)$/

/** Forced page break. */
const PAGE_BREAK_RE = /^={3,}\s*$/

/** Note: [[note text]] */
const NOTE_RE = /^\[\[(.*)\]\]\s*$/

/** Boneyard start / end. */
const BONEYARD_START_RE = /^\/\*/
const BONEYARD_END_RE = /\*\/\s*$/

/** Character cue: ALL CAPS (allowing parenthetical extensions and ^ dual). */
const CHARACTER_CUE_RE =
  /^([A-Z0-9][A-Z0-9\s.\-']*?)(\s*\(.*\))?\s*(\^)?\s*$/

/**
 * Returns true when a line looks like a character cue.
 * Fountain requires character names to be uppercase and preceded by a blank line
 * (enforced by the caller via context).
 */
export function isCharacterCue(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  // Forced character with @
  if (trimmed.startsWith('@')) return true
  // Must be predominantly uppercase letters (allow spaces, digits, .-' and trailing (CONT'D)/^)
  if (!CHARACTER_CUE_RE.test(trimmed)) return false
  // Reject pure scene-heading-looking lines
  if (SCENE_HEADING_RE.test(trimmed)) return false
  // Reject transitions
  if (TRANSITION_RE.test(trimmed)) return false
  // Must contain at least one letter
  if (!/[A-Z]/.test(trimmed)) return false
  // Single-word lowercase rejection already covered by regex
  return true
}

/** Returns true when a line is a scene heading (natural or forced with `.`). */
export function isSceneHeading(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  if (trimmed.startsWith('.') && !trimmed.startsWith('..')) return true
  return SCENE_HEADING_RE.test(trimmed)
}

/** Returns true when a line is a transition. */
export function isTransition(line: string): boolean {
  const trimmed = line.trim()
  if (!trimmed) return false
  // Forced transition: >TEXT (but not >text< which is centered)
  if (trimmed.startsWith('>') && !trimmed.endsWith('<')) {
    return true
  }
  return TRANSITION_RE.test(trimmed)
}

/**
 * Strip common Fountain force prefixes and dual-dialogue marker for display.
 */
export function stripForcePrefix(type: ElementType, text: string): string {
  let t = text
  switch (type) {
    case 'scene_heading':
      if (t.startsWith('.') && !t.startsWith('..')) t = t.slice(1)
      // Scene numbers: trailing #1# etc. kept as-is for now
      break
    case 'character':
      if (t.startsWith('@')) t = t.slice(1)
      // Remove dual-dialogue caret
      t = t.replace(/\s*\^\s*$/, '')
      break
    case 'action':
      if (t.startsWith('!')) t = t.slice(1)
      break
    case 'transition':
      if (t.startsWith('>')) t = t.slice(1).trimStart()
      break
    case 'centered': {
      const m = t.match(CENTERED_RE)
      if (m) t = m[1]
      break
    }
    case 'lyrics':
      if (t.startsWith('~')) t = t.slice(1)
      break
    default:
      break
  }
  return t.trimEnd()
}

/**
 * Parse optional Fountain title page (key: value pairs ending at first blank line).
 */
function parseTitlePage(lines: string[]): {
  titlePage: TitlePage
  bodyStart: number
} {
  const titlePage: TitlePage = { extra: {} }
  if (lines.length === 0) {
    return { titlePage, bodyStart: 0 }
  }

  // Title page must start with "Key: value" on the first non-empty line
  const first = lines[0]?.trim() ?? ''
  if (!/^[A-Za-z][A-Za-z0-9\s]*:\s*/.test(first)) {
    return { titlePage, bodyStart: 0 }
  }

  let i = 0
  let currentKey: string | null = null
  let currentValue: string[] = []

  const flush = (): void => {
    if (!currentKey) return
    const value = currentValue.join('\n').trim()
    const keyLower = currentKey.toLowerCase()
    switch (keyLower) {
      case 'title':
        titlePage.title = value
        break
      case 'credit':
        titlePage.credit = value
        break
      case 'author':
      case 'authors':
        titlePage.author = value
        break
      case 'source':
        titlePage.source = value
        break
      case 'draft date':
        titlePage.draftDate = value
        break
      case 'contact':
        titlePage.contact = value
        break
      case 'copyright':
        titlePage.copyright = value
        break
      case 'notes':
        titlePage.notes = value
        break
      default:
        titlePage.extra[currentKey] = value
        break
    }
    currentKey = null
    currentValue = []
  }

  while (i < lines.length) {
    const line = lines[i]
    // Blank line ends the title page
    if (line.trim() === '') {
      flush()
      i += 1
      break
    }
    const keyMatch = line.match(/^([A-Za-z][A-Za-z0-9\s]*):\s*(.*)$/)
    if (keyMatch) {
      flush()
      currentKey = keyMatch[1].trim()
      currentValue = [keyMatch[2]]
    } else if (currentKey) {
      // Multi-line value
      currentValue.push(line)
    } else {
      // Not a title page after all
      return { titlePage: { extra: {} }, bodyStart: 0 }
    }
    i += 1
  }
  flush()
  return { titlePage, bodyStart: i }
}

/**
 * Parse a full Fountain document string into structured elements.
 */
export function parseFountain(source: string): FountainDocument {
  // Normalise line endings
  const raw = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  // Truly empty source → no elements (avoid a phantom empty line from split(''))
  if (raw.length === 0) {
    return { titlePage: { extra: {} }, elements: [], raw }
  }
  const lines = raw.split('\n')
  const { titlePage, bodyStart } = parseTitlePage(lines)
  const elements: FountainElement[] = []

  let inBoneyard = false
  let inDialogueBlock = false
  let previousWasBlank = true // start of body acts like a blank line

  for (let i = bodyStart; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Boneyard (/* ... */) — multiline comments ignored in output
    if (inBoneyard) {
      if (BONEYARD_END_RE.test(line)) {
        inBoneyard = false
      }
      elements.push({
        type: 'boneyard',
        text: line,
        lineIndex: i
      })
      previousWasBlank = false
      continue
    }
    if (BONEYARD_START_RE.test(trimmed)) {
      inBoneyard = !BONEYARD_END_RE.test(trimmed) || trimmed === '/*'
      // Single-line boneyard /* ... */
      if (trimmed.startsWith('/*') && trimmed.endsWith('*/') && trimmed.length > 3) {
        inBoneyard = false
      }
      elements.push({ type: 'boneyard', text: line, lineIndex: i })
      previousWasBlank = false
      continue
    }

    // Empty line
    if (trimmed === '') {
      elements.push({ type: 'empty', text: '', lineIndex: i })
      previousWasBlank = true
      inDialogueBlock = false
      continue
    }

    // Page break
    if (PAGE_BREAK_RE.test(trimmed)) {
      elements.push({ type: 'page_break', text: trimmed, lineIndex: i })
      previousWasBlank = true
      inDialogueBlock = false
      continue
    }

    // Notes
    if (NOTE_RE.test(trimmed)) {
      elements.push({
        type: 'note',
        text: trimmed.replace(NOTE_RE, '$1'),
        lineIndex: i
      })
      previousWasBlank = false
      continue
    }

    // Section
    const sectionMatch = trimmed.match(SECTION_RE)
    if (sectionMatch) {
      elements.push({
        type: 'section',
        text: sectionMatch[2],
        lineIndex: i
      })
      previousWasBlank = false
      inDialogueBlock = false
      continue
    }

    // Synopsis
    const synopsisMatch = trimmed.match(SYNOPSIS_RE)
    if (synopsisMatch) {
      elements.push({
        type: 'synopsis',
        text: synopsisMatch[1],
        lineIndex: i
      })
      previousWasBlank = false
      continue
    }

    // Centered
    if (CENTERED_RE.test(trimmed)) {
      elements.push({
        type: 'centered',
        text: stripForcePrefix('centered', trimmed),
        lineIndex: i,
        forced: true
      })
      previousWasBlank = false
      inDialogueBlock = false
      continue
    }

    // Lyrics
    if (trimmed.startsWith('~')) {
      elements.push({
        type: 'lyrics',
        text: stripForcePrefix('lyrics', trimmed),
        lineIndex: i,
        forced: true
      })
      previousWasBlank = false
      continue
    }

    // Forced action
    if (trimmed.startsWith('!')) {
      elements.push({
        type: 'action',
        text: stripForcePrefix('action', trimmed),
        lineIndex: i,
        forced: true
      })
      previousWasBlank = false
      inDialogueBlock = false
      continue
    }

    // Forced scene heading
    if (trimmed.startsWith('.') && !trimmed.startsWith('..')) {
      elements.push({
        type: 'scene_heading',
        text: stripForcePrefix('scene_heading', trimmed).toUpperCase(),
        lineIndex: i,
        forced: true
      })
      previousWasBlank = false
      inDialogueBlock = false
      continue
    }

    // Scene heading (natural)
    if (previousWasBlank && SCENE_HEADING_RE.test(trimmed)) {
      elements.push({
        type: 'scene_heading',
        text: trimmed.toUpperCase(),
        lineIndex: i
      })
      previousWasBlank = false
      inDialogueBlock = false
      continue
    }

    // Transition
    if (
      (previousWasBlank && TRANSITION_RE.test(trimmed)) ||
      (trimmed.startsWith('>') && !trimmed.endsWith('<'))
    ) {
      elements.push({
        type: 'transition',
        text: stripForcePrefix('transition', trimmed).toUpperCase(),
        lineIndex: i,
        forced: trimmed.startsWith('>')
      })
      previousWasBlank = false
      inDialogueBlock = false
      continue
    }

    // Inside a dialogue block: parenthetical or dialogue
    if (inDialogueBlock) {
      if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
        elements.push({
          type: 'parenthetical',
          text: trimmed,
          lineIndex: i
        })
      } else {
        elements.push({
          type: 'dialogue',
          text: line.replace(/^\t+/, ''), // dialogue may be indented in some files
          lineIndex: i
        })
      }
      previousWasBlank = false
      continue
    }

    // Character cue (must follow a blank line)
    if (previousWasBlank && isCharacterCue(trimmed)) {
      const dual = /\^\s*$/.test(trimmed)
      const name = stripForcePrefix('character', trimmed).toUpperCase()
      elements.push({
        type: 'character',
        text: name,
        lineIndex: i,
        dual,
        forced: trimmed.startsWith('@')
      })
      inDialogueBlock = true
      previousWasBlank = false
      continue
    }

    // Default: action
    elements.push({
      type: 'action',
      text: line,
      lineIndex: i
    })
    previousWasBlank = false
    inDialogueBlock = false
  }

  return { titlePage, elements, raw }
}

/**
 * Extract plain text of the body suitable for word counting.
 * Excludes notes, boneyard, section, synopsis, empty, page_break.
 */
export function bodyTextForWordCount(doc: FountainDocument): string {
  const skip = new Set<ElementType>([
    'note',
    'boneyard',
    'section',
    'synopsis',
    'empty',
    'page_break',
    'title_page_key'
  ])
  return doc.elements
    .filter((e) => !skip.has(e.type))
    .map((e) => e.text)
    .join(' ')
}

/**
 * Count words in a string using a simple Unicode-aware split.
 */
export function countWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  // Split on whitespace; filter empties
  return trimmed.split(/\s+/).filter(Boolean).length
}
