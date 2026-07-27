/**
 * Renderer entry — wires editor, preview, status bar, menus (via IPC),
 * themes, font size, typewriter mode, preview-follow, and i18n.
 */

import './styles/app.css'
import { createEditor, type EditorHandle } from './editor/create-editor'
import { createPreview, applyPageCssVars, type PreviewHandle } from './preview/preview'
import { t } from '../shared/i18n/locales'
import {
  FONT_SIZE_DEFAULT,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  FONT_SIZE_STEP,
  type LocaleCode,
  type ThemeMode
} from '../shared/constants/screenplay'
import { undo, redo } from '@codemirror/commands'

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let editor: EditorHandle
let preview: PreviewHandle
let locale: LocaleCode = 'en_GB'
let theme: ThemeMode = 'system'
let filePath: string | null = null
let dirty = false
let previewVisible = true
let previewFollow = true
let typewriterMode = false
let syntaxHighlighting = true
let editorFontSize = FONT_SIZE_DEFAULT
let suppressDirty = false
let welcomeDismissed = false

let statsTimer: ReturnType<typeof setTimeout> | null = null
let followTimer: ReturnType<typeof setTimeout> | null = null
const STATS_DEBOUNCE_MS = 120
const FOLLOW_DEBOUNCE_MS = 80

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------

const el = {
  editor: document.getElementById('editor') as HTMLElement,
  previewPane: document.getElementById('preview-pane') as HTMLElement,
  workspace: document.getElementById('workspace') as HTMLElement,
  docTitle: document.getElementById('doc-title') as HTMLElement,
  statusWords: document.getElementById('status-words') as HTMLElement,
  statusPages: document.getElementById('status-pages') as HTMLElement,
  statusState: document.getElementById('status-state') as HTMLElement,
  statusPath: document.getElementById('status-path') as HTMLElement,
  statusFontLabel: document.getElementById('status-font-label') as HTMLElement,
  statusFontValue: document.getElementById('status-font-value') as HTMLElement,
  fontSizeLabel: document.getElementById('font-size-label') as HTMLElement,
  btnPreview: document.getElementById('btn-toggle-preview') as HTMLButtonElement,
  btnTheme: document.getElementById('btn-theme') as HTMLButtonElement,
  btnFind: document.getElementById('btn-find') as HTMLButtonElement,
  btnReplace: document.getElementById('btn-replace') as HTMLButtonElement,
  btnFontInc: document.getElementById('btn-font-inc') as HTMLButtonElement,
  btnFontDec: document.getElementById('btn-font-dec') as HTMLButtonElement,
  statusFind: document.getElementById('status-find') as HTMLButtonElement,
  statusReplace: document.getElementById('status-replace') as HTMLButtonElement,
  statusFontInc: document.getElementById('status-font-inc') as HTMLButtonElement,
  statusFontDec: document.getElementById('status-font-dec') as HTMLButtonElement,
  welcome: document.getElementById('welcome-overlay') as HTMLElement,
  welcomeTitle: document.getElementById('welcome-title') as HTMLElement,
  welcomeBody: document.getElementById('welcome-body') as HTMLElement,
  welcomeNew: document.getElementById('welcome-new') as HTMLButtonElement,
  welcomeOpen: document.getElementById('welcome-open') as HTMLButtonElement,
  welcomeDismiss: document.getElementById('welcome-dismiss') as HTMLButtonElement,
  resizer: document.getElementById('pane-resizer') as HTMLElement
}

// ---------------------------------------------------------------------------
// Theme / font / prefs application
// ---------------------------------------------------------------------------

function resolveDark(mode: ThemeMode): boolean {
  if (mode === 'dark') return true
  if (mode === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function applyTheme(mode: ThemeMode): void {
  theme = mode
  const dark = resolveDark(mode)
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  editor?.setTheme(dark)
}

/**
 * Apply editor font size to editor chrome, toolbar/status UI scale, and preview zoom.
 */
function applyFontSize(px: number, persist = true): void {
  editorFontSize = Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(px)))
  editor?.setFontSize(editorFontSize)

  // UI scale relative to default 14px
  const uiScale = editorFontSize / FONT_SIZE_DEFAULT
  document.documentElement.style.setProperty('--ui-scale', String(uiScale))

  // Preview page zoom tracks editor font so WYSIWYG feel improves
  preview?.setZoom(uiScale)

  if (el.fontSizeLabel) el.fontSizeLabel.textContent = String(editorFontSize)
  if (el.statusFontValue) el.statusFontValue.textContent = String(editorFontSize)

  if (persist) {
    void window.api.setPreferences({ editorFontSize })
  }
}

function bumpFont(delta: number): void {
  applyFontSize(editorFontSize + delta, true)
}

function applyLocale(next: LocaleCode): void {
  locale = next
  document.documentElement.lang = next.replace('_', '-')
  editor?.setLocale(next)
  preview?.setLocale(next)

  el.btnPreview.textContent = t(locale, 'menu.view.preview')
  el.btnTheme.textContent = t(locale, 'menu.theme')
  el.btnFind.textContent = t(locale, 'status.find')
  el.btnReplace.textContent = t(locale, 'status.replace')
  el.statusFind.textContent = t(locale, 'status.find')
  el.statusReplace.textContent = t(locale, 'status.replace')
  el.statusFontLabel.textContent = t(locale, 'status.font')
  el.welcomeTitle.textContent = t(locale, 'welcome.title')
  el.welcomeBody.textContent = t(locale, 'welcome.body')
  el.welcomeNew.textContent = t(locale, 'menu.file.new')
  el.welcomeOpen.textContent = t(locale, 'menu.file.open')
  el.welcomeDismiss.textContent = t(locale, 'common.close')

  updateTitle()
  updateStatusLabels()
}

function baseName(p: string | null): string {
  if (!p) return t(locale, 'status.untitled')
  const parts = p.split(/[/\\]/)
  return parts[parts.length - 1] || t(locale, 'status.untitled')
}

function updateTitle(): void {
  const name = baseName(filePath)
  el.docTitle.innerHTML = dirty
    ? `${escapeHtml(name)}<span class="dirty-dot">•</span>`
    : escapeHtml(name)
  document.title = `${dirty ? '• ' : ''}${name} — ${t(locale, 'app.name')}`
}

function updateStatusLabels(): void {
  const words = preview?.getWordCount() ?? 0
  const pages = preview?.getPageCount() ?? 1
  el.statusWords.innerHTML = `<strong>${words}</strong> ${t(locale, 'status.words')}`
  el.statusPages.innerHTML = `<strong>${pages}</strong> ${t(locale, 'status.pages')}`
  el.statusState.textContent = dirty
    ? t(locale, 'status.modified')
    : t(locale, 'status.ready')
  el.statusPath.textContent = filePath ?? ''
  if (el.statusFontValue) el.statusFontValue.textContent = String(editorFontSize)
  if (el.statusFontLabel) el.statusFontLabel.textContent = t(locale, 'status.font')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function setDirty(next: boolean): void {
  if (suppressDirty) return
  dirty = next
  void window.api.setDirty(next)
  window.api.updateMenuState({ dirty: next, hasPath: Boolean(filePath) })
  updateTitle()
  updateStatusLabels()
}

function scheduleStats(source: string): void {
  if (statsTimer) clearTimeout(statsTimer)
  statsTimer = setTimeout(() => {
    preview.render(source)
    updateStatusLabels()
    if (previewFollow) {
      preview.scrollToSourceLine(editor.getCursorLine())
    }
  }, STATS_DEBOUNCE_MS)
}

function scheduleFollow(line: number): void {
  if (!previewFollow) return
  if (followTimer) clearTimeout(followTimer)
  followTimer = setTimeout(() => {
    preview.scrollToSourceLine(line)
  }, FOLLOW_DEBOUNCE_MS)
}

// ---------------------------------------------------------------------------
// File operations
// ---------------------------------------------------------------------------

async function doNew(): Promise<void> {
  const result = await window.api.newFile()
  if (result.cancelled) return
  if (result.needsSave) {
    const saved = await doSave()
    if (!saved) return
    await doNew()
    return
  }
  // File → New always loads the starter template as an untitled buffer
  // (path null) so Save As cannot overwrite the template file on disk.
  loadContent(result.content ?? '', null)
  showWelcome(false)
}

async function doOpen(): Promise<void> {
  const result = await window.api.openFile()
  if (result.cancelled) return
  if (result.needsSave) {
    const saved = await doSave()
    if (!saved) return
    await doOpen()
    return
  }
  loadContent(result.content ?? '', result.path ?? null)
  showWelcome(false)
}

async function doSave(forceSaveAs = false): Promise<boolean> {
  const content = editor.getValue()
  const result = forceSaveAs
    ? await window.api.saveFileAs(content)
    : await window.api.saveFile(content, false)
  if (result.cancelled) return false
  filePath = result.path ?? filePath
  dirty = false
  void window.api.setDirty(false)
  window.api.updateMenuState({ dirty: false, hasPath: Boolean(filePath) })
  updateTitle()
  el.statusState.textContent = t(locale, 'status.saved')
  setTimeout(() => updateStatusLabels(), 1500)
  return true
}

async function doExport(kind: 'fountain' | 'fdx' | 'pdf'): Promise<void> {
  const content = editor.getValue()
  try {
    const result =
      kind === 'fountain'
        ? await window.api.exportFountain(content)
        : kind === 'fdx'
          ? await window.api.exportFdx(content)
          : await window.api.exportPdf(content)
    if (!result.cancelled && result.path) {
      el.statusState.textContent = t(locale, 'status.saved')
      setTimeout(() => updateStatusLabels(), 1500)
    }
  } catch (err) {
    await window.api.showError(err instanceof Error ? err.message : String(err))
  }
}

function loadContent(content: string, path: string | null): void {
  suppressDirty = true
  editor.setValue(content)
  filePath = path
  dirty = false
  void window.api.setDirty(false)
  window.api.updateMenuState({ dirty: false, hasPath: Boolean(path) })
  preview.render(content)
  updateTitle()
  updateStatusLabels()
  suppressDirty = false
  editor.focus()
}

function showWelcome(show: boolean): void {
  if (show && !welcomeDismissed) {
    el.welcome.classList.remove('hidden')
  } else {
    el.welcome.classList.add('hidden')
  }
}

function setPreviewVisible(visible: boolean): void {
  previewVisible = visible
  el.previewPane.classList.toggle('hidden', !visible)
  el.workspace.classList.toggle('preview-hidden', !visible)
  void window.api.setPreferences({ previewVisible: visible })
}

function setPreviewFollow(enabled: boolean, persist = true): void {
  previewFollow = enabled
  if (enabled) {
    preview.scrollToSourceLine(editor.getCursorLine())
  }
  if (persist) void window.api.setPreferences({ previewFollow: enabled })
}

function setTypewriter(enabled: boolean, persist = true): void {
  typewriterMode = enabled
  editor.setTypewriterMode(enabled)
  if (persist) void window.api.setPreferences({ typewriterMode: enabled })
}

function setSyntax(enabled: boolean, persist = true): void {
  syntaxHighlighting = enabled
  editor.setSyntaxHighlighting(enabled)
  if (persist) void window.api.setPreferences({ syntaxHighlighting: enabled })
}

function setupResizer(): void {
  let dragging = false
  el.resizer.addEventListener('mousedown', (e) => {
    dragging = true
    el.resizer.classList.add('active')
    e.preventDefault()
  })
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return
    const rect = el.workspace.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = Math.min(70, Math.max(30, (1 - x / rect.width) * 100))
    el.previewPane.style.width = `${pct}%`
  })
  window.addEventListener('mouseup', () => {
    dragging = false
    el.resizer.classList.remove('active')
  })
}

// ---------------------------------------------------------------------------
// Menu actions
// ---------------------------------------------------------------------------

function handleMenuAction(action: string): void {
  switch (action) {
    case 'file:new':
      void doNew()
      break
    case 'file:open':
      void doOpen()
      break
    case 'file:save':
      void doSave(false)
      break
    case 'file:save-as':
      void doSave(true)
      break
    case 'file:save-then-quit':
      void doSave(false).then((ok) => {
        if (ok) window.close()
      })
      break
    case 'file:export-fountain':
      void doExport('fountain')
      break
    case 'file:export-fdx':
      void doExport('fdx')
      break
    case 'file:export-pdf':
      void doExport('pdf')
      break
    case 'edit:undo':
      undo(editor.view)
      break
    case 'edit:redo':
      redo(editor.view)
      break
    case 'edit:find':
      editor.openFind()
      break
    case 'edit:find-replace':
      editor.openFindReplace()
      break
    case 'view:toggle-preview':
      setPreviewVisible(!previewVisible)
      break
    case 'view:preview-follow':
      // Preference already toggled in main; re-read and apply
      void window.api.getPreferences().then((p) => {
        setPreviewFollow(p.previewFollow, false)
      })
      break
    case 'view:typewriter':
      void window.api.getPreferences().then((p) => {
        setTypewriter(p.typewriterMode, false)
      })
      break
    case 'view:syntax':
      void window.api.getPreferences().then((p) => {
        setSyntax(p.syntaxHighlighting, false)
      })
      break
    case 'view:font-increase':
      bumpFont(FONT_SIZE_STEP)
      break
    case 'view:font-decrease':
      bumpFont(-FONT_SIZE_STEP)
      break
    case 'view:font-reset':
      applyFontSize(FONT_SIZE_DEFAULT, true)
      break
    case 'view:reload':
      location.reload()
      break
    case 'theme:light':
    case 'theme:dark':
    case 'theme:system': {
      const mode = action.split(':')[1] as ThemeMode
      applyTheme(mode)
      void window.api.setPreferences({ theme: mode })
      break
    }
    case 'language:en_GB':
    case 'language:es_PY':
    case 'language:fr_FR': {
      const loc = action.split(':')[1] as LocaleCode
      applyLocale(loc)
      void window.api.setPreferences({ locale: loc })
      break
    }
    case 'help:about':
      void window.api.showAbout()
      break
    case 'help:check-updates':
      void window.api.checkUpdates()
      break
    default:
      break
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function bootstrap(): Promise<void> {
  applyPageCssVars()

  const prefs = await window.api.getPreferences()
  locale = prefs.locale
  theme = prefs.theme
  previewVisible = prefs.previewVisible
  previewFollow = prefs.previewFollow
  typewriterMode = prefs.typewriterMode
  syntaxHighlighting = prefs.syntaxHighlighting
  editorFontSize = prefs.editorFontSize ?? FONT_SIZE_DEFAULT

  const dark = resolveDark(theme)
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')

  editor = createEditor({
    parent: el.editor,
    initialDoc: '',
    dark,
    locale,
    fontSize: editorFontSize,
    syntaxHighlighting,
    typewriterMode,
    onChange: (text) => {
      setDirty(true)
      scheduleStats(text)
    },
    onCursorLine: (line) => {
      scheduleFollow(line)
    }
  })

  preview = createPreview(el.previewPane, locale)
  applyLocale(locale)
  applyFontSize(editorFontSize, false)
  setPreviewVisible(previewVisible)
  setupResizer()

  // Restore last opened/saved file, or load the starter template (untitled).
  // The template file on disk is never bound as the document path.
  const startup = await window.api.getStartupDocument()
  suppressDirty = true
  editor.setValue(startup.content)
  filePath = startup.path
  dirty = false
  void window.api.setDirty(false)
  window.api.updateMenuState({
    dirty: false,
    hasPath: Boolean(startup.path)
  })
  preview.render(startup.content)
  suppressDirty = false
  updateTitle()
  updateStatusLabels()

  // Welcome only when starting from the template (first run / no last file)
  showWelcome(Boolean(startup.fromTemplate))

  if (startup.templatePath) {
    console.info(
      '[FilmScriptWriter] Starter template available at:',
      startup.templatePath
    )
  }

  // Toolbar / status bar actions
  el.btnPreview.addEventListener('click', () => setPreviewVisible(!previewVisible))
  el.btnTheme.addEventListener('click', () => {
    const order: ThemeMode[] = ['light', 'dark', 'system']
    const idx = order.indexOf(theme)
    const next = order[(idx + 1) % order.length]
    applyTheme(next)
    void window.api.setPreferences({ theme: next })
  })
  el.btnFind.addEventListener('click', () => editor.openFind())
  el.btnReplace.addEventListener('click', () => editor.openFindReplace())
  el.btnFontInc.addEventListener('click', () => bumpFont(FONT_SIZE_STEP))
  el.btnFontDec.addEventListener('click', () => bumpFont(-FONT_SIZE_STEP))
  el.statusFind.addEventListener('click', () => editor.openFind())
  el.statusReplace.addEventListener('click', () => editor.openFindReplace())
  el.statusFontInc.addEventListener('click', () => bumpFont(FONT_SIZE_STEP))
  el.statusFontDec.addEventListener('click', () => bumpFont(-FONT_SIZE_STEP))

  el.welcomeNew.addEventListener('click', () => {
    welcomeDismissed = true
    showWelcome(false)
    // Keep template content already in the editor (startup loaded it);
    // ensure path stays untitled if user had somehow set one.
    loadContent(editor.getValue(), null)
  })
  el.welcomeOpen.addEventListener('click', () => {
    welcomeDismissed = true
    showWelcome(false)
    void doOpen()
  })
  el.welcomeDismiss.addEventListener('click', () => {
    welcomeDismissed = true
    showWelcome(false)
    editor.focus()
  })

  window.api.onMenuAction(handleMenuAction)

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (theme === 'system') applyTheme('system')
  })

  window.api.onPreferencesChanged((p) => {
    if (p.locale !== locale) applyLocale(p.locale)
    if (p.theme !== theme) applyTheme(p.theme)
    if (p.previewVisible !== previewVisible) setPreviewVisible(p.previewVisible)
    if (p.previewFollow !== previewFollow) setPreviewFollow(p.previewFollow, false)
    if (p.typewriterMode !== typewriterMode) setTypewriter(p.typewriterMode, false)
    if (p.syntaxHighlighting !== syntaxHighlighting) setSyntax(p.syntaxHighlighting, false)
    if (p.editorFontSize !== editorFontSize) applyFontSize(p.editorFontSize, false)
  })

  editor.view.dom.addEventListener('keyup', syncUndoRedo)
  editor.view.dom.addEventListener('mouseup', syncUndoRedo)

  editor.focus()
}

function syncUndoRedo(): void {
  window.api.updateMenuState({
    canUndo: true,
    canRedo: true,
    dirty,
    hasPath: Boolean(filePath)
  })
}

void bootstrap()
