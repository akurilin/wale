# Technical Decisions

## Framework & Runtime

- **Next.js 16 (App Router)** — Web framework. App Router for server components, API routes, and streaming.
- **React 19** — UI library.
- **Node 22** — Runtime version, managed via nvm.
- **TypeScript** — Language for all frontend code.

## Editor

- **TipTap (ProseMirror)** over CodeMirror 6, Novel, and Plate — Rich text editing with markdown export. ProseMirror is battle-tested, TipTap has a strong extension ecosystem and built-in support for comments/annotations.
- **TipTap JSON as internal format** — Stored as `jsonb` in Postgres. Markdown generated on export only.
- **Comments as TipTap marks** — Stored in the document tree, not as HTML marker pairs like Kale.

## Backend & Data

- **Supabase** — Postgres, Auth, and Storage. Replaces Kale's filesystem with a database-backed model.
- **Database-backed versioning** — Git-like semantics (snapshots, branches, working copies) implemented in Postgres instead of real Git.

## AI

- **Vercel AI SDK (`ai`)** — Model-agnostic abstraction for streaming, tool calling, and React hooks. Supports Anthropic, OpenAI, OpenRouter, etc.
- **`@ai-sdk/anthropic`** — Anthropic provider for the AI SDK.
- **`@assistant-ui/react`** — Chat UI components for the assistant panel.

## Styling & UI

- **Tailwind CSS 4** — Utility-first CSS with `@import "tailwindcss"` syntax.
- **shadcn/ui + Radix UI** — Component primitives.
- **Lucide** — Icon library.
- **class-variance-authority + clsx + tailwind-merge** — Class name composition utilities.

## State Management

- **Zustand** — Client-side state management.

## Code Quality

- **ESLint 9** — Flat config with `eslint-config-next` (core-web-vitals + TypeScript) and `eslint-config-prettier`.
- **Prettier** — Code formatting.
- **Husky + lint-staged** — Pre-commit hooks for linting and formatting.
- **ShellCheck** — Linting for shell scripts.
- **gitleaks** — Secret detection in pre-commit hook and CI. Prevents accidental commits of API keys, tokens, etc.
- **GitHub Actions CI** — Runs ESLint, Prettier, TypeScript, Next.js build, ShellCheck, and gitleaks on push/PR.

## Testing

- **Vitest** — Unit tests.
- **Playwright** — End-to-end tests.
- **agent-browser** — Browser-based manual QA (dev dependency).

## Validation

- **Zod 4** — Schema validation.
