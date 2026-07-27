/**
 * Factory for the CodeMirror 6 screenplay editor instance.
 *
 * Supports dynamic font size, syntax highlighting toggle, typewriter mode
 * (caret stays vertically centred), and find / find-replace panels.
 */

import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  placeholder,
  ViewPlugin,
  type ViewUpdate
} from '@codemirror/view'
import { EditorState, Compartment, type Extension } from '@codemirror/state'
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab
} from '@codemirror/commands'
import {
  searchKeymap,
  openSearchPanel,
  highlightSelectionMatches
} from '@codemirror/search'
import { fountain } from './fountain-language'
import { fountainLineHighlighter } from './fountain-line-highlighter'
import { smartSearch } from './smart-search'
import { t, type MessageKey } from '../../shared/i18n/locales'
import {
  FONT_SIZE_DEFAULT,
  type LocaleCode
} from '../../shared/constants/screenplay'

export interface EditorHandle {
  view: EditorView
  getValue: () => string
  setValue: (text: string) => void
  focus: () => void
  setTheme: (dark: boolean) => void
  setLocale: (locale: LocaleCode) => void
  setFontSize: (px: number) => void
  setSyntaxHighlighting: (enabled: boolean) => void
  setTypewriterMode: (enabled: boolean) => void
  openFind: () => void
  openFindReplace: () => void
  getCursorLine: () => number
  onCursorLineChange: (cb: (line: number) => void) => () => void
  destroy: () => void
}

// highlightComp reuses compartment for line highlighter on/off

export interface CreateEditorOptions {
  parent: HTMLElement
  initialDoc?: string
  dark?: boolean
  locale?: LocaleCode
  fontSize?: number
  syntaxHighlighting?: boolean
  typewriterMode?: boolean
  onChange?: (text: string) => void
  onDirty?: (dirty: boolean) => void
  onCursorLine?: (line: number) => void
}

/**
 * Create a fully configured Fountain editor.
 */
export function createEditor(options: CreateEditorOptions): EditorHandle {
  const themeComp = new Compartment()
  const placeholderComp = new Compartment()
  const fontComp = new Compartment()
  const highlightComp = new Compartment()
  const typewriterComp = new Compartment()

  let locale: LocaleCode = options.locale ?? 'en_GB'
  let dark = options.dark ?? true
  let fontSize = options.fontSize ?? FONT_SIZE_DEFAULT
  let syntaxOn = options.syntaxHighlighting !== false
  let typewriterOn = options.typewriterMode === true

  const cursorListeners = new Set<(line: number) => void>()

  const notifyChange = (text: string): void => {
    options.onChange?.(text)
    options.onDirty?.(true)
  }

  const state = EditorState.create({
    doc: options.initialDoc ?? '',
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      fountain(),
      smartSearch(),
      highlightSelectionMatches(),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        indentWithTab
      ]),
      EditorView.lineWrapping,
      themeComp.of([]),
      fontComp.of(fontSizeTheme(fontSize)),
      // Line decorations + CSS vars — reliable per-element colours
      highlightComp.of(syntaxOn ? fountainLineHighlighter() : []),
      typewriterComp.of(typewriterOn ? typewriterExtension() : []),
      placeholderComp.of(
        placeholder(t(locale, 'editor.placeholder' as MessageKey))
      ),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          notifyChange(update.state.doc.toString())
        }
        if (update.selectionSet || update.docChanged) {
          const line = update.state.doc.lineAt(update.state.selection.main.head)
            .number
          options.onCursorLine?.(line)
          for (const cb of cursorListeners) cb(line)
        }
      }),
      baseEditorChrome()
    ]
  })

  const view = new EditorView({
    state,
    parent: options.parent
  })

  options.parent.dataset.editorTheme = dark ? 'dark' : 'light'

  return {
    view,
    getValue: () => view.state.doc.toString(),
    setValue: (text: string) => {
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: text }
      })
    },
    focus: () => view.focus(),
    setTheme: (isDark: boolean) => {
      dark = isDark
      options.parent.dataset.editorTheme = isDark ? 'dark' : 'light'
      // Palette is CSS-variable based (shared light/dark); no reconfigure needed
    },
    setLocale: (next: LocaleCode) => {
      locale = next
      view.dispatch({
        effects: placeholderComp.reconfigure(
          placeholder(t(locale, 'editor.placeholder' as MessageKey))
        )
      })
    },
    setFontSize: (px: number) => {
      fontSize = px
      view.dispatch({
        effects: fontComp.reconfigure(fontSizeTheme(px))
      })
    },
    setSyntaxHighlighting: (enabled: boolean) => {
      syntaxOn = enabled
      view.dispatch({
        effects: highlightComp.reconfigure(
          enabled ? fountainLineHighlighter() : []
        )
      })
    },
    setTypewriterMode: (enabled: boolean) => {
      typewriterOn = enabled
      view.dispatch({
        effects: typewriterComp.reconfigure(
          enabled ? typewriterExtension() : []
        )
      })
      // Apply immediately so the caret centres on toggle
      if (enabled) {
        centerCursor(view)
      }
    },
    openFind: () => {
      openSearchPanel(view)
    },
    openFindReplace: () => {
      // CodeMirror search panel includes a replace field when opened
      openSearchPanel(view)
    },
    getCursorLine: () => {
      return view.state.doc.lineAt(view.state.selection.main.head).number
    },
    onCursorLineChange: (cb) => {
      cursorListeners.add(cb)
      return () => {
        cursorListeners.delete(cb)
      }
    },
    destroy: () => view.destroy()
  }
}

function fontSizeTheme(px: number): Extension {
  return EditorView.theme({
    '&': {
      fontSize: `${px}px`
    },
    '.cm-scroller': {
      fontSize: `${px}px`,
      lineHeight: '1.45'
    },
    '.cm-content': {
      fontSize: `${px}px`
    }
  })
}

function baseEditorChrome(): Extension {
  return EditorView.theme({
    '&': {
      height: '100%'
    },
    '.cm-scroller': {
      fontFamily:
        '"Courier New", Courier, "Nimbus Mono L", "Liberation Mono", monospace',
      lineHeight: '1.45',
      overflow: 'auto'
    },
    '.cm-content': {
      padding: '16px 8px 48px 8px',
      caretColor: 'var(--cm-caret)',
      color: 'var(--text)'
    },
    '.cm-gutters': {
      backgroundColor: 'var(--cm-gutter-bg)',
      color: 'var(--cm-gutter-fg)',
      border: 'none',
      borderRight: '1px solid var(--border)'
    },
    '.cm-activeLine': {
      backgroundColor: 'var(--cm-active-line)'
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--cm-active-line)'
    },
    '&.cm-focused .cm-cursor': {
      borderLeftColor: 'var(--cm-caret)'
    },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
      backgroundColor: 'var(--cm-selection) !important'
    },
    '.cm-tooltip-autocomplete': {
      backgroundColor: 'var(--surface)',
      color: 'var(--text)',
      border: '1px solid var(--border)'
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': {
      backgroundColor: 'var(--accent-muted)',
      color: 'var(--text)'
    },
    /* Search / replace panel */
    '.cm-panel.cm-search': {
      backgroundColor: 'var(--surface)',
      color: 'var(--text)',
      borderBottom: '1px solid var(--border)',
      padding: '6px 8px',
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '13px'
    },
    '.cm-panel.cm-search input, .cm-panel.cm-search button, .cm-panel.cm-search label':
      {
        color: 'var(--text)',
        fontSize: '13px'
      },
    '.cm-panel.cm-search input': {
      backgroundColor: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: '4px',
      padding: '3px 6px'
    },
    '.cm-panel.cm-search button': {
      backgroundColor: 'var(--surface-2)',
      border: '1px solid var(--border)',
      borderRadius: '4px',
      padding: '3px 8px',
      cursor: 'pointer'
    },
    '.cm-searchMatch': {
      backgroundColor: 'rgba(255, 213, 0, 0.35)'
    },
    '.cm-searchMatch-selected': {
      backgroundColor: 'rgba(255, 150, 0, 0.5)'
    }
  })
}

/**
 * Typewriter mode: keep the active line near the vertical centre of the
 * editor viewport while typing or moving the caret.
 */
function typewriterExtension(): Extension {
  return ViewPlugin.fromClass(
    class {
      constructor(readonly view: EditorView) {
        // Defer so layout is ready
        queueMicrotask(() => centerCursor(this.view))
      }
      update(update: ViewUpdate): void {
        if (update.selectionSet || update.docChanged || update.geometryChanged) {
          centerCursor(this.view)
        }
      }
    }
  )
}

function centerCursor(view: EditorView): void {
  const head = view.state.selection.main.head
  const coords = view.coordsAtPos(head)
  if (!coords) return
  const scroller = view.scrollDOM
  const rect = scroller.getBoundingClientRect()
  const caretMid = (coords.top + coords.bottom) / 2
  const viewMid = (rect.top + rect.bottom) / 2
  const delta = caretMid - viewMid
  if (Math.abs(delta) > 2) {
    scroller.scrollTop += delta
  }
}
