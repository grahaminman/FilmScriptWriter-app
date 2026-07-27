/**
 * Starter template management.
 *
 * The FilmScriptWriter starter template is:
 *  - Bundled with the app under resources/templates/ (read-only source)
 *  - Mirrored into the user's Documents/FilmScriptWriter/templates/ folder
 *    so it remains visible in the filesystem after packaging
 *  - Never used as the active document path — content is always loaded as
 *    an untitled buffer so Save / Save As cannot overwrite the template
 */

import { app } from 'electron'
import * as fs from 'fs/promises'
import * as path from 'path'
import { pathExists } from './path-exists'

/** Canonical template file name (must match files under resources/templates). */
export const STARTER_TEMPLATE_NAME = 'FilmScriptWriter-Starter.fountain'

/**
 * Resolve the bundled template path (dev vs packaged).
 */
export function getBundledTemplatePath(): string {
  // Packaged: extraResources copies `resources/` → process.resourcesPath/resources
  // Dev: project root resources/templates
  if (app.isPackaged) {
    return path.join(
      process.resourcesPath,
      'resources',
      'templates',
      STARTER_TEMPLATE_NAME
    )
  }
  // electron-vite / project root
  return path.join(
    app.getAppPath(),
    'resources',
    'templates',
    STARTER_TEMPLATE_NAME
  )
}

/**
 * User-visible templates directory (Documents/FilmScriptWriter/templates).
 */
export function getUserTemplatesDir(): string {
  return path.join(app.getPath('documents'), 'FilmScriptWriter', 'templates')
}

/**
 * Full path to the user-facing starter template copy.
 */
export function getUserTemplatePath(): string {
  return path.join(getUserTemplatesDir(), STARTER_TEMPLATE_NAME)
}

/**
 * True if `filePath` is the bundled or user starter template (must not be overwritten).
 */
export function isProtectedTemplatePath(filePath: string | null | undefined): boolean {
  if (!filePath) return false
  const resolved = path.resolve(filePath)
  const candidates = [getBundledTemplatePath(), getUserTemplatePath()].map((p) => {
    try {
      return path.resolve(p)
    } catch {
      return p
    }
  })
  return candidates.some((c) => c === resolved)
}

/**
 * Ensure the user templates folder exists and contains a copy of the starter.
 * Existing user copy is left untouched so personal edits (if any) are preserved.
 * Missing file is re-created from the bundled original.
 */
export async function ensureUserTemplateAvailable(): Promise<string> {
  const dir = getUserTemplatesDir()
  await fs.mkdir(dir, { recursive: true })

  const dest = getUserTemplatePath()
  const already = await pathExists(dest)
  if (!already) {
    const src = getBundledTemplatePath()
    try {
      await fs.copyFile(src, dest)
    } catch (err) {
      // Fall back: write embedded minimal content if bundle path fails
      console.warn('[template] could not copy bundled template:', err)
      await fs.writeFile(dest, await loadTemplateContent(), 'utf8')
    }
  }
  return dest
}

/**
 * Read starter template text. Tries bundled path, then user copy, then fallback.
 */
export async function loadTemplateContent(): Promise<string> {
  const candidates = [getBundledTemplatePath(), getUserTemplatePath()]
  for (const p of candidates) {
    try {
      const text = await fs.readFile(p, 'utf8')
      if (text.trim().length > 0) return text
    } catch {
      /* try next */
    }
  }
  return FALLBACK_TEMPLATE
}

/**
 * Minimal inline fallback if all filesystem copies are missing.
 */
const FALLBACK_TEMPLATE = `Title: FilmScriptWriter Starter Template
Author: Your Name
Draft date: 2026-01-01

# Getting started

= This is a starter template. Use Save As to keep the original.

INT. ROOM - DAY

Action describes what we see.

WRITER
Dialogue goes here.

FADE OUT.
`
