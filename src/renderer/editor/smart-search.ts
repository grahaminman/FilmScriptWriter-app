/**
 * Smart find/replace: treat unescaped * and ? as simple wildcards
 * (user expectation for patterns like #*# → #1#, #2#, …).
 *
 * CodeMirror’s regex mode treats * as “repeat previous atom”, so #*#
 * only matches # characters and replace-all strips hashes while leaving digits.
 * We rewrite such queries to real regex (#.*#) when appropriate.
 */

import {
  search,
  setSearchQuery,
  SearchQuery,
  type SearchQuery as SearchQueryType
} from '@codemirror/search'
import { EditorState, type Extension } from '@codemirror/state'

function hasUnescapedWildcard(s: string): boolean {
  let escaped = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (escaped) {
      escaped = false
      continue
    }
    if (c === '\\') {
      escaped = true
      continue
    }
    if (c === '*' || c === '?') return true
  }
  return false
}

/**
 * Convert a simple glob pattern to a RegExp source string.
 * * → any characters (including none)
 * ? → any single character
 * Other regex metacharacters are escaped.
 */
export function globToRegExpSource(glob: string): string {
  let out = ''
  let escaped = false
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i]
    if (escaped) {
      out += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      // If user wrote \*, keep literal *
      escaped = false
      continue
    }
    if (c === '\\') {
      escaped = true
      continue
    }
    if (c === '*') {
      out += '.*'
      continue
    }
    if (c === '?') {
      out += '.'
      continue
    }
    if (/[.+^${}()|[\]\\]/.test(c)) {
      out += '\\' + c
      continue
    }
    out += c
  }
  if (escaped) out += '\\\\'
  return out
}

function rewriteQuery(q: SearchQueryType): SearchQueryType | null {
  // Only rewrite when the user is NOT already in full regex mode
  if (q.regexp) return null
  if (!q.search || !hasUnescapedWildcard(q.search)) return null

  const source = globToRegExpSource(q.search)
  try {
    // Validate
    void new RegExp(source, q.caseSensitive ? 'g' : 'gi')
  } catch {
    return null
  }

  return new SearchQuery({
    search: source,
    caseSensitive: q.caseSensitive,
    literal: true,
    regexp: true,
    replace: q.replace,
    wholeWord: q.wholeWord
  })
}

/**
 * Search extension with top panel + wildcard rewriting for find/replace.
 */
export function smartSearch(): Extension {
  return [
    search({
      top: true,
      // literal: avoid auto-interpreting \n in the replace string as special
      // when not using regex — wildcards still get rewritten below
      literal: true
    }),
    EditorState.transactionFilter.of((tr) => {
      const rewritten: ReturnType<typeof setSearchQuery.of>[] = []
      for (const e of tr.effects) {
        if (e.is(setSearchQuery)) {
          const next = rewriteQuery(e.value)
          if (next) {
            rewritten.push(setSearchQuery.of(next))
          }
        }
      }
      if (rewritten.length === 0) return tr
      // Apply original transaction then override with rewritten query
      return [tr, { effects: rewritten }]
    })
  ]
}
