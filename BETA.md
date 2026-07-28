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
| **`v1.0.0.0`** | First published **beta** GitHub Release (Linux / macOS / Windows installers) — frozen on `main` |

Installers: https://github.com/grahaminman/FilmScriptWriter/releases/tag/v1.0.0.0

## Branches

| Branch | Purpose |
|--------|---------|
| `main` | **v1.0.0.0 beta baseline** — what testers should install from Releases |
| **`v1.0.1`** | **Active development** after v1.0.0.0 (package version `1.0.1`) |
| `next` | Optional sandbox for larger experiments |

You are on the **`v1.0.1`** line when working on post-beta fixes and features. Merge back to `main` when ready for the next tagged release.

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
