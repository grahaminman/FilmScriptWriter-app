/**
 * Live paginated screenplay preview.
 *
 * Uses the same pagination algorithm and margin constants as PDF export
 * so what you see matches the printed page — including blank lines.
 * Supports scrolling to a source line when "preview follows editor" is on.
 */

import {
  CHARACTER_LEFT_IN,
  DIALOGUE_LEFT_IN,
  LINE_HEIGHT_PT,
  MARGIN_LEFT_IN,
  MARGIN_RIGHT_IN,
  PAGE_HEIGHT_IN,
  PAGE_WIDTH_IN,
  PARENTHETICAL_LEFT_IN
} from '../../shared/constants/screenplay'
import { paginateSource } from '../../shared/fountain/page-counter'
import type { LayoutLine, ScreenplayPage } from '../../shared/fountain/types'
import { t } from '../../shared/i18n/locales'
import type { LocaleCode } from '../../shared/constants/screenplay'

/** CSS inches helper for inline styles. */
function inch(n: number): string {
  return `${n}in`
}

/** One screenplay line in CSS (matches PDF LINE_HEIGHT_PT). */
function lineHeightCss(): string {
  return `${LINE_HEIGHT_PT}pt`
}

function lineClass(line: LayoutLine): string {
  if (line.isSpacer || line.type === 'empty') return 'sp-line sp-spacer'
  return `sp-line sp-${line.type}`
}

function lineStyle(line: LayoutLine): string {
  if (line.isSpacer || line.type === 'empty') {
    const h = lineHeightCss()
    return `height:${h};min-height:${h};line-height:${h};`
  }
  switch (line.type) {
    case 'character':
      return `margin-left:${inch(CHARACTER_LEFT_IN - MARGIN_LEFT_IN)};`
    case 'parenthetical':
      return `margin-left:${inch(PARENTHETICAL_LEFT_IN - MARGIN_LEFT_IN)}; max-width:${inch(PAGE_WIDTH_IN - PARENTHETICAL_LEFT_IN - 2)};`
    case 'dialogue':
    case 'lyrics':
      return `margin-left:${inch(DIALOGUE_LEFT_IN - MARGIN_LEFT_IN)}; max-width:${inch(PAGE_WIDTH_IN - DIALOGUE_LEFT_IN - 1.5)};`
    case 'transition':
      return 'text-align:right;'
    case 'centered':
      return 'text-align:center;'
    case 'scene_heading':
      return 'font-weight:700; text-transform:uppercase;'
    default:
      return ''
  }
}

function renderPage(page: ScreenplayPage): string {
  const lines = page.lines
    .map((line) => {
      if (line.type === 'page_break') return ''

      const srcAttr =
        line.sourceLine !== undefined
          ? ` data-source-line="${line.sourceLine}"`
          : ''

      if (line.isSpacer || line.type === 'empty') {
        return `<div class="${lineClass(line)}" style="${lineStyle(line)}"${srcAttr} aria-hidden="true">&nbsp;</div>`
      }

      const text = escapeHtml(line.text).replace(/\n/g, '<br>')
      return `<div class="${lineClass(line)}" style="${lineStyle(line)}"${srcAttr}>${text || '&nbsp;'}</div>`
    })
    .join('')

  return `
    <article class="sp-page" data-page="${page.pageNumber}" aria-label="Page ${page.pageNumber}">
      <div class="sp-page-number">${page.pageNumber}.</div>
      <div class="sp-page-body">${lines}</div>
    </article>
  `
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface PreviewHandle {
  render: (source: string) => void
  setLocale: (locale: LocaleCode) => void
  /** Scroll preview so the block for source line (1-based editor line) is visible. */
  scrollToSourceLine: (editorLine1Based: number) => void
  setZoom: (scale: number) => void
  getPageCount: () => number
  getWordCount: () => number
}

/**
 * Mount the live preview into a container element.
 */
export function createPreview(container: HTMLElement, locale: LocaleCode): PreviewHandle {
  let currentLocale = locale
  let pageCount = 1
  let wordCount = 0
  let zoom = 1

  const header = document.createElement('div')
  header.className = 'preview-header'
  header.innerHTML = `<span class="preview-title"></span>`
  container.appendChild(header)

  const scroll = document.createElement('div')
  scroll.className = 'preview-scroll'
  container.appendChild(scroll)

  const setTitle = (): void => {
    const el = header.querySelector('.preview-title')
    if (el) el.textContent = t(currentLocale, 'preview.title')
  }
  setTitle()

  const applyZoom = (): void => {
    scroll.style.setProperty('--preview-zoom', String(zoom))
    for (const page of scroll.querySelectorAll<HTMLElement>('.sp-page')) {
      page.style.setProperty('--preview-zoom', String(zoom))
    }
  }

  const render = (source: string): void => {
    const result = paginateSource(source)
    pageCount = result.pageCount
    wordCount = result.wordCount

    if (!source.trim()) {
      scroll.innerHTML = `<div class="preview-empty">${escapeHtml(t(currentLocale, 'preview.empty'))}</div>`
      return
    }

    scroll.innerHTML = result.pages.map(renderPage).join('')
    applyZoom()
  }

  const scrollToSourceLine = (editorLine1Based: number): void => {
    // Layout stores 0-based source lines
    const zero = Math.max(0, editorLine1Based - 1)
    let target = scroll.querySelector<HTMLElement>(
      `[data-source-line="${zero}"]`
    )
    // Walk backwards if this exact line is a blank that wasn't tagged tightly
    if (!target) {
      for (let i = zero; i >= 0 && i > zero - 30; i--) {
        target = scroll.querySelector<HTMLElement>(`[data-source-line="${i}"]`)
        if (target) break
      }
    }
    if (!target) return

    // Highlight briefly
    scroll
      .querySelectorAll('.sp-line.sp-follow-active')
      .forEach((n) => n.classList.remove('sp-follow-active'))
    target.classList.add('sp-follow-active')

    target.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  // Initial empty state
  render('')

  return {
    render,
    setLocale: (loc: LocaleCode) => {
      currentLocale = loc
      setTitle()
    },
    scrollToSourceLine,
    setZoom: (scale: number) => {
      zoom = Math.min(1.6, Math.max(0.7, scale))
      applyZoom()
    },
    getPageCount: () => pageCount,
    getWordCount: () => wordCount
  }
}

// Expose page dimensions as CSS custom properties for the stylesheet
export function applyPageCssVars(root: HTMLElement = document.documentElement): void {
  root.style.setProperty('--sp-page-width', inch(PAGE_WIDTH_IN))
  root.style.setProperty('--sp-page-height', inch(PAGE_HEIGHT_IN))
  root.style.setProperty('--sp-margin-left', inch(MARGIN_LEFT_IN))
  root.style.setProperty('--sp-margin-right', inch(MARGIN_RIGHT_IN))
  root.style.setProperty('--sp-line-height', `${LINE_HEIGHT_PT}pt`)
}
