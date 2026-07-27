/**
 * Electron main process entry point.
 *
 * Creates the browser window, installs the native menu, registers IPC,
 * and wires basic auto-update checks for packaged builds.
 */

import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { registerIpcHandlers } from './ipc'
import { buildApplicationMenu } from './menu'
import { getPreferences, setPreference } from './store'
import { initAutoUpdater } from './auto-updater'
import { confirmDiscard, getDocumentState } from './file-service'
import { ensureUserTemplateAvailable } from './template-service'
import { IPC } from '../shared/constants/screenplay'

// Disable GPU sandbox issues on some Linux hosts during development
if (process.platform === 'linux') {
  app.disableHardwareAcceleration()
}

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const prefs = getPreferences()
  const bounds = prefs.windowBounds

  mainWindow = new BrowserWindow({
    width: bounds.width,
    height: bounds.height,
    x: bounds.x,
    y: bounds.y,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'FilmScriptWriter (Beta)',
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    void shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Persist window size/position
  const persistBounds = (): void => {
    if (!mainWindow) return
    const b = mainWindow.getBounds()
    setPreference('windowBounds', b)
  }
  mainWindow.on('resize', persistBounds)
  mainWindow.on('move', persistBounds)

  // Intercept close to confirm unsaved changes
  mainWindow.on('close', (e) => {
    const state = getDocumentState()
    if (!state.dirty) return
    e.preventDefault()
    void (async () => {
      if (!mainWindow) return
      const choice = await confirmDiscard(mainWindow)
      if (choice === 'cancel') return
      if (choice === 'save') {
        // Ask renderer to save, then quit
        mainWindow.webContents.send(IPC.MENU_ACTION, 'file:save-then-quit')
        return
      }
      // discard
      mainWindow.removeAllListeners('close')
      mainWindow.close()
    })()
  })

  buildApplicationMenu(mainWindow)

  // Load renderer
  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    void mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerIpcHandlers()
  // Install starter template into Documents/FilmScriptWriter/templates (idempotent)
  void ensureUserTemplateAvailable().catch((err) => {
    console.warn('[template] ensure failed:', err)
  })
  createWindow()
  initAutoUpdater(() => mainWindow)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Security: deny new-window navigations to unexpected protocols
app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, url) => {
    const allowed =
      url.startsWith('http://localhost') ||
      url.startsWith('file://') ||
      Boolean(process.env.ELECTRON_RENDERER_URL && url.startsWith(process.env.ELECTRON_RENDERER_URL))
    if (!allowed) event.preventDefault()
  })
})
