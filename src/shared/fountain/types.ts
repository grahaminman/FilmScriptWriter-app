/**
 * Fountain document element types used across parsing, pagination,
 * preview, and export pipelines.
 */

/** Logical element kinds produced by the Fountain parser. */
export type ElementType =
  | 'scene_heading'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'transition'
  | 'centered'
  | 'page_break'
  | 'section'
  | 'synopsis'
  | 'note'
  | 'boneyard'
  | 'title_page_key'
  | 'empty'
  | 'lyrics'
  /** Layout-only: two dialogue columns side by side (fountain.io dual dialogue). */
  | 'dual_dialogue'

/** A single parsed screenplay element. */
export interface FountainElement {
  /** Element kind. */
  type: ElementType
  /** Visible text content ( Fountain markup stripped where appropriate ). */
  text: string
  /** Original source line index (0-based), useful for editor sync. */
  lineIndex: number
  /**
   * Dual-dialogue marker: when true this character/dialogue belongs to a
   * dual-dialogue pair (Fountain uses `^` after the character name).
   */
  dual?: boolean
  /**
   * For title-page keys, the key name (e.g. "Title", "Author").
   */
  key?: string
  /**
   * True when a forced element was created with Fountain force prefixes
   * (`.` scene, `@` character, `!` action, `>` transition / centered).
   */
  forced?: boolean
}

/** Title page key/value pairs. */
export interface TitlePage {
  title?: string
  credit?: string
  author?: string
  source?: string
  draftDate?: string
  contact?: string
  copyright?: string
  notes?: string
  /** Any additional free-form keys. */
  extra: Record<string, string>
}

/** Fully parsed Fountain document. */
export interface FountainDocument {
  titlePage: TitlePage
  elements: FountainElement[]
  /** Raw source text (unchanged). */
  raw: string
}

/** A single line ready for layout / PDF / preview. */
export interface LayoutLine {
  type: ElementType
  text: string
  /** Estimated vertical space in body-lines (usually 1). */
  lineCount: number
  /** Source element index for debugging / selection mapping. */
  elementIndex: number
  /**
   * 0-based source document line index (from the Fountain parser),
   * used so the live preview can follow the editor cursor.
   */
  sourceLine?: number
  /** Whether this is a forced blank spacer after a block. */
  isSpacer?: boolean
  /**
   * Dual-dialogue column (from fountain.io `^` on the second character).
   * When set, preview/PDF place left and right columns side by side.
   */
  dualColumn?: 'left' | 'right'
  /**
   * For dual dialogue, sibling lines in the other column share a dualGroup id
   * so the renderer can wrap a row.
   */
  dualGroup?: number
  /** Forced character (`@`) — mixed case preserved in print. */
  forced?: boolean
}

/** One paginated screenplay page. */
export interface ScreenplayPage {
  /** 1-based page number. */
  pageNumber: number
  lines: LayoutLine[]
}

/** Result of the pagination algorithm. */
export interface PaginationResult {
  pages: ScreenplayPage[]
  /** Total page count (at least 1 for empty docs). */
  pageCount: number
  /** Total word count across body elements (excludes notes/boneyard). */
  wordCount: number
}

/** Character memory entry used by autocomplete. */
export interface CharacterEntry {
  /** Canonical display name (UPPERCASE as stored). */
  name: string
  /** Number of times the character appears as a cue. */
  count: number
}
