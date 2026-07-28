# FilmScriptWriter — Beta notice

**This software is a beta / early preview.**

It is shared so testers can try Fountain editing, export, and packaging. It is **not** a finished product.

## What “beta” means here

- Features may change or break between builds
- Bugs are expected; please report them with steps to reproduce
- Installers may be **unsigned** (Windows SmartScreen / macOS Gatekeeper may warn)
- Do not rely on it for critical production deadlines without your own backups

## Releases

| Tag | Status |
|-----|--------|
| **`v1.0.0.0`** | First published **beta** GitHub Release (Linux / macOS / Windows installers) |

Installers ship as a **pre-release** on GitHub: https://github.com/grahaminman/FilmScriptWriter-app/releases

## Branches

| Branch | Purpose |
|--------|---------|
| `main` | Current **beta** line — what CI builds and what testers should use (`v1.0.0.0` baseline) |
| `v1.0.1` | Follow-up development after the v1.0.0.0 beta release |
| `next` | Optional sandbox for larger experiments |

When the beta is good enough, keep shipping fixes on `main` (or promote a stable tag). Use `v1.0.1` / `next` for work that should not confuse beta testers.

## Reporting issues

Open a GitHub Issue on this repository with:

1. OS and app version (`Help → About`)
2. What you did
3. What you expected
4. What happened instead

## Building installers (CI)

GitHub Actions workflow: `.github/workflows/build.yml`

- **Tests** run on every pull request to `main`
- **Installers** (Linux / Windows / macOS) build on tag `v*` or **Actions → Build installers (beta) → Run workflow**

Download artifacts from the completed workflow run.
