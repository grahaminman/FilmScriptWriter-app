/**
 * Final Draft XML (.fdx) export.
 *
 * Produces a simplified but valid Final Draft 8+ compatible document.
 * Final Draft can open this XML and map Paragraph Type attributes to
 * its built-in styles (Scene Heading, Action, Character, Dialogue, etc.).
 *
 * Spec reference (community-documented):
 *   Final Draft XML uses a root <FinalDraft> element with <Content>
 *   containing <Paragraph Type="..."> nodes and nested <Text> runs.
 */

import { parseFountain } from '../fountain/parser'
import type { FountainDocument, FountainElement, TitlePage } from '../fountain/types'

/** Escape XML special characters in text nodes / attributes. */
export function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Map our element types to Final Draft Paragraph Type values. */
function fdxType(el: FountainElement): string | null {
  switch (el.type) {
    case 'scene_heading':
      return 'Scene Heading'
    case 'action':
      return 'Action'
    case 'character':
      return 'Character'
    case 'parenthetical':
      return 'Parenthetical'
    case 'dialogue':
    case 'lyrics':
      return 'Dialogue'
    case 'transition':
      return 'Transition'
    case 'centered':
      return 'Action' // Final Draft has no universal "Centered"; use Action
    default:
      return null
  }
}

function paragraphXml(type: string, text: string): string {
  // Final Draft expects Text inside Paragraph; empty paragraphs are allowed
  const content = escapeXml(text)
  return `  <Paragraph Type="${escapeXml(type)}">\n    <Text>${content}</Text>\n  </Paragraph>`
}

function titlePageXml(titlePage: TitlePage): string {
  const rows: string[] = []
  const add = (label: string, value: string | undefined): void => {
    if (!value) return
    rows.push(
      `    <Paragraph Type="Title Page Center">\n      <Text>${escapeXml(value)}</Text>\n    </Paragraph>`
    )
    // Label is implicit for common keys; Final Draft title pages vary.
    void label
  }

  add('Title', titlePage.title)
  add('Credit', titlePage.credit)
  add('Author', titlePage.author)
  add('Source', titlePage.source)
  add('Draft Date', titlePage.draftDate)
  add('Contact', titlePage.contact)
  add('Copyright', titlePage.copyright)

  for (const [k, v] of Object.entries(titlePage.extra)) {
    add(k, v)
  }

  if (rows.length === 0) return ''
  return `  <TitlePage>\n    <Content>\n${rows.join('\n')}\n    </Content>\n  </TitlePage>`
}

/**
 * Convert a parsed Fountain document to Final Draft XML string.
 */
export function documentToFdx(doc: FountainDocument): string {
  const paragraphs: string[] = []

  for (const el of doc.elements) {
    if (el.type === 'page_break') {
      paragraphs.push(`  <Paragraph Type="Action">\n    <Text></Text>\n  </Paragraph>`)
      // Final Draft page breaks are typically inserted as page break elements;
      // a blank action is a safe portable fallback.
      continue
    }
    const type = fdxType(el)
    if (!type) continue
    paragraphs.push(paragraphXml(type, el.text))
  }

  // Ensure at least one paragraph so Final Draft opens a valid empty script
  if (paragraphs.length === 0) {
    paragraphs.push(paragraphXml('Action', ''))
  }

  const title = titlePageXml(doc.titlePage)
  const header = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<FinalDraft DocumentType="Script" Template="No" Version="1">
${title}
  <Content>
${paragraphs.join('\n')}
  </Content>
</FinalDraft>
`
  return header
}

/**
 * Convert raw Fountain source to Final Draft XML.
 */
export function fountainToFdx(source: string): string {
  return documentToFdx(parseFountain(source))
}
