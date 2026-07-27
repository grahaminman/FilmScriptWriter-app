/**
 * Fountain editor syntax highlighting via line decorations + CSS variables.
 *
 * CodeMirror StreamLanguage + HighlightStyle was not producing distinct colours
 * in the Electron build (everything appeared one cool/blue foreground except
 * comments). Line decorations with explicit classes are reliable and pair
 * cleanly with user-customisable --syn-* CSS variables.
 */

import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate
} from '@codemirror/view'
import { RangeSetBuilder, type Extension } from '@codemirror/state'
import { isCharacterCue, isSceneHeading, isTransition } from '../../shared/fountain/parser'

export type FountainLineKind =
  | 'scene'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'transition'
  | 'lyrics'
  | 'centered'
  | 'section'
  | 'note'
  | 'boneyard'
  | 'meta'
  | 'pagebreak'
  | 'empty'

const SCENE_RE =
  /^(INT\.|EXT\.|EST\.|I\/E\.|INT\/EXT\.|INT\.\/EXT\.)\s+/i
const CENTERED_RE = /^>\s*.+\s*<\s*$/
const SECTION_RE = /^#{1,6}\s+/
const SYNOPSIS_RE = /^=(?!=)\s*/
const PAGE_BREAK_RE = /^={3,}\s*$/
const NOTE_LINE_RE = /^\[\[.*\]\]\s*$/
const TITLE_KEY_RE = /^[A-Za-z][A-Za-z0-9\s]*:\s*/

/**
 * Classify every line in the document (Fountain line rules, order matters).
 */
export function classifyDocumentLines(doc: {
  lines: number
  line: (n: number) => { text: string }
}): FountainLineKind[] {
  const kinds: FountainLineKind[] = new Array(doc.lines + 1)
  let inBoneyard = false
  let inTitlePage = false
  let titleChecked = false
  let inDialogue = false
  let prevBlank = true

  for (let n = 1; n <= doc.lines; n++) {
    const raw = doc.line(n).text
    const trimmed = raw.trim()

    if (inBoneyard) {
      kinds[n] = 'boneyard'
      if (/\*\//.test(raw)) inBoneyard = false
      prevBlank = false
      inDialogue = false
      continue
    }

    if (trimmed.startsWith('/*')) {
      kinds[n] = 'boneyard'
      if (!(trimmed.endsWith('*/') && trimmed.length > 3)) {
        inBoneyard = true
      }
      prevBlank = false
      inDialogue = false
      continue
    }

    if (trimmed === '') {
      kinds[n] = 'empty'
      prevBlank = true
      inDialogue = false
      if (inTitlePage) inTitlePage = false
      continue
    }

    if (!titleChecked) {
      titleChecked = true
      if (TITLE_KEY_RE.test(trimmed)) {
        inTitlePage = true
      }
    }

    if (inTitlePage) {
      kinds[n] = 'meta'
      prevBlank = false
      continue
    }

    if (PAGE_BREAK_RE.test(trimmed)) {
      kinds[n] = 'pagebreak'
      prevBlank = true
      inDialogue = false
      continue
    }

    if (NOTE_LINE_RE.test(trimmed)) {
      kinds[n] = 'note'
      prevBlank = false
      continue
    }

    if (SECTION_RE.test(trimmed) || SYNOPSIS_RE.test(trimmed)) {
      kinds[n] = 'section'
      prevBlank = false
      inDialogue = false
      continue
    }

    if (CENTERED_RE.test(trimmed)) {
      kinds[n] = 'centered'
      prevBlank = false
      inDialogue = false
      continue
    }

    if (trimmed.startsWith('~')) {
      kinds[n] = 'lyrics'
      prevBlank = false
      continue
    }

    if (trimmed.startsWith('!')) {
      kinds[n] = 'action'
      prevBlank = false
      inDialogue = false
      continue
    }

    if (
      (trimmed.startsWith('.') && !trimmed.startsWith('..')) ||
      (prevBlank && (isSceneHeading(trimmed) || SCENE_RE.test(trimmed)))
    ) {
      kinds[n] = 'scene'
      prevBlank = false
      inDialogue = false
      continue
    }

    if (
      (trimmed.startsWith('>') && !trimmed.endsWith('<')) ||
      (prevBlank && isTransition(trimmed))
    ) {
      kinds[n] = 'transition'
      prevBlank = false
      inDialogue = false
      continue
    }

    if (inDialogue) {
      if (trimmed.startsWith('(') && trimmed.endsWith(')')) {
        kinds[n] = 'parenthetical'
      } else {
        kinds[n] = 'dialogue'
      }
      prevBlank = false
      continue
    }

    if (prevBlank && isCharacterCue(trimmed)) {
      kinds[n] = 'character'
      inDialogue = true
      prevBlank = false
      continue
    }

    kinds[n] = 'action'
    prevBlank = false
    inDialogue = false
  }

  return kinds
}

function buildLineDeco(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>()
  const kinds = classifyDocumentLines(view.state.doc)
  for (let n = 1; n <= view.state.doc.lines; n++) {
    const kind = kinds[n]
    if (!kind || kind === 'empty') continue
    const line = view.state.doc.line(n)
    builder.add(
      line.from,
      line.from,
      Decoration.line({ class: `cm-fountain-${kind}` })
    )
  }
  return builder.finish()
}

/**
 * Line-decoration highlighter + base CSS that reads --syn-* variables.
 */
export function fountainLineHighlighter(): Extension {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet
        constructor(view: EditorView) {
          this.decorations = buildLineDeco(view)
        }
        update(update: ViewUpdate): void {
          if (update.docChanged || update.viewportChanged) {
            this.decorations = buildLineDeco(update.view)
          }
        }
      },
      { decorations: (v) => v.decorations }
    ),
    // Colours come from CSS variables set by applySyntaxPalette()
    EditorView.theme({
      '.cm-fountain-scene': {
        color: 'var(--syn-scene)',
        fontWeight: '700'
      },
      '.cm-fountain-action': {
        color: 'var(--syn-action)'
      },
      '.cm-fountain-character': {
        color: 'var(--syn-character)',
        fontWeight: '700'
      },
      '.cm-fountain-parenthetical': {
        color: 'var(--syn-parenthetical)',
        fontStyle: 'italic'
      },
      '.cm-fountain-dialogue': {
        color: 'var(--syn-dialogue)'
      },
      '.cm-fountain-transition': {
        color: 'var(--syn-transition)',
        fontWeight: '600'
      },
      '.cm-fountain-lyrics': {
        color: 'var(--syn-lyrics)',
        fontStyle: 'italic'
      },
      '.cm-fountain-centered': {
        color: 'var(--syn-centered)',
        fontWeight: '600'
      },
      '.cm-fountain-section': {
        color: 'var(--syn-section)',
        fontStyle: 'italic'
      },
      '.cm-fountain-note': {
        color: 'var(--syn-note)',
        fontStyle: 'italic'
      },
      '.cm-fountain-boneyard': {
        color: 'var(--syn-boneyard)',
        fontStyle: 'italic',
        opacity: '0.85'
      },
      '.cm-fountain-meta': {
        color: 'var(--syn-meta)',
        fontWeight: '600'
      },
      '.cm-fountain-pagebreak': {
        color: 'var(--syn-pagebreak)',
        fontWeight: '700'
      }
    })
  ]
}
