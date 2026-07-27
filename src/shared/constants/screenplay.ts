/**
 * Hollywood-standard screenplay layout constants.
 *
 * These values mirror industry norms used by Final Draft and similar apps:
 * US Letter paper, Courier 12 pt, fixed margins, and conventional
 * horizontal positions for character / parenthetical / dialogue.
 *
 * All linear measurements are in inches unless noted. Convert to points
 * with `inchesToPoints()` (1 in = 72 pt) for PDFKit and CSS print layout.
 */

/** US Letter width in inches. */
export const PAGE_WIDTH_IN = 8.5

/** US Letter height in inches. */
export const PAGE_HEIGHT_IN = 11

/** Points per inch (PostScript / PDF coordinate system). */
export const POINTS_PER_INCH = 72

/** Screenplay body font size in points. Always Courier 12. */
export const FONT_SIZE_PT = 12

/**
 * Line height in points for single-spaced Courier 12.
 * Classic screenplay format uses ~12 pt leading (1 line = 1/6 inch).
 */
export const LINE_HEIGHT_PT = 12

/** Left margin (scene headings, action, transitions start here). */
export const MARGIN_LEFT_IN = 1.5

/** Right margin. */
export const MARGIN_RIGHT_IN = 1.0

/** Top margin (page number sits just above body start). */
export const MARGIN_TOP_IN = 1.0

/** Bottom margin. */
export const MARGIN_BOTTOM_IN = 1.0

/**
 * Character cue left indent from the page edge (inches).
 * ~3.7" is the Final Draft default.
 */
export const CHARACTER_LEFT_IN = 3.7

/**
 * Parenthetical left indent from the page edge (inches).
 * ~3.1" is the Final Draft default.
 */
export const PARENTHETICAL_LEFT_IN = 3.1

/**
 * Dialogue left indent from the page edge (inches).
 * ~2.5" is the Final Draft default.
 */
export const DIALOGUE_LEFT_IN = 2.5

/**
 * Dialogue right edge from the page edge (inches).
 * Leaves roughly 1.5" on the right of dialogue blocks.
 */
export const DIALOGUE_RIGHT_IN = 1.5

/**
 * Parenthetical right edge from the page edge (inches).
 */
export const PARENTHETICAL_RIGHT_IN = 2.0

/**
 * Transition blocks are right-aligned near the right margin.
 */
export const TRANSITION_RIGHT_IN = 1.0

/**
 * Approximate characters per line for action/description at Courier 12
 * with 1.5" left + 1.0" right on US Letter (usable ~6").
 * Courier is monospaced at 10 cpi → 60 characters.
 */
export const ACTION_CHARS_PER_LINE = 60

/**
 * Approximate characters per dialogue line (from 2.5" to ~7.0").
 * Usable ~4.5" → 45 characters.
 */
export const DIALOGUE_CHARS_PER_LINE = 35

/**
 * Approximate characters per parenthetical line.
 */
export const PARENTHETICAL_CHARS_PER_LINE = 25

/**
 * Approximate characters per character-name line.
 */
export const CHARACTER_CHARS_PER_LINE = 30

/**
 * Usable body lines per page after top/bottom margins and page-number row.
 * (11" - 1" top - 1" bottom) / (12pt/72) = 54 lines; reserve 1 for page #.
 */
export const LINES_PER_PAGE = 54

/** Page-number vertical offset from the top edge (inches). */
export const PAGE_NUMBER_TOP_IN = 0.5

/** Page-number horizontal position (right-aligned area). */
export const PAGE_NUMBER_RIGHT_IN = 1.0

/** Convert inches to PDF points. */
export function inchesToPoints(inches: number): number {
  return inches * POINTS_PER_INCH
}

/** Convert points to inches. */
export function pointsToInches(points: number): number {
  return points / POINTS_PER_INCH
}

/** Supported application theme modes. */
export type ThemeMode = 'light' | 'dark' | 'system'

/** Supported UI locales. */
export type LocaleCode = 'en_GB' | 'es_PY' | 'fr_FR'

export const SUPPORTED_LOCALES: readonly LocaleCode[] = [
  'en_GB',
  'es_PY',
  'fr_FR'
] as const

export const DEFAULT_LOCALE: LocaleCode = 'en_GB'
export const DEFAULT_THEME: ThemeMode = 'system'

/** Editor / UI font size bounds (CSS pixels for editor; UI scales from base). */
export const FONT_SIZE_MIN = 11
export const FONT_SIZE_MAX = 28
export const FONT_SIZE_DEFAULT = 14
export const FONT_SIZE_STEP = 1

/** File extensions the editor opens/saves natively. */
export const FOUNTAIN_EXTENSION = '.fountain'
export const TXT_EXTENSION = '.txt'
export const FDX_EXTENSION = '.fdx'
export const PDF_EXTENSION = '.pdf'

export const OPEN_FILTERS = [
  {
    name: 'Screenplay',
    extensions: ['fountain', 'txt']
  },
  {
    name: 'All Files',
    extensions: ['*']
  }
]

export const SAVE_FOUNTAIN_FILTERS = [
  {
    name: 'Fountain',
    extensions: ['fountain']
  },
  {
    name: 'Plain Text',
    extensions: ['txt']
  }
]

export const SAVE_FDX_FILTERS = [
  {
    name: 'Final Draft',
    extensions: ['fdx']
  }
]

export const SAVE_PDF_FILTERS = [
  {
    name: 'PDF',
    extensions: ['pdf']
  }
]

/** IPC channel names — single source of truth for main ↔ renderer. */
export const IPC = {
  // File
  FILE_NEW: 'file:new',
  FILE_OPEN: 'file:open',
  FILE_SAVE: 'file:save',
  FILE_SAVE_AS: 'file:save-as',
  FILE_EXPORT_FOUNTAIN: 'file:export-fountain',
  FILE_EXPORT_FDX: 'file:export-fdx',
  FILE_EXPORT_PDF: 'file:export-pdf',
  FILE_GET_STATE: 'file:get-state',
  FILE_SET_DIRTY: 'file:set-dirty',
  FILE_CONTENT_CHANGED: 'file:content-changed',
  FILE_LOADED: 'file:loaded',
  /** Startup document: last file if available, otherwise starter template. */
  FILE_GET_STARTUP: 'file:get-startup',
  /** Starter template content (always untitled; never overwrites template file). */
  FILE_GET_TEMPLATE: 'file:get-template',

  // Dialogs
  DIALOG_CONFIRM_DISCARD: 'dialog:confirm-discard',
  DIALOG_SHOW_MESSAGE: 'dialog:show-message',
  DIALOG_SHOW_ERROR: 'dialog:show-error',

  // App preferences
  PREFS_GET: 'prefs:get',
  PREFS_SET: 'prefs:set',
  PREFS_CHANGED: 'prefs:changed',

  // Menu actions pushed main → renderer
  MENU_ACTION: 'menu:action',

  // Window / app
  APP_GET_VERSION: 'app:get-version',
  APP_QUIT: 'app:quit',
  APP_CHECK_UPDATES: 'app:check-updates',

  // Export helpers (renderer may ask main to write binary)
  EXPORT_WRITE_BUFFER: 'export:write-buffer'
} as const

export type IpcChannel = (typeof IPC)[keyof typeof IPC]
