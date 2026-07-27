/**
 * Basic auto-update support via electron-updater.
 *
 * In development (unpackaged) this is a no-op. In production builds,
 * it checks the GitHub releases feed configured in package.json → build.publish.
 *
 * Users can also trigger a manual check from Help → Check for Updates.
 */

import { BrowserWindow, dialog } from 'electron'
import { t } from '../shared/i18n/locales'
import { getPreferences } from './store'

let updaterReady = false

export function initAutoUpdater(getMainWindow: () => BrowserWindow | null): void {
  // Only run inside packaged apps
  if (!process.env.ELECTRON_VITE && process.resourcesPath) {
    // Packaged path — attempt to load electron-updater lazily
  }

  // electron-updater throws if not packaged; guard with app.isPackaged at call sites
  try {
    // Dynamic import shape kept simple for electron-vite bundling
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { autoUpdater } = require('electron-updater') as typeof import('electron-updater')
    const { app } = require('electron') as typeof import('electron')

    if (!app.isPackaged) {
      updaterReady = false
      return
    }

    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('update-available', (info) => {
      const win = getMainWindow()
      const loc = getPreferences().locale
      const target = win && !win.isDestroyed() ? win : undefined
      void dialog.showMessageBox(target as BrowserWindow, {
        type: 'info',
        title: t(loc, 'menu.help.checkUpdates'),
        message: t(loc, 'update.available'),
        detail: info.version,
        buttons: [t(loc, 'common.ok')]
      })
    })

    autoUpdater.on('update-not-available', () => {
      // Silent on background checks; manual checks use checkForUpdatesManual
    })

    autoUpdater.on('error', (err) => {
      // Missing publish feed (404) or offline network are expected in many installs
      console.warn('[auto-updater]', err instanceof Error ? err.message : err)
    })

    // Background check a short while after launch.
    // Failures are silent — the Help menu still offers a manual check.
    setTimeout(() => {
      void autoUpdater.checkForUpdates().catch(() => {
        /* network / missing publish config is fine */
      })
    }, 15_000)

    updaterReady = true
  } catch (err) {
    console.warn('[auto-updater] disabled:', err)
    updaterReady = false
  }
}

/**
 * Manual update check with user-facing dialogs.
 */
export async function checkForUpdatesManual(
  win: BrowserWindow
): Promise<void> {
  const loc = getPreferences().locale

  try {
    const { app } = require('electron') as typeof import('electron')
    if (!app.isPackaged) {
      await dialog.showMessageBox(win, {
        type: 'info',
        title: t(loc, 'menu.help.checkUpdates'),
        message: t(loc, 'update.none'),
        detail: 'Development build — auto-update is only active in packaged releases.',
        buttons: [t(loc, 'common.ok')]
      })
      return
    }

    const { autoUpdater } = require('electron-updater') as typeof import('electron-updater')

    await dialog.showMessageBox(win, {
      type: 'info',
      title: t(loc, 'menu.help.checkUpdates'),
      message: t(loc, 'update.checking'),
      buttons: [t(loc, 'common.ok')]
    })

    const result = await autoUpdater.checkForUpdates()
    if (!result?.updateInfo) {
      await dialog.showMessageBox(win, {
        type: 'info',
        title: t(loc, 'menu.help.checkUpdates'),
        message: t(loc, 'update.none'),
        buttons: [t(loc, 'common.ok')]
      })
    }
    // update-available handler shows its own dialog
    void updaterReady
  } catch (err) {
    await dialog.showMessageBox(win, {
      type: 'error',
      title: t(loc, 'menu.help.checkUpdates'),
      message: t(loc, 'update.error'),
      detail: err instanceof Error ? err.message : String(err),
      buttons: [t(loc, 'common.ok')]
    })
  }
}
