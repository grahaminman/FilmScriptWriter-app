/**
 * File open/save/export orchestration in the main process.
 *
 * Keeps the current document path and last-used directory in sync with
 * electron-store, and exposes promise-based helpers used by IPC handlers.
 */

import { BrowserWindow, dialog } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import {
  FOUNTAIN_EXTENSION,
  OPEN_FILTERS,
  SAVE_FDX_FILTERS,
  SAVE_FOUNTAIN_FILTERS,
  SAVE_PDF_FILTERS
} from '../shared/constants/screenplay'
import { prepareFountainExport } from '../shared/export/fountain-export'
import { fountainToFdx } from '../shared/export/fdx'
import { fountainToPdf } from '../shared/export/pdf'
import { t } from '../shared/i18n/locales'
import { getPreferences, setPreference } from './store'
import { pathExists } from './path-exists'
import {
  ensureUserTemplateAvailable,
  isProtectedTemplatePath,
  loadTemplateContent
} from './template-service'

export interface DocumentState {
  filePath: string | null
  dirty: boolean
}

let documentState: DocumentState = {
  filePath: null,
  dirty: false
}

export function getDocumentState(): DocumentState {
  return { ...documentState }
}

export function setDocumentDirty(dirty: boolean): DocumentState {
  documentState.dirty = dirty
  return getDocumentState()
}

export function setDocumentPath(filePath: string | null): DocumentState {
  // Never bind the editor to the protected starter template path
  if (isProtectedTemplatePath(filePath)) {
    documentState.filePath = null
    return getDocumentState()
  }
  documentState.filePath = filePath
  if (filePath) {
    setPreference('lastDirectory', path.dirname(filePath))
    setPreference('lastFilePath', filePath)
  }
  return getDocumentState()
}

/**
 * Startup document: restore last opened/saved file if it still exists,
 * otherwise load the starter template as an untitled buffer.
 */
export async function getStartupDocument(): Promise<{
  content: string
  path: string | null
  fromTemplate: boolean
  templatePath: string
}> {
  const templatePath = await ensureUserTemplateAvailable()
  const last = getPreferences().lastFilePath

  if (last && !isProtectedTemplatePath(last) && (await pathExists(last))) {
    try {
      const content = await fs.readFile(last, 'utf8')
      setDocumentPath(last)
      documentState.dirty = false
      return {
        content,
        path: last,
        fromTemplate: false,
        templatePath
      }
    } catch (err) {
      console.warn('[startup] could not reopen last file:', err)
    }
  }

  const content = await loadTemplateContent()
  resetDocument()
  return {
    content,
    path: null,
    fromTemplate: true,
    templatePath
  }
}

/**
 * Fresh template buffer for File → New (never linked to the template path).
 */
export async function getNewDocumentFromTemplate(): Promise<{
  content: string
  path: null
  fromTemplate: true
  templatePath: string
}> {
  const templatePath = await ensureUserTemplateAvailable()
  const content = await loadTemplateContent()
  resetDocument()
  return {
    content,
    path: null,
    fromTemplate: true,
    templatePath
  }
}

function defaultDir(): string {
  const last = getPreferences().lastDirectory
  return last && last.length > 0 ? last : appDocumentsFallback()
}

function appDocumentsFallback(): string {
  // Prefer user home; dialog will still allow navigation
  return process.env.HOME || process.env.USERPROFILE || process.cwd()
}

function locale(): ReturnType<typeof getPreferences>['locale'] {
  return getPreferences().locale
}

/**
 * Show open dialog and read the selected file.
 */
export async function openFileDialog(
  win: BrowserWindow
): Promise<{ path: string; content: string } | null> {
  const result = await dialog.showOpenDialog(win, {
    title: t(locale(), 'menu.file.open'),
    defaultPath: defaultDir(),
    filters: OPEN_FILTERS,
    properties: ['openFile']
  })

  if (result.canceled || result.filePaths.length === 0) return null

  const filePath = result.filePaths[0]
  const content = await fs.readFile(filePath, 'utf8')

  // Opening the starter template copies content as untitled so Save won't clobber it
  if (isProtectedTemplatePath(filePath)) {
    resetDocument()
    return { path: null, content }
  }

  setDocumentPath(filePath)
  documentState.dirty = false
  return { path: filePath, content }
}

/**
 * Save content to the current path, or run Save As when none is set.
 */
export async function saveFile(
  win: BrowserWindow,
  content: string,
  forceSaveAs = false
): Promise<{ path: string } | null> {
  let target = documentState.filePath

  // Always force a picker when path is missing, is a protected template,
  // or the caller requested Save As — the starter must never be overwritten.
  const mustPick =
    forceSaveAs ||
    !target ||
    isProtectedTemplatePath(target)

  if (mustPick) {
    const result = await dialog.showSaveDialog(win, {
      title: t(locale(), forceSaveAs || !target ? 'menu.file.saveAs' : 'menu.file.save'),
      defaultPath: path.join(
        defaultDir(),
        target && !isProtectedTemplatePath(target)
          ? path.basename(target)
          : `untitled${FOUNTAIN_EXTENSION}`
      ),
      filters: SAVE_FOUNTAIN_FILTERS
    })
    if (result.canceled || !result.filePath) return null
    target = result.filePath
    if (!path.extname(target)) {
      target += FOUNTAIN_EXTENSION
    }
    // Refuse to save on top of the protected template even if the user picks it
    if (isProtectedTemplatePath(target)) {
      await showError(
        win,
        'The starter template is protected and cannot be overwritten. Please choose a different file name.'
      )
      return null
    }
  }

  const payload = prepareFountainExport(content)
  await fs.writeFile(target, payload, 'utf8')
  setDocumentPath(target)
  documentState.dirty = false
  return { path: target }
}

/**
 * Export helpers — always prompt for a destination.
 */
export async function exportFountain(
  win: BrowserWindow,
  content: string
): Promise<string | null> {
  const result = await dialog.showSaveDialog(win, {
    title: t(locale(), 'menu.export.fountain'),
    defaultPath: path.join(defaultDir(), suggestName(documentState.filePath, FOUNTAIN_EXTENSION)),
    filters: SAVE_FOUNTAIN_FILTERS
  })
  if (result.canceled || !result.filePath) return null
  let target = result.filePath
  if (!path.extname(target)) target += FOUNTAIN_EXTENSION
  await fs.writeFile(target, prepareFountainExport(content), 'utf8')
  setPreference('lastDirectory', path.dirname(target))
  return target
}

export async function exportFdx(
  win: BrowserWindow,
  content: string
): Promise<string | null> {
  const result = await dialog.showSaveDialog(win, {
    title: t(locale(), 'menu.export.fdx'),
    defaultPath: path.join(defaultDir(), suggestName(documentState.filePath, '.fdx')),
    filters: SAVE_FDX_FILTERS
  })
  if (result.canceled || !result.filePath) return null
  let target = result.filePath
  if (!path.extname(target)) target += '.fdx'
  const xml = fountainToFdx(content)
  await fs.writeFile(target, xml, 'utf8')
  setPreference('lastDirectory', path.dirname(target))
  return target
}

export async function exportPdf(
  win: BrowserWindow,
  content: string
): Promise<string | null> {
  const result = await dialog.showSaveDialog(win, {
    title: t(locale(), 'menu.export.pdf'),
    defaultPath: path.join(defaultDir(), suggestName(documentState.filePath, '.pdf')),
    filters: SAVE_PDF_FILTERS
  })
  if (result.canceled || !result.filePath) return null
  let target = result.filePath
  if (!path.extname(target)) target += '.pdf'
  const buffer = await fountainToPdf(content)
  await fs.writeFile(target, buffer)
  setPreference('lastDirectory', path.dirname(target))
  return target
}

/**
 * Confirm discard of unsaved changes. Returns:
 *  - 'save' | 'discard' | 'cancel'
 */
export async function confirmDiscard(
  win: BrowserWindow
): Promise<'save' | 'discard' | 'cancel'> {
  if (!documentState.dirty) return 'discard'

  const loc = locale()
  const result = await dialog.showMessageBox(win, {
    type: 'warning',
    buttons: [
      t(loc, 'dialog.unsaved.save'),
      t(loc, 'dialog.unsaved.discard'),
      t(loc, 'dialog.unsaved.cancel')
    ],
    defaultId: 0,
    cancelId: 2,
    title: t(loc, 'dialog.unsaved.title'),
    message: t(loc, 'dialog.unsaved.message'),
    noLink: true
  })

  if (result.response === 0) return 'save'
  if (result.response === 1) return 'discard'
  return 'cancel'
}

export async function showError(
  win: BrowserWindow | null,
  message: string
): Promise<void> {
  const opts = {
    type: 'error' as const,
    title: t(locale(), 'dialog.error.title'),
    message,
    buttons: [t(locale(), 'common.ok')]
  }
  if (win && !win.isDestroyed()) {
    await dialog.showMessageBox(win, opts)
  } else {
    await dialog.showMessageBox(opts)
  }
}

export async function showAbout(win: BrowserWindow): Promise<void> {
  const loc = locale()
  await dialog.showMessageBox(win, {
    type: 'info',
    title: t(loc, 'dialog.about.title'),
    message: t(loc, 'app.name'),
    detail: `${t(loc, 'dialog.about.message')}\n\nv${process.env.npm_package_version || '1.0.0'}`,
    buttons: [t(loc, 'common.ok')]
  })
}

export function resetDocument(): DocumentState {
  documentState = { filePath: null, dirty: false }
  return getDocumentState()
}

function suggestName(current: string | null, ext: string): string {
  if (current) {
    return path.basename(current, path.extname(current)) + ext
  }
  return `untitled${ext}`
}
