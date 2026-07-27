# Fountain fidelity (fountain.io)

FilmScriptWriter implements **Fountain 1.1** syntax for parsing and screenplay
formatting (preview + PDF). This document records what matches the
[official syntax](https://fountain.io/syntax) and what remains limited.

## Implemented to match fountain.io

| Feature | Behaviour |
|--------|-----------|
| Scene headings | INT/EXT/… and forced `.Heading` |
| Action | Default paragraphs; forced `!` |
| Character | Uppercase cues; forced `@Name` **keeps mixed case** |
| Dialogue / parenthetical | After character |
| Dual dialogue | Second cue ends with `^` → **side‑by‑side columns** in preview & PDF |
| Emphasis | `*italic*` `**bold**` `***both***` `_underline_` (markers hidden in print) |
| Escapes | `\*` `\_` etc. |
| Transitions | `TO:` and forced `>` |
| Centered | `>TEXT<` |
| Lyrics | `~line` (italic in preview) |
| Notes | `[[…]]` omitted from print |
| Boneyard | `/* … */` omitted from print |
| Sections / synopses | `#` / `=` outlining only (not printed) |
| Page breaks | `===` |
| Title page | `Key: value` block |

## Known limitations (set expectations)

1. **Emphasis across line breaks** — Spec: emphasis does not span lines. We follow that; multi-line italics need markers on each line.
2. **Complex nested emphasis** — Common nestings work; pathological nesting may fall back to plain text in PDF when a line wraps with mixed styles.
3. **PDF mixed-style wrapping** — Multi-font emphasis on a *wrapping* dialogue line may render as plain stripped text so line breaks stay correct. Single-line mixed emphasis uses Courier Bold/Oblique.
4. **Dual dialogue page-breaking** — Columns share vertical space visually; very tall dual blocks are not split mid-column across pages like Final Draft.
5. **Scene numbers (`#1#`)** — Preserved as text on the scene heading line (not a separate right-margin element).
6. **Title page print layout** — Title page keys are parsed for metadata/PDF info; a full separate title *page* graphic is not always produced.
7. **Typography** — Spec keeps typewriter quotes/dashes; we do not smart-replace punctuation.
8. **Not Fountain.js** — Engine is first-party TypeScript aligned to fountain.io, not a fork of Fountain.js.

## Find & replace wildcards

In Find / Replace, unescaped `*` and `?` are treated as **simple wildcards**
(not regex quantifiers):

| Pattern | Matches |
|---------|---------|
| `#*#` | `#1#`, `#2A#`, `#110#` |
| `INT.*DAY` | only if you enable full regex yourself |
| `file?.txt` | `fileA.txt`, `file1.txt` |

So replacing `#*#` with empty removes whole scene-number tokens, not each `#`.
