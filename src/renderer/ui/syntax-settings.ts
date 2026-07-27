/**
 * Settings panel: syntax colour presets + per-type colour pickers (option B).
 */

import {
  SYNTAX_COLOR_KEYS,
  SYNTAX_COLOR_LABELS,
  SYNTAX_PRESET_DEFAULT,
  SYNTAX_PRESETS,
  type SyntaxColorKey,
  type SyntaxColorPalette,
  type SyntaxColorPresetId
} from '../../shared/constants/syntax-colors'
import { t } from '../../shared/i18n/locales'
import type { LocaleCode } from '../../shared/constants/screenplay'

export interface SyntaxSettingsState {
  preset: SyntaxColorPresetId
  custom: SyntaxColorPalette
  highlightingEnabled: boolean
}

export interface SyntaxSettingsHandle {
  open: () => void
  close: () => void
  setLocale: (locale: LocaleCode) => void
  destroy: () => void
}

export function createSyntaxSettingsPanel(
  parent: HTMLElement,
  initial: SyntaxSettingsState,
  onChange: (state: SyntaxSettingsState) => void
): SyntaxSettingsHandle {
  let locale: LocaleCode = 'en_GB'
  let state: SyntaxSettingsState = {
    preset: initial.preset,
    custom: { ...SYNTAX_PRESET_DEFAULT, ...initial.custom },
    highlightingEnabled: initial.highlightingEnabled
  }

  const backdrop = document.createElement('div')
  backdrop.className = 'settings-backdrop hidden'
  backdrop.innerHTML = `
    <div class="settings-panel" role="dialog" aria-labelledby="settings-title">
      <header class="settings-header">
        <h2 id="settings-title">Syntax colours</h2>
        <button type="button" class="settings-close" id="settings-close" aria-label="Close">×</button>
      </header>
      <div class="settings-body">
        <p class="settings-hint" id="settings-hint">
          Colours apply to the editor only. Preview stays black-and-white for print fidelity.
        </p>
        <label class="settings-row">
          <span id="settings-preset-label">Preset</span>
          <select id="settings-preset">
            <option value="default">Default</option>
            <option value="highContrast">High contrast</option>
            <option value="soft">Soft</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <div class="settings-colors" id="settings-colors"></div>
        <div class="settings-actions">
          <button type="button" id="settings-reset">Reset to default</button>
        </div>
      </div>
    </div>
  `
  parent.appendChild(backdrop)

  const panel = backdrop.querySelector('.settings-panel') as HTMLElement
  const presetSelect = backdrop.querySelector('#settings-preset') as HTMLSelectElement
  const colorsEl = backdrop.querySelector('#settings-colors') as HTMLElement
  const closeBtn = backdrop.querySelector('#settings-close') as HTMLButtonElement
  const resetBtn = backdrop.querySelector('#settings-reset') as HTMLButtonElement

  panel.addEventListener('click', (e) => e.stopPropagation())
  backdrop.addEventListener('click', () => close())
  closeBtn.addEventListener('click', () => close())
  resetBtn.addEventListener('click', () => {
    state = {
      preset: 'default',
      custom: { ...SYNTAX_PRESET_DEFAULT },
      highlightingEnabled: state.highlightingEnabled
    }
    syncUi()
    emit()
  })

  presetSelect.addEventListener('change', () => {
    const preset = presetSelect.value as SyntaxColorPresetId
    if (preset !== 'custom' && SYNTAX_PRESETS[preset as keyof typeof SYNTAX_PRESETS]) {
      state = {
        ...state,
        preset,
        custom: { ...SYNTAX_PRESETS[preset as keyof typeof SYNTAX_PRESETS] }
      }
    } else {
      state = { ...state, preset: 'custom' }
    }
    syncUi()
    emit()
  })

  function currentPalette(): SyntaxColorPalette {
    if (state.preset === 'custom') return state.custom
    return SYNTAX_PRESETS[state.preset] ?? SYNTAX_PRESET_DEFAULT
  }

  function rebuildPickers(): void {
    const palette = currentPalette()
    colorsEl.innerHTML = ''
    for (const key of SYNTAX_COLOR_KEYS) {
      const row = document.createElement('label')
      row.className = 'settings-color-row'
      const label = document.createElement('span')
      label.textContent = SYNTAX_COLOR_LABELS[key]
      const input = document.createElement('input')
      input.type = 'color'
      input.value = toColorInput(palette[key])
      input.dataset.key = key
      input.addEventListener('input', () => {
        const k = input.dataset.key as SyntaxColorKey
        state = {
          ...state,
          preset: 'custom',
          custom: { ...currentPalette(), [k]: input.value }
        }
        presetSelect.value = 'custom'
        emit()
      })
      row.appendChild(label)
      row.appendChild(input)
      colorsEl.appendChild(row)
    }
  }

  function syncUi(): void {
    presetSelect.value = state.preset
    rebuildPickers()
  }

  function emit(): void {
    onChange({
      preset: state.preset,
      custom: { ...state.custom },
      highlightingEnabled: state.highlightingEnabled
    })
  }

  function open(): void {
    syncUi()
    backdrop.classList.remove('hidden')
  }

  function close(): void {
    backdrop.classList.add('hidden')
  }

  function setLocale(loc: LocaleCode): void {
    locale = loc
    const title = backdrop.querySelector('#settings-title')
    if (title) title.textContent = t(locale, 'settings.syntaxColors')
    const hint = backdrop.querySelector('#settings-hint')
    if (hint) hint.textContent = t(locale, 'settings.syntaxHint')
    const pl = backdrop.querySelector('#settings-preset-label')
    if (pl) pl.textContent = t(locale, 'settings.preset')
    resetBtn.textContent = t(locale, 'settings.resetColors')
  }

  setLocale('en_GB')
  syncUi()

  return {
    open,
    close,
    setLocale,
    destroy: () => backdrop.remove()
  }
}

/** Normalize #rgb / #rrggbb for input[type=color]. */
function toColorInput(hex: string): string {
  const h = hex.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(h)) return h.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(h)) {
    const r = h[1],
      g = h[2],
      b = h[3]
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase()
  }
  return '#000000'
}
