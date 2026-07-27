/**
 * Persistent application preferences via electron-store.
 *
 * Remembers last open/save directory, theme, locale, window bounds,
 * preview options, font size, and editor behaviour between sessions.
 */

import Store from 'electron-store'
import {
  DEFAULT_LOCALE,
  DEFAULT_THEME,
  FONT_SIZE_DEFAULT,
  FONT_SIZE_MAX,
  FONT_SIZE_MIN,
  type LocaleCode,
  type ThemeMode
} from '../shared/constants/screenplay'

export interface AppPreferences {
  theme: ThemeMode
  locale: LocaleCode
  lastDirectory: string
  /**
   * Absolute path of the last successfully opened or saved screenplay.
   * Restored on next launch when the file still exists.
   * Never points at the protected starter template.
   */
  lastFilePath: string
  previewVisible: boolean
  /** Keep preview scrolled to the line under the editor cursor. */
  previewFollow: boolean
  /** Keep the caret vertically centred while typing. */
  typewriterMode: boolean
  /** Colour Fountain syntax in the editor. */
  syntaxHighlighting: boolean
  /** Editor body font size in CSS pixels. */
  editorFontSize: number
  windowBounds: {
    width: number
    height: number
    x?: number
    y?: number
  }
}

const defaults: AppPreferences = {
  theme: DEFAULT_THEME,
  locale: DEFAULT_LOCALE,
  lastDirectory: '',
  lastFilePath: '',
  previewVisible: true,
  previewFollow: true,
  typewriterMode: false,
  syntaxHighlighting: true,
  editorFontSize: FONT_SIZE_DEFAULT,
  windowBounds: {
    width: 1400,
    height: 900
  }
}

/**
 * Typed wrapper around electron-store.
 * Instantiated once in the main process.
 */
export const prefsStore = new Store<AppPreferences>({
  name: 'preferences',
  defaults
})

function clampFontSize(n: number): number {
  if (!Number.isFinite(n)) return FONT_SIZE_DEFAULT
  return Math.min(FONT_SIZE_MAX, Math.max(FONT_SIZE_MIN, Math.round(n)))
}

export function getPreferences(): AppPreferences {
  return {
    theme: prefsStore.get('theme', defaults.theme),
    locale: prefsStore.get('locale', defaults.locale),
    lastDirectory: prefsStore.get('lastDirectory', defaults.lastDirectory),
    lastFilePath: prefsStore.get('lastFilePath', defaults.lastFilePath),
    previewVisible: prefsStore.get('previewVisible', defaults.previewVisible),
    previewFollow: prefsStore.get('previewFollow', defaults.previewFollow),
    typewriterMode: prefsStore.get('typewriterMode', defaults.typewriterMode),
    syntaxHighlighting: prefsStore.get(
      'syntaxHighlighting',
      defaults.syntaxHighlighting
    ),
    editorFontSize: clampFontSize(
      prefsStore.get('editorFontSize', defaults.editorFontSize)
    ),
    windowBounds: prefsStore.get('windowBounds', defaults.windowBounds)
  }
}

export function setPreference<K extends keyof AppPreferences>(
  key: K,
  value: AppPreferences[K]
): AppPreferences {
  if (key === 'editorFontSize') {
    prefsStore.set(key, clampFontSize(value as number) as AppPreferences[K])
  } else {
    prefsStore.set(key, value)
  }
  return getPreferences()
}

export function setPreferences(partial: Partial<AppPreferences>): AppPreferences {
  for (const [k, v] of Object.entries(partial)) {
    if (v === undefined) continue
    if (k === 'editorFontSize') {
      prefsStore.set('editorFontSize', clampFontSize(v as number))
    } else {
      prefsStore.set(k as keyof AppPreferences, v as never)
    }
  }
  return getPreferences()
}
