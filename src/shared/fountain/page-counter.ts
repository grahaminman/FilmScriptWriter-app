/**
 * Hollywood-standard screenplay pagination.
 *
 * Converts a parsed Fountain document into pages of layout lines using
 * the same measurements as PDF export and the live preview panel.
 *
 * Rules (industry-approximate):
 *  - US Letter, Courier 12, fixed margins (see constants/screenplay.ts)
 *  - Element-specific wrap widths and left indents
 *  - Blank lines from the source are preserved as vertical space
 *    (line returns are part of screenplay formatting)
 *  - Structural spacers still fill in when the source omits a blank that
 *    industry layout expects (e.g. before a character cue)
 *  - Explicit Fountain page breaks (`===`) force a new page
 *  - Empty documents still report 1 page (title/blank page)
 */

import {
  ACTION_CHARS_PER_LINE,
  CHARACTER_CHARS_PER_LINE,
  DIALOGUE_CHARS_PER_LINE,
  LINES_PER_PAGE,
  PARENTHETICAL_CHARS_PER_LINE
} from '../constants/screenplay'
import {
  bodyTextForWordCount,
  countWords,
  parseFountain
} from './parser'
import { emphasisToPlain, preparePrintText } from './emphasis'
import type {
  FountainDocument,
  FountainElement,
  LayoutLine,
  PaginationResult,
  ScreenplayPage,
  ElementType
} from './types'

/**
 * Estimate how many layout lines a text block occupies when wrapped at
 * `charsPerLine` monospaced characters. Empty text still occupies 1 line
 * if the element is visible.
 *
 * Hard line breaks inside the text (rare in Fountain, but possible) each
 * start a new visual line before soft-wrapping is applied.
 */
export function estimateWrappedLines(
  text: string,
  charsPerLine: number
): number {
  if (charsPerLine <= 0) return 1
  if (!text) return 1

  // Honour hard returns: each segment wraps independently.
  const segments = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  let total = 0
  for (const segment of segments) {
    total += estimateSingleParagraph(segment, charsPerLine)
  }
  return Math.max(1, total)
}

function estimateSingleParagraph(text: string, charsPerLine: number): number {
  const raw = text.replace(/[ \t]+/g, ' ').trim()
  if (!raw) return 1

  const words = raw.split(' ')
  let lines = 1
  let col = 0
  for (const word of words) {
    const w = word.length
    if (col === 0) {
      col = w
      if (w > charsPerLine) {
        const extra = Math.ceil(w / charsPerLine) - 1
        lines += extra
        col = w % charsPerLine
      }
      continue
    }
    if (col + 1 + w <= charsPerLine) {
      col += 1 + w
    } else {
      lines += 1
      col = w
      if (w > charsPerLine) {
        const extra = Math.ceil(w / charsPerLine) - 1
        lines += extra
        col = w % charsPerLine
      }
    }
  }
  return Math.max(1, lines)
}

/** Characters-per-line for a given element type. */
export function charsPerLineFor(type: ElementType): number {
  switch (type) {
    case 'dialogue':
    case 'lyrics':
      return DIALOGUE_CHARS_PER_LINE
    case 'parenthetical':
      return PARENTHETICAL_CHARS_PER_LINE
    case 'character':
      return CHARACTER_CHARS_PER_LINE
    case 'scene_heading':
    case 'action':
    case 'transition':
    case 'centered':
    default:
      return ACTION_CHARS_PER_LINE
  }
}

/**
 * True when the last emitted layout item is already a blank spacer line.
 */
function lastIsSpacer(out: LayoutLine[]): boolean {
  if (out.length === 0) return false
  const last = out[out.length - 1]
  return Boolean(last.isSpacer || last.type === 'empty')
}

/**
 * Expand parsed elements into a flat list of layout lines with spacers.
 *
 * Blank lines in the Fountain source are kept as real vertical space so
 * preview and PDF match the author's line returns. Type-based structural
 * spacers are only added when a blank is missing but industry layout needs one.
 */
export function elementsToLayoutLines(elements: FountainElement[]): LayoutLine[] {
  const out: LayoutLine[] = []
  let prevPrintType: ElementType | null = null

  const pushSpacer = (elementIndex: number, sourceLine?: number): void => {
    // Avoid stacking duplicate blanks (source blank + structural rule).
    if (lastIsSpacer(out)) return
    out.push({
      type: 'empty',
      text: '',
      lineCount: 1,
      elementIndex,
      sourceLine,
      isSpacer: true
    })
  }

  /**
   * Elements that sit tight under the previous line with no blank between
   * them in traditional screenplay layout.
   */
  const isTightFollowOn = (
    prev: ElementType | null,
    next: ElementType
  ): boolean => {
    if (!prev) return false
    // Character → parenthetical / dialogue (no blank)
    if (prev === 'character' && (next === 'parenthetical' || next === 'dialogue' || next === 'lyrics')) {
      return true
    }
    // Parenthetical → dialogue
    if (prev === 'parenthetical' && (next === 'dialogue' || next === 'lyrics' || next === 'parenthetical')) {
      return true
    }
    // Dialogue → dialogue (continued lines)
    if (prev === 'dialogue' && (next === 'dialogue' || next === 'lyrics' || next === 'parenthetical')) {
      return true
    }
    // Lyrics continue
    if (prev === 'lyrics' && next === 'lyrics') return true
    // Consecutive action/scene lines without a source blank stay tight
    // (Fountain hard-wraps long action across lines)
    if (prev === 'action' && next === 'action') return true
    if (prev === 'scene_heading' && next === 'action') return true
    return false
  }

  /**
   * When the author did not leave a blank line, still insert one for
   * industry-standard gaps (before character cues, transitions, new scenes…).
   */
  const needsStructuralSpacer = (
    prev: ElementType | null,
    next: ElementType
  ): boolean => {
    if (!prev || prev === 'page_break') return false
    if (isTightFollowOn(prev, next)) return false
    if (next === 'scene_heading') return true
    if (next === 'character') return true
    if (next === 'transition') return true
    if (next === 'centered') return true
    // After a dialogue block, following action needs a blank
    if (
      next === 'action' &&
      (prev === 'dialogue' || prev === 'parenthetical' || prev === 'character' || prev === 'lyrics')
    ) {
      return true
    }
    // After transition, next content gets a blank
    if (prev === 'transition') return true
    return false
  }

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i]

    // Skip non-print elements (they do not consume page lines)
    if (
      el.type === 'note' ||
      el.type === 'boneyard' ||
      el.type === 'section' ||
      el.type === 'synopsis' ||
      el.type === 'title_page_key'
    ) {
      continue
    }

    // Preserve author line returns: each empty source line → one blank line.
    // Consecutive empties collapse to a single blank so double-Enter in the
    // editor (common when ending a block) does not create huge gaps, while a
    // single return between blocks is always visible.
    if (el.type === 'empty') {
      // Only emit if there is already printable content on this page stream
      // and we are not at the very start (leading blanks are ignored).
      if (out.length > 0 && !lastIsSpacer(out)) {
        pushSpacer(i, el.lineIndex)
      }
      // Do not change prevPrintType — the blank is spacing, not content.
      continue
    }

    if (el.type === 'page_break') {
      out.push({
        type: 'page_break',
        text: '',
        lineCount: 0,
        elementIndex: i,
        sourceLine: el.lineIndex
      })
      prevPrintType = 'page_break'
      continue
    }

    // Structural blank when source omitted one that layout still needs
    if (
      out.length > 0 &&
      prevPrintType &&
      needsStructuralSpacer(prevPrintType, el.type)
    ) {
      pushSpacer(i, el.lineIndex)
    }

    const cpl = charsPerLineFor(el.type)
    // Print text: strip [[notes]]; keep *emphasis* markers for the renderer
    const printText = preparePrintText(el.text)
    const plainForWrap = emphasisToPlain(printText)
    const lineCount = estimateWrappedLines(plainForWrap, cpl)
    out.push({
      type: el.type,
      text: printText,
      lineCount,
      elementIndex: i,
      sourceLine: el.lineIndex,
      forced: el.forced
    })
    prevPrintType = el.type
  }

  // Pair dual-dialogue blocks (second character ends with ^ per fountain.io)
  assignDualDialogueColumns(out, elements)

  return out
}

/**
 * Mark layout lines that form dual dialogue so preview/PDF can place columns.
 * Fountain: the second character cue ends with `^` (parser sets dual: true).
 */
function assignDualDialogueColumns(
  lines: LayoutLine[],
  elements: FountainElement[]
): void {
  let dualGroup = 0
  let leftStart = -1
  let leftEnd = -1

  const isDialogueFamily = (t: ElementType): boolean =>
    t === 'character' ||
    t === 'parenthetical' ||
    t === 'dialogue' ||
    t === 'lyrics'

  /** Extend from a character line through its parentheticals/dialogue (not across spacers). */
  const blockEndFrom = (charIdx: number): number => {
    let end = charIdx
    for (let j = charIdx + 1; j < lines.length; j++) {
      const L = lines[j]
      if (L.isSpacer || L.type === 'empty' || L.type === 'page_break') break
      if (
        L.type === 'parenthetical' ||
        L.type === 'dialogue' ||
        L.type === 'lyrics'
      ) {
        end = j
        continue
      }
      break
    }
    return end
  }

  const markRange = (
    from: number,
    to: number,
    col: 'left' | 'right',
    group: number
  ): void => {
    for (let j = from; j <= to; j++) {
      const L = lines[j]
      if (L.isSpacer || L.type === 'empty' || L.type === 'page_break') continue
      if (isDialogueFamily(L.type)) {
        L.dualColumn = col
        L.dualGroup = group
      }
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.isSpacer || line.type === 'page_break' || line.type === 'empty') {
      continue
    }

    const el = elements[line.elementIndex]

    if (line.type === 'character' && el?.dual && leftStart >= 0) {
      dualGroup += 1
      markRange(leftStart, leftEnd, 'left', dualGroup)
      const rightEnd = blockEndFrom(i)
      markRange(i, rightEnd, 'right', dualGroup)
      leftStart = -1
      leftEnd = -1
      i = rightEnd
      continue
    }

    if (line.type === 'character' && !el?.dual) {
      leftStart = i
      leftEnd = blockEndFrom(i)
      continue
    }

    if (
      leftStart >= 0 &&
      !isDialogueFamily(line.type)
    ) {
      leftStart = -1
      leftEnd = -1
    }
  }
}

/**
 * Pack layout lines into pages of at most `LINES_PER_PAGE` body lines.
 */
export function paginateLayoutLines(
  lines: LayoutLine[],
  linesPerPage: number = LINES_PER_PAGE
): ScreenplayPage[] {
  const pages: ScreenplayPage[] = []
  let current: LayoutLine[] = []
  let used = 0

  const flush = (): void => {
    pages.push({
      pageNumber: pages.length + 1,
      lines: current
    })
    current = []
    used = 0
  }

  for (const line of lines) {
    if (line.type === 'page_break') {
      // Always start a new page at an explicit break
      if (current.length > 0 || pages.length === 0) flush()
      else flush()
      continue
    }

    const need = Math.max(1, line.lineCount)
    if (used > 0 && used + need > linesPerPage) {
      flush()
    }

    // If a single block is longer than a page, still place it (avoids loops).
    current.push(line)
    used += need

    if (used >= linesPerPage) {
      flush()
    }
  }

  if (current.length > 0 || pages.length === 0) {
    flush()
  }

  pages.forEach((p, idx) => {
    p.pageNumber = idx + 1
  })

  return pages
}

/**
 * Full pagination pipeline from a parsed document.
 */
export function paginateDocument(doc: FountainDocument): PaginationResult {
  const layout = elementsToLayoutLines(doc.elements)
  const pages = paginateLayoutLines(layout)
  const wordCount = countWords(bodyTextForWordCount(doc))
  return {
    pages,
    pageCount: Math.max(1, pages.length),
    wordCount
  }
}

/**
 * Full pagination pipeline from raw Fountain source.
 */
export function paginateSource(source: string): PaginationResult {
  return paginateDocument(parseFountain(source))
}

/**
 * Convenience: just the Hollywood page count.
 */
export function countPages(source: string): number {
  return paginateSource(source).pageCount
}
