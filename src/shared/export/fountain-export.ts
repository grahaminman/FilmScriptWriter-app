/**
 * Fountain re-export helpers.
 *
 * Saving as .fountain is essentially a pass-through of the editor buffer,
 * but we normalise line endings to LF and ensure a trailing newline for
 * POSIX-friendly files.
 */

/**
 * Prepare editor text for writing as a .fountain / .txt file.
 */
export function prepareFountainExport(source: string): string {
  const normalised = source.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  if (normalised.length === 0) return '\n'
  return normalised.endsWith('\n') ? normalised : normalised + '\n'
}
