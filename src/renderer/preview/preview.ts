/**
 * Live paginated screenplay preview.
 *
 * Uses the same pagination algorithm and margin constants as PDF export.
 * Renders fountain.io emphasis, dual dialogue columns, and forced @ names.
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
import { emphasisToHtml } from '../../shared/fountain/emphasis'
import { paginateSource } from '../../shared/fountain/page-counter'
import type { LayoutLine, ScreenplayPage } from '../../shared/fountain/types'
import { t } from '../../shared/i18n/locales'
import type { LocaleCode } from '../../shared/constants/screenplay'

function inch(n: number): string {
  return `${n}in`
}

function lineHeightCss(): string {
  return `${LINE_HEIGHT_PT}pt`
}

function lineClass(line: LayoutLine): string {
  if (line.isSpacer || line.type === 'empty') return 'sp-line sp-spacer'
  const dual =
    line.dualColumn === 'left'
      ? ' sp-dual-left'
      : line.dualColumn === 'right'
        ? ' sp-dual-right'
        : ''
  return `sp-line sp-${line.type}${dual}`
}

function lineStyle(line: LayoutLine): string {
  if (line.isSpacer || line.type === 'empty') {
    const h = lineHeightCss()
    return `height:${h};min-height:${h};line-height:${h};`
  }
  // Dual columns use flex layout — no classic left margins
  if (line.dualColumn) {
    if (line.type === 'character') return 'font-weight:700; text-align:center;'
    if (line.type === 'parenthetical') return 'font-style:italic; text-align:center;'
    if (line.type === 'lyrics') return 'font-style:italic;'
    return ''
  }
  switch (line.type) {
    case 'character':
      return `margin-left:${inch(CHARACTER_LEFT_IN - MARGIN_LEFT_IN)}; font-weight:700;`
    case 'parenthetical':
      return `margin-left:${inch(PARENTHETICAL_LEFT_IN - MARGIN_LEFT_IN)}; max-width:${inch(PAGE_WIDTH_IN - PARENTHETICAL_LEFT_IN - 2)}; font-style:italic;`
    case 'dialogue':
      return `margin-left:${inch(DIALOGUE_LEFT_IN - MARGIN_LEFT_IN)}; max-width:${inch(PAGE_WIDTH_IN - DIALOGUE_LEFT_IN - 1.5)};`
    case 'lyrics':
      return `margin-left:${inch(DIALOGUE_LEFT_IN - MARGIN_LEFT_IN)}; max-width:${inch(PAGE_WIDTH_IN - DIALOGUE_LEFT_IN - 1.5)}; font-style:italic;`
    case 'transition':
      return 'text-align:right; text-transform:uppercase;'
    case 'centered':
      return 'text-align:center;'
    case 'scene_heading':
      return 'font-weight:700; text-transform:uppercase;'
    default:
      return ''
  }
}

/** Format element text: emphasis → HTML; character forced case already in text. */
function formatLineHtml(line: LayoutLine): string {
  if (line.isSpacer || line.type === 'empty') return '&nbsp;'
  // Scene headings: uppercase display except we already uppercased non-forced
  if (line.type === 'scene_heading') {
    return emphasisToHtml(line.text)
  }
  if (line.type === 'character') {
    // Forced @ names keep mixed case; others are already upper in parser
    return escapeHtml(line.text)
  }
  return emphasisToHtml(line.text) || '&nbsp;'
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Render page lines, grouping dual-dialogue pairs into two-column rows.
 */
function renderPage(page: ScreenplayPage): string {
  const lines = page.lines
  const parts: string[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.type === 'page_break') {
      i += 1
      continue
    }

    // Start of a dual group (prefer left column first)
    if (line.dualGroup != null && line.dualColumn === 'left') {
      const group = line.dualGroup
      const left: LayoutLine[] = []
      const right: LayoutLine[] = []
      // Collect left column
      while (
        i < lines.length &&
        lines[i].dualGroup === group &&
        lines[i].dualColumn === 'left'
      ) {
        left.push(lines[i])
        i += 1
      }
      // Skip spacers between the two dialogue blocks
      while (
        i < lines.length &&
        (lines[i].isSpacer || lines[i].type === 'empty')
      ) {
        i += 1
      }
      // Collect right column
      while (
        i < lines.length &&
        lines[i].dualGroup === group &&
        lines[i].dualColumn === 'right'
      ) {
        right.push(lines[i])
        i += 1
      }
      parts.push(renderDualRow(left, right))
      continue
    }

    // Orphan right column (shouldn't happen often)
    if (line.dualGroup != null && line.dualColumn === 'right') {
      const group = line.dualGroup
      const right: LayoutLine[] = []
      while (i < lines.length && lines[i].dualGroup === group) {
        if (lines[i].dualColumn === 'right') right.push(lines[i])
        i += 1
      }
      parts.push(renderDualRow([], right))
      continue
    }

    const srcAttr =
      line.sourceLine !== undefined
        ? ` data-source-line="${line.sourceLine}"`
        : ''

    if (line.isSpacer || line.type === 'empty') {
      parts.push(
        `<div class="${lineClass(line)}" style="${lineStyle(line)}"${srcAttr} aria-hidden="true">&nbsp;</div>`
      )
    } else {
      parts.push(
        `<div class="${lineClass(line)}" style="${lineStyle(line)}"${srcAttr}>${formatLineHtml(line)}</div>`
      )
    }
    i += 1
  }

  return `
    <article class="sp-page" data-page="${page.pageNumber}" aria-label="Page ${page.pageNumber}">
      <div class="sp-page-number">${page.pageNumber}.</div>
      <div class="sp-page-body">${parts.join('')}</div>
    </article>
  `
}

function renderDualRow(left: LayoutLine[], right: LayoutLine[]): string {
  const col = (lines: LayoutLine[]): string =>
    lines
      .filter((l) => !l.isSpacer && l.type !== 'empty')
      .map((l) => {
        const srcAttr =
          l.sourceLine !== undefined
            ? ` data-source-line="${l.sourceLine}"`
            : ''
        return `<div class="${lineClass(l)}" style="${lineStyle(l)}"${srcAttr}>${formatLineHtml(l)}</div>`
      })
      .join('')

  const src =
    left[0]?.sourceLine ?? right[0]?.sourceLine
  const srcAttr = src !== undefined ? ` data-source-line="${src}"` : ''

  return `<div class="sp-dual"${srcAttr}><div class="sp-dual-col">${col(left)}</div><div class="sp-dual-col">${col(right)}</div></div>`
}

export interface PreviewHandle {
  render: (source: string) => void
  setLocale: (locale: LocaleCode) => void
  scrollToSourceLine: (editorLine1Based: number) => void
  setZoom: (scale: number) => void
  getPageCount: () => number
  getWordCount: () => number
}

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
    const zero = Math.max(0, editorLine1Based - 1)
    let target = scroll.querySelector<HTMLElement>(
      `[data-source-line="${zero}"]`
    )
    if (!target) {
      for (let i = zero; i >= 0 && i > zero - 30; i--) {
        target = scroll.querySelector<HTMLElement>(`[data-source-line="${i}"]`)
        if (target) break
      }
    }
    if (!target) return

    scroll
      .querySelectorAll('.sp-line.sp-follow-active, .sp-dual.sp-follow-active')
      .forEach((n) => n.classList.remove('sp-follow-active'))
    target.classList.add('sp-follow-active')
    target.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

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

export function applyPageCssVars(root: HTMLElement = document.documentElement): void {
  root.style.setProperty('--sp-page-width', inch(PAGE_WIDTH_IN))
  root.style.setProperty('--sp-page-height', inch(PAGE_HEIGHT_IN))
  root.style.setProperty('--sp-margin-left', inch(MARGIN_LEFT_IN))
  root.style.setProperty('--sp-margin-right', inch(MARGIN_RIGHT_IN))
  root.style.setProperty('--sp-line-height', `${LINE_HEIGHT_PT}pt`)
}
