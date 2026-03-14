# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.
`AGENTS.md` is a symlink to this file, so both paths provide the same repository instructions.

## Project Overview

Wale is a web-based document editor — a reimagining of Kale (an Electron markdown editor) for the web. It's a prose-first writing app with inline comments, AI integration, and Git-like versioning, all backed by a database instead of a filesystem.

## Tech Stack

- **Frontend**: Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4
- **Editor**: TipTap (ProseMirror-based rich text editor) with StarterKit
- **Backend/DB**: Supabase (Postgres, Auth, Storage)
- **AI** (planned): Vercel AI SDK for model-agnostic LLM integration

## Project Structure

```
web/           — Next.js application (all frontend code lives here)
  app/         — App Router pages and layouts
  public/      — Static assets
supabase/      — Supabase local dev config and migrations
docs/plan.md   — Architecture plan and data model design
```

## Node Version

This project requires Node 22 for Node-related work. Use `./scripts/with-node.sh` from the `web/` directory for commands that depend on Node, such as `node`, `npm`, `npx`, or Next.js tooling. Do not use it for unrelated shell commands like `git`, `rg`, `ls`, or file operations.

The wrapper loads `nvm`, uses the version from the repo's `.nvmrc`, installs it if needed, and then runs the command without printing the full `nvm` bootstrap every time.

```bash
cd web
./scripts/with-node.sh npm run lint
```

## Commands

All commands run from the `web/` directory:

```bash
cd web
./scripts/with-node.sh npm run dev          # Start dev server (localhost:3000)
./scripts/with-node.sh npm run build        # Production build
./scripts/with-node.sh npm run lint         # ESLint (flat config, Next.js + TypeScript rules)
./scripts/with-node.sh npm run format       # Apply formatting (Prettier)
./scripts/with-node.sh npm run format:check # Check formatting (Prettier)
./scripts/with-node.sh npm run typecheck    # TypeScript type checking (tsc --noEmit)
./scripts/with-node.sh npm run start        # Start production server
```

After completing code changes, always run the linter and the formatter before handing off work. Use the repo's lint command (`./scripts/with-node.sh npm run lint`) and apply formatting with the repo's formatter command (`./scripts/with-node.sh npm run format`). Use `./scripts/with-node.sh npm run format:check` only when you specifically need a verification-only check, such as CI.

### Pre-commit hooks

Husky + lint-staged runs automatically on `git commit`:
- **gitleaks** scans staged changes for secrets (requires `brew install gitleaks`)
- **ESLint** (`--fix`) + **Prettier** (`--write`) on staged `.ts/.tsx/.js/.jsx` files
- **Prettier** on staged `.json/.md/.css/.yaml` files
- **ShellCheck** on staged `.sh` files (requires `brew install shellcheck`)

### CI

GitHub Actions (`.github/workflows/ci.yml`) runs on push to `main` and PRs: ESLint, Prettier, TypeScript, Next.js build, and ShellCheck.

Supabase local dev (from project root):
```bash
supabase start   # Start local Supabase stack
supabase stop    # Stop local Supabase stack
```

## Architecture Notes

- **Document format**: TipTap JSON internally (stored as `jsonb` in Postgres), markdown on export
- **Versioning**: Database-backed Git-like system with snapshots (commits), branches, and working copies — see `docs/plan.md` for the full schema
- **Comments**: Stored as marks in the TipTap document tree, not as HTML markers
- **Path alias**: `@/*` maps to `web/*` in TypeScript/imports
- **CSS**: Tailwind 4 with `@import "tailwindcss"` syntax. TipTap editor styles are in `web/app/globals.css`
- **ESLint**: Flat config (`eslint.config.mjs`) using `eslint-config-next` core-web-vitals + TypeScript presets + `eslint-config-prettier`
- **Formatting**: Prettier (config in `web/.prettierrc`)

## Manual QA

Use `agent-browser` (dev dependency in `web/`) as the **only** tool for visual verification and browser-based QA. Always invoke via `npx` from the `web/` directory. **Never use Playwright directly for manual QA** — always use `agent-browser`.

Use manual QA during active development, especially for UI, interaction, and visual changes. If the task is only regression checking or validation, prefer the relevant automated test suite instead of treating manual QA as required.

**Always use a random port** to avoid clashing with the user or other agents:

```bash
# 1. Pick a random port and start a dev server on it
PORT=$(jot -r 1 3100 3999)
cd web && ./scripts/with-node.sh npx next dev --port $PORT &

# 2. Use agent-browser against that port
./scripts/with-node.sh npx agent-browser open http://localhost:$PORT
./scripts/with-node.sh npx agent-browser screenshot [path]            # Viewport screenshot
./scripts/with-node.sh npx agent-browser screenshot --full [path]     # Full-page screenshot
./scripts/with-node.sh npx agent-browser snapshot                     # Accessibility tree with element refs
./scripts/with-node.sh npx agent-browser click @ref                   # Click an element by ref
./scripts/with-node.sh npx agent-browser keyboard type "text"         # Type text
./scripts/with-node.sh npx agent-browser press Enter                  # Press a key
./scripts/with-node.sh npx agent-browser close                        # Close the browser

# 3. Kill the dev server when done
lsof -ti:$PORT | xargs kill -9 2>/dev/null
```

Never use port 3000 for agent QA — that's reserved for the user's own dev server.

## Temporary Files

All temporary files (screenshots, logs, scratch files, etc.) must be written under `/tmp/`, not inside the repository. Use a subdirectory like `/tmp/wale/` to keep things organized.
