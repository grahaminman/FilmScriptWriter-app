/**
 * CodeMirror 6 Fountain language support: StreamLanguage highlighter,
 * character autocomplete, and automatic uppercase enforcement for
 * scene headings and character cues.
 */

import {
  StreamLanguage,
  type StringStream,
  LanguageSupport,
  HighlightStyle,
  syntaxHighlighting
} from '@codemirror/language'
import { tags as t } from '@lezer/highlight'
import {
  autocompletion,
  type CompletionContext,
  type CompletionResult
} from '@codemirror/autocomplete'
import {
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  Decoration,
  type DecorationSet
} from '@codemirror/view'
import { EditorState, Transaction, type Extension, RangeSetBuilder } from '@codemirror/state'
import {
  collectCharactersFromSource,
  enforceCharacterUppercase,
  enforceSceneHeadingUppercase,
  filterCharacters,
  getCharacterCuePrefix,
  lineIsCharacterCue,
  lineIsSceneHeading
} from '../../shared/fountain/characters'
import { isSceneHeading, isTransition } from '../../shared/fountain/parser'

/**
 * Line-oriented Fountain stream parser for syntax highlighting.
 *
 * State tracks whether we are inside a dialogue block (after a character cue)
 * and whether the previous line was blank — both needed for correct classification.
 */
interface FountainStreamState {
  inDialogue: boolean
  prevBlank: boolean
  inBoneyard: boolean
  inTitlePage: boolean
  titlePageChecked: boolean
}

const fountainLanguage = StreamLanguage.define<FountainStreamState>({
  name: 'fountain',
  startState(): FountainStreamState {
    return {
      inDialogue: false,
      prevBlank: true,
      inBoneyard: false,
      inTitlePage: false,
      titlePageChecked: false
    }
  },
  token(stream: StringStream, state: FountainStreamState): string | null {
    if (stream.sol()) {
      // Beginning of line classification
    }

    // Boneyard
    if (state.inBoneyard) {
      if (stream.match(/^.*?\*\//)) {
        state.inBoneyard = false
        return 'comment'
      }
      stream.skipToEnd()
      return 'comment'
    }

    if (stream.match(/^\/\*/)) {
      if (!stream.match(/.*?\*\//)) {
        state.inBoneyard = true
      }
      stream.skipToEnd()
      return 'comment'
    }

    // Blank line
    if (stream.match(/^\s*$/)) {
      state.prevBlank = true
      state.inDialogue = false
      // End title page on blank
      if (state.inTitlePage) state.inTitlePage = false
      return null
    }

    // Title page detection on first non-blank content
    if (!state.titlePageChecked) {
      state.titlePageChecked = true
      if (stream.match(/^[A-Za-z][A-Za-z0-9\s]*:\s*/)) {
        state.inTitlePage = true
        stream.skipToEnd()
        return 'meta'
      }
    }
    if (state.inTitlePage) {
      if (stream.match(/^[A-Za-z][A-Za-z0-9\s]*:\s*/)) {
        stream.skipToEnd()
        return 'meta'
      }
      stream.skipToEnd()
      return 'meta'
    }

    // Page break
    if (stream.match(/^={3,}\s*$/)) {
      state.prevBlank = true
      state.inDialogue = false
      return 'processingInstruction'
    }

    // Notes
    if (stream.match(/^\[\[.*\]\]\s*$/)) {
      state.prevBlank = false
      return 'comment'
    }

    // Section
    if (stream.match(/^#{1,6}\s+/)) {
      stream.skipToEnd()
      state.prevBlank = false
      state.inDialogue = false
      return 'heading'
    }

    // Synopsis
    if (stream.match(/^=(?!=)\s*/)) {
      stream.skipToEnd()
      state.prevBlank = false
      return 'quote'
    }

    // Centered
    if (stream.match(/^>.*<\s*$/)) {
      state.prevBlank = false
      state.inDialogue = false
      return 'string'
    }

    // Lyrics
    if (stream.match(/^~/)) {
      stream.skipToEnd()
      state.prevBlank = false
      return 'string'
    }

    // Forced action
    if (stream.match(/^!/)) {
      stream.skipToEnd()
      state.prevBlank = false
      state.inDialogue = false
      return 'contentSeparator'
    }

    // Capture rest of line for classification
    const lineStart = stream.pos
    stream.skipToEnd()
    const line = stream.string.slice(lineStart).trim()

    // Forced / natural scene heading
    if (
      (line.startsWith('.') && !line.startsWith('..')) ||
      (state.prevBlank && isSceneHeading(line))
    ) {
      state.prevBlank = false
      state.inDialogue = false
      return 'keyword' // scene heading
    }

    // Transition
    if (
      (line.startsWith('>') && !line.endsWith('<')) ||
      (state.prevBlank && isTransition(line))
    ) {
      state.prevBlank = false
      state.inDialogue = false
      return 'atom'
    }

    // Dialogue block continuation
    if (state.inDialogue) {
      state.prevBlank = false
      if (line.startsWith('(') && line.endsWith(')')) {
        return 'attribute' // parenthetical
      }
      return 'string' // dialogue
    }

    // Character cue
    if (
      state.prevBlank &&
      (/^@[A-Za-z]/.test(line) ||
        (/^[A-Z0-9][A-Z0-9\s.\-']*(\s*\(.*\))?\s*\^?\s*$/.test(line) &&
          /[A-Z]/.test(line) &&
          !isSceneHeading(line) &&
          !isTransition(line)))
    ) {
      state.prevBlank = false
      state.inDialogue = true
      return 'variableName' // character
    }

    // Default action
    state.prevBlank = false
    state.inDialogue = false
    return 'contentSeparator'
  },
  copyState(s) {
    return { ...s }
  },
  tokenTable: {
    keyword: t.keyword,
    atom: t.atom,
    string: t.string,
    variableName: t.variableName,
    attribute: t.attributeName,
    comment: t.comment,
    meta: t.meta,
    heading: t.heading,
    quote: t.quote,
    processingInstruction: t.processingInstruction,
    contentSeparator: t.contentSeparator
  }
})

/**
 * Character-name autocompletion source.
 * Activates only when the cursor is on a potential cue line.
 */
function characterCompletionSource(context: CompletionContext): CompletionResult | null {
  const prefix = getCharacterCuePrefix(context.state.doc.toString(), context.pos)
  if (prefix === null) return null

  const entries = collectCharactersFromSource(context.state.doc.toString())
  const filtered = filterCharacters(entries, prefix)

  // Always offer matches; also allow incomplete words mid-name
  const from = context.pos - prefix.length

  return {
    from,
    options: filtered.map((e) => ({
      label: e.name,
      type: 'variable',
      boost: e.count,
      detail: e.count > 0 ? `${e.count}×` : undefined,
      apply: e.name
    })),
    // Valid for short typing sequences
    validFor: /^[A-Za-z0-9\s.\-'()]*$/
  }
}

/**
 * Transaction filter that forces scene headings to UPPERCASE as the user types,
 * and character names to UPPERCASE when the user finishes the cue line
 * (Enter / moving off the line).
 */
function uppercaseEnforcer(): Extension {
  return EditorState.transactionFilter.of((tr: Transaction) => {
    if (!tr.docChanged) return tr

    // Detect newline insertions → finalise character cue on the previous line
    let insertedNewline = false
    tr.changes.iterChanges((_fromA, _toA, _fromB, _toB, inserted) => {
      if (inserted.toString().includes('\n')) insertedNewline = true
    })

    const newDoc = tr.newDoc
    const effects: Transaction['effects'] = tr.effects
    const extra: { changes: { from: number; to: number; insert: string }[] } = {
      changes: []
    }

    // For each changed line in the new document, enforce scene heading caps live
    const touchedLines = new Set<number>()
    tr.changes.iterChangedRanges((_fromA, _toA, fromB, toB) => {
      const startLine = newDoc.lineAt(fromB).number
      const endLine = newDoc.lineAt(Math.min(toB, newDoc.length)).number
      for (let n = startLine; n <= endLine; n++) touchedLines.add(n)
    })

    for (const lineNo of touchedLines) {
      if (lineNo < 1 || lineNo > newDoc.lines) continue
      const line = newDoc.line(lineNo)
      const text = line.text

      // Live uppercase for scene headings while typing
      if (lineIsSceneHeading(text) || (text.trimStart().startsWith('.') && text.trim().length > 1)) {
        // Only force if it looks like a scene heading start
        const looksForced = text.trimStart().startsWith('.') && !text.trimStart().startsWith('..')
        const looksNatural =
          /^(INT\.|EXT\.|EST\.|I\/E\.|INT\/EXT\.|INT\.\/EXT\.)/i.test(text.trim())
        if (looksForced || looksNatural) {
          const upper = enforceSceneHeadingUppercase(text)
          if (upper !== text) {
            extra.changes.push({ from: line.from, to: line.to, insert: upper })
          }
        }
      }
    }

    // When user presses Enter, uppercase the completed character cue on the previous line
    if (insertedNewline) {
      const head = tr.selection?.main.head ?? tr.newSelection.main.head
      const lineAfter = newDoc.lineAt(Math.min(head, newDoc.length))
      if (lineAfter.number > 1) {
        const prev = newDoc.line(lineAfter.number - 1)
        const prevText = prev.text
        // Character cue: previous line non-empty, line before that blank (or start)
        const beforePrev =
          prev.number > 1 ? newDoc.line(prev.number - 1).text : ''
        const precededByBlank = prev.number === 1 || beforePrev.trim() === ''
        if (precededByBlank && lineIsCharacterCue(prevText)) {
          const upper = enforceCharacterUppercase(prevText)
          if (upper !== prevText) {
            // Avoid duplicate change if already queued
            if (!extra.changes.some((c) => c.from === prev.from)) {
              extra.changes.push({ from: prev.from, to: prev.to, insert: upper })
            }
          }
        }
      }
    }

    if (extra.changes.length === 0) return tr

    // Apply as sequential changes on the already-modified doc
    return [tr, { changes: extra.changes, sequential: true }]
  })
}

/**
 * Proper CodeMirror 6 HighlightStyle for Fountain tokens.
 * StreamLanguage maps token names → lezer tags via tokenTable; this style
 * paints those tags. (Plain CSS `.tok-*` selectors do not apply in CM6.)
 */
export function fountainHighlightStyle(dark: boolean): Extension {
  const scene = dark ? '#6cb6ff' : '#0550ae'
  const character = dark ? '#ff7b72' : '#cf222e'
  const dialogue = dark ? '#e6edf3' : '#1f2328'
  const parenthetical = dark ? '#d2a8ff' : '#8250df'
  const transition = dark ? '#ffa657' : '#bc4c00'
  const action = dark ? '#c9d1d9' : '#424a53'
  const comment = dark ? '#8b949e' : '#656d76'
  const meta = dark ? '#79c0ff' : '#0550ae'

  const style = HighlightStyle.define([
    { tag: t.keyword, color: scene, fontWeight: '700' },
    { tag: t.variableName, color: character, fontWeight: '700' },
    { tag: t.string, color: dialogue },
    { tag: t.attributeName, color: parenthetical, fontStyle: 'italic' },
    { tag: t.atom, color: transition, fontWeight: '600' },
    { tag: t.contentSeparator, color: action },
    { tag: t.comment, color: comment, fontStyle: 'italic' },
    { tag: t.meta, color: meta, fontWeight: '600' },
    { tag: t.heading, color: scene, fontWeight: '700' },
    { tag: t.quote, color: comment, fontStyle: 'italic' },
    { tag: t.processingInstruction, color: transition, fontWeight: '600' }
  ])

  return syntaxHighlighting(style)
}

/** @deprecated Use fountainHighlightStyle — kept as alias for older imports. */
export function fountainHighlightTheme(dark: boolean): Extension {
  return fountainHighlightStyle(dark)
}

/**
 * Full Fountain language support package for the editor
 * (language + autocomplete + uppercase rules). Highlighting is separate
 * so it can be toggled without tearing down the language.
 */
export function fountain(): Extension {
  return [
    new LanguageSupport(fountainLanguage),
    autocompletion({
      override: [characterCompletionSource],
      activateOnTyping: true,
      maxRenderedOptions: 20
    }),
    uppercaseEnforcer()
  ]
}

/**
 * Optional decorative plugin — reserved for future line-gutter scene markers.
 * Currently returns empty decorations; kept modular for extension.
 */
export function sceneGutterPlugin(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet
      constructor(_view: EditorView) {
        this.decorations = Decoration.none
      }
      update(_update: ViewUpdate): void {
        this.decorations = Decoration.none
      }
    },
    {
      decorations: (v) => v.decorations
    }
  )
}

// Silence unused import if RangeSetBuilder not used yet
void RangeSetBuilder
