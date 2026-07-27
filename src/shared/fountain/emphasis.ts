/**
 * Fountain inline emphasis (fountain.io — Markdown-style, with _ for underline).
 *
 * Spec: *italic* **bold** ***bold italic*** _underline_
 * Escapes: \* \_ \** etc. (backslash)
 * Emphasis does not span line breaks.
 *
 * Used by live preview (HTML) and PDF export (styled runs).
 */

export type EmphasisStyle = {
  italic?: boolean
  bold?: boolean
  underline?: boolean
}

export type EmphasisRun = {
  text: string
  style: EmphasisStyle
}

/**
 * Strip emphasis markers (and escapes) for plain-text / word-count use.
 * Does not interpret layout — only removes Fountain emphasis syntax.
 */
export function stripEmphasis(text: string): string {
  return emphasisToRuns(text)
    .map((r) => r.text)
    .join('')
}

/**
 * Remove inline notes `[[...]]` (including multi-line content without empty lines).
 * Fountain notes are not printed.
 */
export function stripInlineNotes(text: string): string {
  // Non-greedy; notes do not nest in the common case
  return text.replace(/\[\[([\s\S]*?)\]\]/g, '')
}

/**
 * Prepare element text for print: strip notes, keep emphasis structure via runs.
 */
export function preparePrintText(text: string): string {
  return stripInlineNotes(text)
}

/**
 * Convert a single line of Fountain text into styled runs.
 * Processes emphasis markers; leaves other characters as-is.
 */
export function emphasisToRuns(input: string): EmphasisRun[] {
  const text = stripInlineNotes(input)
  if (!text) return [{ text: '', style: {} }]

  const runs: EmphasisRun[] = []
  let i = 0
  let style: EmphasisStyle = {}
  let buf = ''

  const flush = (): void => {
    if (!buf && runs.length > 0) return
    runs.push({ text: buf, style: { ...style } })
    buf = ''
  }

  const setStyle = (next: EmphasisStyle): void => {
    flush()
    style = next
  }

  while (i < text.length) {
    // Escape: \* \_ \\
    if (text[i] === '\\' && i + 1 < text.length) {
      buf += text[i + 1]
      i += 2
      continue
    }

    // *** bold italic ***
    if (text.startsWith('***', i)) {
      const closing = findClosing(text, i + 3, '***')
      if (closing !== -1) {
        flush()
        const inner = text.slice(i + 3, closing)
        for (const r of emphasisToRuns(inner)) {
          runs.push({
            text: r.text,
            style: {
              bold: true,
              italic: true,
              underline: r.style.underline
            }
          })
        }
        i = closing + 3
        continue
      }
    }

    // ** bold **
    if (text.startsWith('**', i)) {
      const closing = findClosing(text, i + 2, '**')
      if (closing !== -1) {
        flush()
        const inner = text.slice(i + 2, closing)
        for (const r of emphasisToRuns(inner)) {
          runs.push({
            text: r.text,
            style: {
              bold: true,
              italic: r.style.italic,
              underline: r.style.underline
            }
          })
        }
        i = closing + 2
        continue
      }
    }

    // * italic *  (not **)
    if (text[i] === '*' && !text.startsWith('**', i)) {
      const closing = findClosing(text, i + 1, '*')
      if (closing !== -1 && !isSpaceBoundaryFail(text, i, closing)) {
        flush()
        const inner = text.slice(i + 1, closing)
        for (const r of emphasisToRuns(inner)) {
          runs.push({
            text: r.text,
            style: {
              italic: true,
              bold: r.style.bold,
              underline: r.style.underline
            }
          })
        }
        i = closing + 1
        continue
      }
    }

    // _ underline _
    if (text[i] === '_') {
      const closing = findClosing(text, i + 1, '_')
      if (closing !== -1 && !isSpaceBoundaryFail(text, i, closing)) {
        flush()
        const inner = text.slice(i + 1, closing)
        for (const r of emphasisToRuns(inner)) {
          runs.push({
            text: r.text,
            style: {
              underline: true,
              bold: r.style.bold,
              italic: r.style.italic
            }
          })
        }
        i = closing + 1
        continue
      }
    }

    buf += text[i]
    i += 1
  }

  flush()
  // Merge empty-only leading if needed
  return runs.length ? runs : [{ text: '', style: {} }]
}

/**
 * Convert emphasis to safe HTML (markers removed).
 */
export function emphasisToHtml(text: string): string {
  const runs = emphasisToRuns(text)
  return runs
    .map((r) => {
      let s = escapeHtml(r.text)
      if (!s) return ''
      if (r.style.bold) s = `<strong>${s}</strong>`
      if (r.style.italic) s = `<em>${s}</em>`
      if (r.style.underline) s = `<u>${s}</u>`
      return s
    })
    .join('')
}

/**
 * Plain text with markers stripped (for PDF simple path fallback).
 */
export function emphasisToPlain(text: string): string {
  return stripEmphasis(text)
}

function findClosing(text: string, from: number, token: string): number {
  let i = from
  while (i < text.length) {
    if (text[i] === '\\' && i + 1 < text.length) {
      i += 2
      continue
    }
    if (text.startsWith(token, i)) {
      // Empty emphasis ** ** is invalid
      if (i === from) return -1
      return i
    }
    i += 1
  }
  return -1
}

/**
 * fountain.io / Markdown: spaces around emphasis markers matter.
 * Reject open/close if the *inside* is empty or markers are clearly non-emphasis.
 * Spec example: "dialed *69 and then *23" — both * have space left, no italics.
 * We approximate: opening marker must not be followed by space; closing must not be preceded by space.
 */
function isSpaceBoundaryFail(text: string, openIdx: number, closeIdx: number): boolean {
  if (openIdx + 1 < text.length && /\s/.test(text[openIdx + 1])) return true
  if (closeIdx > 0 && /\s/.test(text[closeIdx - 1])) return true
  return false
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
