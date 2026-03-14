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

This project requires Node 22 for Node-related work. Only initialize `nvm` and run `nvm use` before commands that depend on Node, such as `node`, `npm`, `npx`, or Next.js tooling. Do not do this for unrelated shell commands like `git`, `rg`, `ls`, or file operations.

Before running Node-related commands, ensure you're using the correct version:

```bash
if ! command -v nvm >/dev/null 2>&1; then
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # Load nvm in non-interactive shells
fi
nvm use   # reads .nvmrc automatically
```

If Node 22 isn't installed, run `nvm install` first.

## Commands

All commands run from the `web/` directory:

```bash
cd web
npm run dev          # Start dev server (localhost:3000)
npm run build        # Production build
npm run lint         # ESLint (flat config, Next.js + TypeScript rules)
npm run format:check # Check formatting (Prettier)
npm run typecheck    # TypeScript type checking (tsc --noEmit)
npm run start        # Start production server
```

After completing code changes, always run the linter and the formatter before handing off work. Use the repo's lint command (`npm run lint`) and the repo's formatter command if one is available. If the formatter command is not defined yet, call that out explicitly in your handoff instead of skipping it silently.

### Pre-commit hooks

Husky + lint-staged runs automatically on `git commit`:
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

After making changes, always perform manual QA on the affected parts of the app to verify the result looks as expected before handing off the work.

**Always use a random port** to avoid clashing with the user or other agents:

```bash
# 1. Pick a random port and start a dev server on it
PORT=$(shuf -i 3100-3999 -n 1)
cd web && npx next dev --port $PORT &

# 2. Use agent-browser against that port
npx agent-browser open http://localhost:$PORT
npx agent-browser screenshot [path]            # Viewport screenshot
npx agent-browser screenshot --full [path]     # Full-page screenshot
npx agent-browser snapshot                     # Accessibility tree with element refs
npx agent-browser click @ref                   # Click an element by ref
npx agent-browser keyboard type "text"         # Type text
npx agent-browser press Enter                  # Press a key
npx agent-browser close                        # Close the browser

# 3. Kill the dev server when done
lsof -ti:$PORT | xargs kill -9 2>/dev/null
```

Never use port 3000 for agent QA — that's reserved for the user's own dev server.

## Temporary Files

All temporary files (screenshots, logs, scratch files, etc.) must be written under `/tmp/`, not inside the repository. Use a subdirectory like `/tmp/wale/` to keep things organized.
