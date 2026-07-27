/**
 * Preload bridge — exposes a safe, typed API to the renderer via contextBridge.
 */

import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import { IPC } from '../shared/constants/screenplay'

export interface DocumentState {
  filePath: string | null
  dirty: boolean
}

export interface AppPreferences {
  theme: 'light' | 'dark' | 'system'
  locale: 'en_GB' | 'es_PY' | 'fr_FR'
  lastDirectory: string
  lastFilePath: string
  previewVisible: boolean
  previewFollow: boolean
  typewriterMode: boolean
  syntaxHighlighting: boolean
  syntaxColorPreset: 'default' | 'highContrast' | 'soft' | 'custom'
  syntaxColorsCustom: Record<string, string>
  editorFontSize: number
  windowBounds: { width: number; height: number; x?: number; y?: number }
}

export interface FileResult {
  cancelled: boolean
  content?: string
  path?: string | null
  needsSave?: boolean
  then?: string
  error?: string
  fromTemplate?: boolean
}

export interface StartupDocument {
  content: string
  path: string | null
  fromTemplate: boolean
  templatePath: string
}

export interface ElectronAPI {
  getPreferences: () => Promise<AppPreferences>
  setPreferences: (partial: Partial<AppPreferences>) => Promise<AppPreferences>
  onPreferencesChanged: (cb: (prefs: AppPreferences) => void) => () => void

  getDocumentState: () => Promise<DocumentState>
  setDirty: (dirty: boolean) => Promise<DocumentState>

  getStartupDocument: () => Promise<StartupDocument>
  getTemplateDocument: () => Promise<StartupDocument>

  newFile: () => Promise<FileResult>
  openFile: () => Promise<FileResult>
  saveFile: (content: string, forceSaveAs?: boolean) => Promise<FileResult>
  saveFileAs: (content: string) => Promise<FileResult>
  exportFountain: (content: string) => Promise<FileResult>
  exportFdx: (content: string) => Promise<FileResult>
  exportPdf: (content: string) => Promise<FileResult>

  confirmDiscard: () => Promise<'save' | 'discard' | 'cancel'>
  showError: (message: string) => Promise<void>
  showAbout: () => Promise<void>
  getVersion: () => Promise<string>
  checkUpdates: () => Promise<void>

  onMenuAction: (cb: (action: string) => void) => () => void
  updateMenuState: (state: {
    dirty?: boolean
    hasPath?: boolean
    canUndo?: boolean
    canRedo?: boolean
  }) => void
}

const api: ElectronAPI = {
  getPreferences: () => ipcRenderer.invoke(IPC.PREFS_GET),
  setPreferences: (partial) => ipcRenderer.invoke(IPC.PREFS_SET, partial),
  onPreferencesChanged: (cb) => {
    const listener = (_e: IpcRendererEvent, prefs: AppPreferences): void => cb(prefs)
    ipcRenderer.on(IPC.PREFS_CHANGED, listener)
    return () => ipcRenderer.removeListener(IPC.PREFS_CHANGED, listener)
  },

  getDocumentState: () => ipcRenderer.invoke(IPC.FILE_GET_STATE),
  setDirty: (dirty) => ipcRenderer.invoke(IPC.FILE_SET_DIRTY, dirty),

  getStartupDocument: () => ipcRenderer.invoke(IPC.FILE_GET_STARTUP),
  getTemplateDocument: () => ipcRenderer.invoke(IPC.FILE_GET_TEMPLATE),

  newFile: () => ipcRenderer.invoke(IPC.FILE_NEW),
  openFile: () => ipcRenderer.invoke(IPC.FILE_OPEN),
  saveFile: (content, forceSaveAs = false) =>
    ipcRenderer.invoke(IPC.FILE_SAVE, content, forceSaveAs),
  saveFileAs: (content) => ipcRenderer.invoke(IPC.FILE_SAVE_AS, content),
  exportFountain: (content) => ipcRenderer.invoke(IPC.FILE_EXPORT_FOUNTAIN, content),
  exportFdx: (content) => ipcRenderer.invoke(IPC.FILE_EXPORT_FDX, content),
  exportPdf: (content) => ipcRenderer.invoke(IPC.FILE_EXPORT_PDF, content),

  confirmDiscard: () => ipcRenderer.invoke(IPC.DIALOG_CONFIRM_DISCARD),
  showError: (message) => ipcRenderer.invoke(IPC.DIALOG_SHOW_ERROR, message),
  showAbout: () => ipcRenderer.invoke('help:about'),
  getVersion: () => ipcRenderer.invoke(IPC.APP_GET_VERSION),
  checkUpdates: () => ipcRenderer.invoke(IPC.APP_CHECK_UPDATES),

  onMenuAction: (cb) => {
    const listener = (_e: IpcRendererEvent, action: string): void => cb(action)
    ipcRenderer.on(IPC.MENU_ACTION, listener)
    return () => ipcRenderer.removeListener(IPC.MENU_ACTION, listener)
  },

  updateMenuState: (state) => {
    ipcRenderer.send('menu:update-state', state)
  }
}

contextBridge.exposeInMainWorld('api', api)
