/**
 * Hollywood-format PDF export using PDFKit.
 *
 * Layout matches `page-counter.ts` and the live preview:
 *  - US Letter
 *  - Courier 12 pt, fixed 12 pt leading (one screenplay line = 12 pt)
 *  - Standard margins and element indents
 *  - Blank spacer lines consume a full line of vertical space
 *  - Page numbers top-right
 *
 * This module runs in the Electron main process (Node) and returns a Buffer.
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
import { parseFountain } from '../fountain/parser'
import { paginateDocument } from '../fountain/page-counter'
import type { LayoutLine, ScreenplayPage } from '../fountain/types'

export interface PdfExportOptions {
  /** Document title for PDF metadata. */
  title?: string
  /** Author for PDF metadata. */
  author?: string
}

/**
 * Compute left X (points) and max width (points) for a layout line type.
 */
function geometryFor(
  type: LayoutLine['type']
): { x: number; width: number; align: 'left' | 'right' | 'center' } {
  const pageW = inchesToPoints(PAGE_WIDTH_IN)

  switch (type) {
    case 'character':
      return {
        x: inchesToPoints(CHARACTER_LEFT_IN),
        width: pageW - inchesToPoints(CHARACTER_LEFT_IN) - inchesToPoints(MARGIN_RIGHT_IN),
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
        width:
          pageW - inchesToPoints(DIALOGUE_LEFT_IN) - inchesToPoints(DIALOGUE_RIGHT_IN),
        align: 'left'
      }
    case 'transition':
      return {
        x: inchesToPoints(MARGIN_LEFT_IN),
        width:
          pageW - inchesToPoints(MARGIN_LEFT_IN) - inchesToPoints(TRANSITION_RIGHT_IN),
        align: 'right'
      }
    case 'centered':
      return {
        x: inchesToPoints(MARGIN_LEFT_IN),
        width:
          pageW - inchesToPoints(MARGIN_LEFT_IN) - inchesToPoints(MARGIN_RIGHT_IN),
        align: 'center'
      }
    case 'scene_heading':
    case 'action':
    default:
      return {
        x: inchesToPoints(MARGIN_LEFT_IN),
        width:
          pageW - inchesToPoints(MARGIN_LEFT_IN) - inchesToPoints(MARGIN_RIGHT_IN),
        align: 'left'
      }
  }
}

/**
 * Draw text at a fixed baseline using screenplay line-height steps.
 * We advance Y ourselves so blank lines and wrapped blocks stay on the grid.
 */
function drawTextBlock(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  width: number,
  align: 'left' | 'right' | 'center',
  lineCount: number
): number {
  // PDFKit's default leading does not match classic 12-pt screenplay lines.
  // Use an explicit lineGap so wrapped lines land on the same grid as spacers.
  const lineGap = LINE_HEIGHT_PT - FONT_SIZE_PT // 0 for 12/12, kept explicit

  doc.font('Courier').fontSize(FONT_SIZE_PT)
  doc.text(text.length > 0 ? text : ' ', x, y, {
    width,
    align,
    lineGap,
    lineBreak: true,
    // Prevent PDFKit from moving to a new page mid-block; we paginate ourselves
    height: lineCount * LINE_HEIGHT_PT + 1
  })

  // Always advance by the layout engine's line count so PDF and preview match
  return y + lineCount * LINE_HEIGHT_PT
}

/**
 * Draw a single screenplay page onto the PDF document.
 */
function drawPage(
  doc: PDFKit.PDFDocument,
  page: ScreenplayPage,
  isFirst: boolean
): void {
  if (!isFirst) {
    doc.addPage()
  }

  // Page number (top right) — standard screenplay position
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

  for (const line of page.lines) {
    if (line.type === 'page_break') continue

    // Blank / spacer: consume exactly one screenplay line of vertical space
    if (line.isSpacer || line.type === 'empty') {
      y += LINE_HEIGHT_PT * Math.max(1, line.lineCount)
      continue
    }

    if (y > bottomLimit) break

    const { x, width, align } = geometryFor(line.type)
    const text = line.text ?? ''
    const lines = Math.max(1, line.lineCount)

    y = drawTextBlock(doc, text, x, y, width, align, lines)
  }
}

/**
 * Generate a PDF Buffer from Fountain source text.
 */
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
      // Margins are handled manually so absolute Y spacing is exact.
      // PDFKit page margins would fight our line-grid positioning.
      const doc = new PDFDocument({
        size: [
          inchesToPoints(PAGE_WIDTH_IN),
          inchesToPoints(PAGE_HEIGHT_IN)
        ],
        margins: {
          top: 0,
          bottom: 0,
          left: 0,
          right: 0
        },
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

// Re-export points constant for tests
export { POINTS_PER_INCH }
