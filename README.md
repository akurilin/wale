# Wale

Wale is a web-based writing editor built around a simple idea: drafting and AI-assisted revision should happen in the same place.

Instead of treating the document as something you paste into a chat window, Wale keeps the editor and the assistant side by side. The assistant works against the current document state on the backend, so it can discuss the draft and make targeted edits without leaving the writing flow.

## What Problem It Is Trying To Solve

Most writing tools force an awkward tradeoff:

- editors feel good to write in, but AI help is bolted on from the outside
- AI chats are flexible, but they usually work on pasted excerpts instead of the real document
- file-oriented workflows are powerful, but they are not especially friendly for web-native writing

Wale is trying to close that gap with a web-native editor that is:

- prose-first
- document-aware
- capable of direct assistant-driven edits
- designed for richer document workflows over time

## Current State

The live codebase is still early, but it already includes:

- a Next.js App Router application
- a TipTap-based rich text editor
- a document-aware assistant panel
- backend document editing for assistant-driven rewrites and formatting changes
- local file-backed document storage for development and tests
- unit and end-to-end test coverage

Today the app is centered on a single-document editing loop. Some larger product ideas exist elsewhere in the repo, but this README is meant to describe what is actually implemented now.

## Tech Stack

- Next.js 16
- React 19
- TypeScript
- TipTap
- Tailwind CSS 4
- Vercel AI SDK
- Playwright
- Vitest

## Repository Layout

- `web/` — the main application
- `supabase/` — local Supabase config and migration work for the longer-term backend direction
- `docs/` — planning notes and exploratory docs
- `data/` — local document storage used by the app outside temporary test files

## Getting Started

This project uses Node 22. Run Node-based commands from `web/` through the repository wrapper script.

```bash
cd web
./scripts/with-node.sh npm install
./scripts/with-node.sh npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

If no file is specified, the app redirects to a default document. During development, documents are currently stored as TipTap JSON on disk rather than in a hosted database.

## Common Commands

Run these from `web/`:

```bash
./scripts/with-node.sh npm run dev
./scripts/with-node.sh npm run build
./scripts/with-node.sh npm run lint
./scripts/with-node.sh npm run format
./scripts/with-node.sh npm run typecheck
./scripts/with-node.sh npm run test:unit
./scripts/with-node.sh npm run test:e2e
```

## Testing

The repository has two main test layers:

- `test:unit` for fast backend and runtime coverage with Vitest
- `test:e2e` for full browser coverage with Playwright

Both test runners are configured to run sequentially by default for predictable local results.

## How The App Works Today

- the editor loads and saves the current document through the document API
- the assistant sends chat requests through the chat API
- before a chat request is sent, the client flushes the latest editor state to storage
- the backend assistant can then read and modify the canonical document state

That means the assistant is working with the real document, not with a stale client-only copy or a pasted excerpt.

## Status

Wale is an active prototype. The current implementation is strongest around editor behavior, document persistence, and assistant-driven editing. Broader collaboration, versioning, and hosted backend work are still evolving.
