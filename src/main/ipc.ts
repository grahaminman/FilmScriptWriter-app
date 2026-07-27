/**
 * IPC handler registration for the main process.
 */

import { BrowserWindow, ipcMain, app } from 'electron'
import { IPC } from '../shared/constants/screenplay'
import type { AppPreferences } from './store'
import { getPreferences, setPreferences } from './store'
import {
  confirmDiscard,
  exportFdx,
  exportFountain,
  exportPdf,
  getDocumentState,
  getNewDocumentFromTemplate,
  getStartupDocument,
  openFileDialog,
  resetDocument,
  saveFile,
  setDocumentDirty,
  setDocumentPath,
  showAbout,
  showError
} from './file-service'
import { updateMenuState } from './menu'
import { checkForUpdatesManual } from './auto-updater'

function mainWindow(): BrowserWindow | null {
  const wins = BrowserWindow.getAllWindows()
  return wins[0] ?? null
}

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.PREFS_GET, () => getPreferences())

  ipcMain.handle(
    IPC.PREFS_SET,
    (_event, partial: Partial<AppPreferences>) => {
      const next = setPreferences(partial)
      const win = mainWindow()
      // Rebuild menu when locale/theme changes from renderer
      if (partial.locale !== undefined || partial.theme !== undefined) {
        updateMenuState(win, {})
      }
      // Broadcast to all windows
      for (const w of BrowserWindow.getAllWindows()) {
        w.webContents.send(IPC.PREFS_CHANGED, next)
      }
      return next
    }
  )

  ipcMain.handle(IPC.FILE_GET_STATE, () => getDocumentState())

  ipcMain.handle(IPC.FILE_SET_DIRTY, (_event, dirty: boolean) => {
    const state = setDocumentDirty(dirty)
    updateMenuState(mainWindow(), { dirty })
    return state
  })

  ipcMain.handle(IPC.FILE_GET_STARTUP, async () => {
    try {
      return await getStartupDocument()
    } catch (err) {
      console.error('[startup]', err)
      return {
        content: '',
        path: null,
        fromTemplate: true,
        templatePath: ''
      }
    }
  })

  ipcMain.handle(IPC.FILE_GET_TEMPLATE, async () => {
    return getNewDocumentFromTemplate()
  })

  ipcMain.handle(IPC.FILE_NEW, async () => {
    const win = mainWindow()
    if (!win) return { cancelled: true }
    const choice = await confirmDiscard(win)
    if (choice === 'cancel') return { cancelled: true }
    if (choice === 'save') {
      // Renderer must save first — signal it
      return { needsSave: true }
    }
    const doc = await getNewDocumentFromTemplate()
    updateMenuState(win, { dirty: false, hasPath: false })
    return {
      cancelled: false,
      content: doc.content,
      path: null,
      fromTemplate: true
    }
  })

  ipcMain.handle(IPC.FILE_OPEN, async () => {
    const win = mainWindow()
    if (!win) return { cancelled: true }
    const choice = await confirmDiscard(win)
    if (choice === 'cancel') return { cancelled: true }
    if (choice === 'save') return { needsSave: true, then: 'open' }

    try {
      const opened = await openFileDialog(win)
      if (!opened) return { cancelled: true }
      updateMenuState(win, { dirty: false, hasPath: true })
      return { cancelled: false, content: opened.content, path: opened.path }
    } catch (err) {
      await showError(win, err instanceof Error ? err.message : String(err))
      return { cancelled: true, error: String(err) }
    }
  })

  ipcMain.handle(
    IPC.FILE_SAVE,
    async (_event, content: string, forceSaveAs = false) => {
      const win = mainWindow()
      if (!win) return { cancelled: true }
      try {
        const result = await saveFile(win, content, forceSaveAs)
        if (!result) return { cancelled: true }
        updateMenuState(win, { dirty: false, hasPath: true })
        return { cancelled: false, path: result.path }
      } catch (err) {
        await showError(win, err instanceof Error ? err.message : String(err))
        return { cancelled: true, error: String(err) }
      }
    }
  )

  ipcMain.handle(IPC.FILE_SAVE_AS, async (_event, content: string) => {
    const win = mainWindow()
    if (!win) return { cancelled: true }
    try {
      const result = await saveFile(win, content, true)
      if (!result) return { cancelled: true }
      updateMenuState(win, { dirty: false, hasPath: true })
      return { cancelled: false, path: result.path }
    } catch (err) {
      await showError(win, err instanceof Error ? err.message : String(err))
      return { cancelled: true, error: String(err) }
    }
  })

  ipcMain.handle(IPC.FILE_EXPORT_FOUNTAIN, async (_event, content: string) => {
    const win = mainWindow()
    if (!win) return { cancelled: true }
    try {
      const path = await exportFountain(win, content)
      return path ? { cancelled: false, path } : { cancelled: true }
    } catch (err) {
      await showError(win, err instanceof Error ? err.message : String(err))
      return { cancelled: true, error: String(err) }
    }
  })

  ipcMain.handle(IPC.FILE_EXPORT_FDX, async (_event, content: string) => {
    const win = mainWindow()
    if (!win) return { cancelled: true }
    try {
      const path = await exportFdx(win, content)
      return path ? { cancelled: false, path } : { cancelled: true }
    } catch (err) {
      await showError(win, err instanceof Error ? err.message : String(err))
      return { cancelled: true, error: String(err) }
    }
  })

  ipcMain.handle(IPC.FILE_EXPORT_PDF, async (_event, content: string) => {
    const win = mainWindow()
    if (!win) return { cancelled: true }
    try {
      const path = await exportPdf(win, content)
      return path ? { cancelled: false, path } : { cancelled: true }
    } catch (err) {
      await showError(win, err instanceof Error ? err.message : String(err))
      return { cancelled: true, error: String(err) }
    }
  })

  ipcMain.handle(IPC.DIALOG_CONFIRM_DISCARD, async () => {
    const win = mainWindow()
    if (!win) return 'cancel'
    return confirmDiscard(win)
  })

  ipcMain.handle(IPC.DIALOG_SHOW_ERROR, async (_event, message: string) => {
    await showError(mainWindow(), message)
  })

  ipcMain.handle(IPC.APP_GET_VERSION, () => app.getVersion())

  ipcMain.handle(IPC.APP_CHECK_UPDATES, async () => {
    const win = mainWindow()
    if (win) await checkForUpdatesManual(win)
  })

  // Menu can ask renderer for current content via reverse path — handled in renderer.
  // Allow renderer to notify undo/redo availability
  ipcMain.on(
    'menu:update-state',
    (
      _event,
      state: { dirty?: boolean; hasPath?: boolean; canUndo?: boolean; canRedo?: boolean }
    ) => {
      updateMenuState(mainWindow(), state)
      if (state.dirty !== undefined) setDocumentDirty(state.dirty)
      if (state.hasPath === false) setDocumentPath(null)
    }
  )

  ipcMain.handle('help:about', async () => {
    const win = mainWindow()
    if (win) await showAbout(win)
  })
}
