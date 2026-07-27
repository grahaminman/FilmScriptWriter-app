/**
 * Syntax highlighting colours for the Fountain editor.
 *
 * Applied via CSS custom properties on the editor host so presets and
 * user custom colours update live without rebuilding CodeMirror styles.
 *
 * One palette for light and dark (user preference: bold colours work on both).
 */

export type SyntaxColorKey =
  | 'scene'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'transition'
  | 'lyrics'
  | 'centered'
  | 'section'
  | 'note'
  | 'boneyard'
  | 'meta'
  | 'pagebreak'

export type SyntaxColorPalette = Record<SyntaxColorKey, string>

export type SyntaxColorPresetId = 'default' | 'highContrast' | 'soft' | 'custom'

/** High-visibility default — deliberately strong hues (not all cool blue). */
export const SYNTAX_PRESET_DEFAULT: SyntaxColorPalette = {
  scene: '#1d6fd8',
  action: '#3d4a5c',
  character: '#c62828',
  parenthetical: '#7b1fa2',
  dialogue: '#1565c0',
  transition: '#e65100',
  lyrics: '#00838f',
  centered: '#6a1b9a',
  section: '#546e7a',
  note: '#78909c',
  boneyard: '#90a4ae',
  meta: '#00695c',
  pagebreak: '#b71c1c'
}

/** Maximum separation between element types. */
export const SYNTAX_PRESET_HIGH_CONTRAST: SyntaxColorPalette = {
  scene: '#0d47a1',
  action: '#212121',
  character: '#b71c1c',
  parenthetical: '#4a148c',
  dialogue: '#01579b',
  transition: '#e65100',
  lyrics: '#004d40',
  centered: '#880e4f',
  section: '#37474f',
  note: '#607d8b',
  boneyard: '#78909c',
  meta: '#1b5e20',
  pagebreak: '#c62828'
}

/** Softer pastels still distinguishable. */
export const SYNTAX_PRESET_SOFT: SyntaxColorPalette = {
  scene: '#5c7cfa',
  action: '#868e96',
  character: '#ff6b6b',
  parenthetical: '#cc5de8',
  dialogue: '#339af0',
  transition: '#ff922b',
  lyrics: '#20c997',
  centered: '#845ef7',
  section: '#adb5bd',
  note: '#a0aec0',
  boneyard: '#cbd5e1',
  meta: '#38b2ac',
  pagebreak: '#fc8181'
}

export const SYNTAX_PRESETS: Record<
  Exclude<SyntaxColorPresetId, 'custom'>,
  SyntaxColorPalette
> = {
  default: SYNTAX_PRESET_DEFAULT,
  highContrast: SYNTAX_PRESET_HIGH_CONTRAST,
  soft: SYNTAX_PRESET_SOFT
}

export const SYNTAX_COLOR_LABELS: Record<SyntaxColorKey, string> = {
  scene: 'Scene heading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
  lyrics: 'Lyrics',
  centered: 'Centered',
  section: 'Section / synopsis',
  note: 'Note',
  boneyard: 'Boneyard',
  meta: 'Title page',
  pagebreak: 'Page break'
}

export const SYNTAX_COLOR_KEYS = Object.keys(
  SYNTAX_PRESET_DEFAULT
) as SyntaxColorKey[]

/** CSS variable name for a syntax key, e.g. --syn-scene */
export function syntaxCssVar(key: SyntaxColorKey): string {
  return `--syn-${key}`
}

/**
 * Apply palette as CSS custom properties on an element (usually documentElement
 * or the editor host).
 */
export function applySyntaxPalette(
  el: HTMLElement,
  palette: SyntaxColorPalette
): void {
  for (const key of SYNTAX_COLOR_KEYS) {
    el.style.setProperty(syntaxCssVar(key), palette[key])
  }
}

export function resolvePalette(
  preset: SyntaxColorPresetId,
  custom: SyntaxColorPalette | null | undefined
): SyntaxColorPalette {
  if (preset === 'custom' && custom) {
    return { ...SYNTAX_PRESET_DEFAULT, ...custom }
  }
  if (preset === 'custom') return { ...SYNTAX_PRESET_DEFAULT }
  return { ...SYNTAX_PRESETS[preset] }
}
