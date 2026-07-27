/**
 * Hollywood-format PDF export using PDFKit.
 *
 * Matches live preview: emphasis, dual dialogue columns, forced @ names.
 */

import PDFDocument from 'pdfkit'
import {
  CHARACTER_LEFT_IN,
  DIALOGUE_LEFT_IN,
  DIALOGUE_RIGHT_IN,
  FONT_SIZE_PT,
  LINE_HEIGHT_PT,
  MARGIN_BOTTOM_IN,
  MARGIN_LEFT_IN,
  MARGIN_RIGHT_IN,
  MARGIN_TOP_IN,
  PAGE_HEIGHT_IN,
  PAGE_NUMBER_RIGHT_IN,
  PAGE_NUMBER_TOP_IN,
  PAGE_WIDTH_IN,
  PARENTHETICAL_LEFT_IN,
  PARENTHETICAL_RIGHT_IN,
  POINTS_PER_INCH,
  TRANSITION_RIGHT_IN,
  inchesToPoints
} from '../constants/screenplay'
import { emphasisToRuns, type EmphasisRun } from '../fountain/emphasis'
import { parseFountain } from '../fountain/parser'
import { paginateDocument } from '../fountain/page-counter'
import type { LayoutLine, ScreenplayPage } from '../fountain/types'

export interface PdfExportOptions {
  title?: string
  author?: string
}

function geometryFor(
  type: LayoutLine['type'],
  dualColumn?: 'left' | 'right'
): { x: number; width: number; align: 'left' | 'right' | 'center' } {
  const pageW = inchesToPoints(PAGE_WIDTH_IN)
  const leftM = inchesToPoints(MARGIN_LEFT_IN)
  const rightM = inchesToPoints(MARGIN_RIGHT_IN)
  const bodyW = pageW - leftM - rightM

  if (dualColumn === 'left') {
    return { x: leftM, width: bodyW * 0.48, align: type === 'character' ? 'center' : 'left' }
  }
  if (dualColumn === 'right') {
    return {
      x: leftM + bodyW * 0.52,
      width: bodyW * 0.48,
      align: type === 'character' ? 'center' : 'left'
    }
  }

  switch (type) {
    case 'character':
      return {
        x: inchesToPoints(CHARACTER_LEFT_IN),
        width: pageW - inchesToPoints(CHARACTER_LEFT_IN) - rightM,
        align: 'left'
      }
    case 'parenthetical':
      return {
        x: inchesToPoints(PARENTHETICAL_LEFT_IN),
        width:
          pageW -
          inchesToPoints(PARENTHETICAL_LEFT_IN) -
          inchesToPoints(PARENTHETICAL_RIGHT_IN),
        align: 'left'
      }
    case 'dialogue':
    case 'lyrics':
      return {
        x: inchesToPoints(DIALOGUE_LEFT_IN),
        width: pageW - inchesToPoints(DIALOGUE_LEFT_IN) - inchesToPoints(DIALOGUE_RIGHT_IN),
        align: 'left'
      }
    case 'transition':
      return {
        x: leftM,
        width: pageW - leftM - inchesToPoints(TRANSITION_RIGHT_IN),
        align: 'right'
      }
    case 'centered':
      return { x: leftM, width: bodyW, align: 'center' }
    case 'scene_heading':
    case 'action':
    default:
      return { x: leftM, width: bodyW, align: 'left' }
  }
}

function fontForRun(run: EmphasisRun): string {
  const b = Boolean(run.style.bold)
  const i = Boolean(run.style.italic)
  if (b && i) return 'Courier-BoldOblique'
  if (b) return 'Courier-Bold'
  if (i) return 'Courier-Oblique'
  return 'Courier'
}

/**
 * Draw styled Fountain text (emphasis) at a fixed position.
 * Underline is simulated with a line under each run.
 */
function drawEmphasizedText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  align: 'left' | 'right' | 'center',
  lineCount: number
): number {
  const runs = emphasisToRuns(text)
  const plain = runs.map((r) => r.text).join('')
  if (!plain) {
    return y + lineCount * LINE_HEIGHT_PT
  }

  // Single-run fast path
  if (runs.length === 1 && !runs[0].style.bold && !runs[0].style.italic && !runs[0].style.underline) {
    doc.font('Courier').fontSize(FONT_SIZE_PT)
    doc.text(plain, x, y, {
      width,
      align,
      lineGap: 0,
      lineBreak: true,
      height: lineCount * LINE_HEIGHT_PT + 1
    })
    return y + lineCount * LINE_HEIGHT_PT
  }

  // Multi-style: draw run-by-run on one line when short; otherwise plain fallback
  // PDFKit continued text for mixed styles is awkward for wrapping — use plain stripped
  // when the line is long, and mixed fonts when it fits one line.
  doc.font('Courier').fontSize(FONT_SIZE_PT)
  const plainWidth = doc.widthOfString(plain)
  if (plainWidth > width * 0.98 || plain.includes('\n')) {
    doc.text(plain, x, y, {
      width,
      align,
      lineGap: 0,
      lineBreak: true,
      height: lineCount * LINE_HEIGHT_PT + 1
    })
    return y + lineCount * LINE_HEIGHT_PT
  }

  let cursorX = x
  if (align === 'center') {
    cursorX = x + (width - plainWidth) / 2
  } else if (align === 'right') {
    cursorX = x + width - plainWidth
  }

  for (const run of runs) {
    if (!run.text) continue
    doc.font(fontForRun(run)).fontSize(FONT_SIZE_PT)
    const w = doc.widthOfString(run.text)
    doc.text(run.text, cursorX, y, { lineBreak: false, continued: false })
    if (run.style.underline) {
      doc
        .moveTo(cursorX, y + FONT_SIZE_PT + 1)
        .lineTo(cursorX + w, y + FONT_SIZE_PT + 1)
        .stroke()
    }
    cursorX += w
  }

  return y + lineCount * LINE_HEIGHT_PT
}

function drawPage(
  doc: PDFKit.PDFDocument,
  page: ScreenplayPage,
  isFirst: boolean
): void {
  if (!isFirst) {
    doc.addPage()
  }

  const pageNumX =
    inchesToPoints(PAGE_WIDTH_IN) - inchesToPoints(PAGE_NUMBER_RIGHT_IN)
  const pageNumY = inchesToPoints(PAGE_NUMBER_TOP_IN)
  doc
    .font('Courier')
    .fontSize(FONT_SIZE_PT)
    .text(`${page.pageNumber}.`, pageNumX - 40, pageNumY, {
      width: 40,
      align: 'right',
      lineBreak: false
    })

  let y = inchesToPoints(MARGIN_TOP_IN)
  const bottomLimit =
    inchesToPoints(PAGE_HEIGHT_IN) - inchesToPoints(MARGIN_BOTTOM_IN)

  const lines = page.lines
  let i = 0

  while (i < lines.length) {
    const line = lines[i]
    if (line.type === 'page_break') {
      i += 1
      continue
    }

    if (line.isSpacer || line.type === 'empty') {
      y += LINE_HEIGHT_PT * Math.max(1, line.lineCount)
      i += 1
      continue
    }

    if (y > bottomLimit) break

    // Dual dialogue: draw left and right columns sharing vertical space
    if (line.dualGroup != null && line.dualColumn === 'left') {
      const group = line.dualGroup
      const left: LayoutLine[] = []
      const right: LayoutLine[] = []
      while (
        i < lines.length &&
        lines[i].dualGroup === group &&
        lines[i].dualColumn === 'left'
      ) {
        left.push(lines[i])
        i += 1
      }
      while (
        i < lines.length &&
        (lines[i].isSpacer || lines[i].type === 'empty')
      ) {
        i += 1
      }
      while (
        i < lines.length &&
        lines[i].dualGroup === group &&
        lines[i].dualColumn === 'right'
      ) {
        right.push(lines[i])
        i += 1
      }
      const yStart = y
      let yLeft = yStart
      let yRight = yStart
      for (const L of left) {
        if (L.isSpacer || L.type === 'empty') continue
        const g = geometryFor(L.type, 'left')
        yLeft = drawEmphasizedText(
          doc,
          L.text || ' ',
          g.x,
          yLeft,
          g.width,
          g.align,
          Math.max(1, L.lineCount)
        )
      }
      for (const R of right) {
        if (R.isSpacer || R.type === 'empty') continue
        const g = geometryFor(R.type, 'right')
        yRight = drawEmphasizedText(
          doc,
          R.text || ' ',
          g.x,
          yRight,
          g.width,
          g.align,
          Math.max(1, R.lineCount)
        )
      }
      y = Math.max(yLeft, yRight)
      continue
    }

    if (line.dualGroup != null && line.dualColumn === 'right') {
      // Already consumed with left; skip orphans
      i += 1
      continue
    }

    const { x, width, align } = geometryFor(line.type, line.dualColumn)
    const text = line.text ?? ''
    const lc = Math.max(1, line.lineCount)
    y = drawEmphasizedText(doc, text, x, y, width, align, lc)
    i += 1
  }
}

export function fountainToPdf(
  source: string,
  options: PdfExportOptions = {}
): Promise<Buffer> {
  const parsed = parseFountain(source)
  const pagination = paginateDocument(parsed)

  const title =
    options.title ||
    parsed.titlePage.title ||
    'Untitled Screenplay'
  const author = options.author || parsed.titlePage.author || ''

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: [
          inchesToPoints(PAGE_WIDTH_IN),
          inchesToPoints(PAGE_HEIGHT_IN)
        ],
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
        info: {
          Title: title,
          Author: author,
          Creator: 'FilmScriptWriter',
          Producer: 'FilmScriptWriter'
        },
        autoFirstPage: true,
        bufferPages: true
      })

      const chunks: Buffer[] = []
      doc.on('data', (chunk: Buffer) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const pages = pagination.pages
      if (pages.length === 0) {
        doc.font('Courier').fontSize(FONT_SIZE_PT).text('')
      } else {
        pages.forEach((page, idx) => drawPage(doc, page, idx === 0))
      }

      doc.end()
    } catch (err) {
      reject(err)
    }
  })
}

export { POINTS_PER_INCH }
