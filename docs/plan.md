# Wale — Web Port of Kale

## What Kale Is Today

Kale is an Electron desktop app for markdown writing with Claude Code built in. Key pieces:

- **Editor**: CodeMirror 6 with ~1300 lines of custom extensions (live markdown preview, formatting shortcuts, marker hiding, spellcheck)
- **Inline comments**: Embedded as HTML marker pairs in the markdown (`<!-- @comment:id start | "text" -->`)
- **File management**: Filesystem-based, one file open at a time, chokidar watching, three-way merge on external changes
- **AI integration**: Spawns Claude Code CLI via PTY, communicates through a custom MCP-over-WebSocket IDE server
- **Git integration**: Branch switching, commits, restore — all scoped to the active file
- **UI layout**: Three-pane (file explorer | editor + comments | terminal), draggable dividers, collapsible panes

## What Wale Changes

Wale is a web-based reimagining. Not a 1:1 port — the constraints are fundamentally different.

### What We Keep (Conceptually)
- Prose-first writing experience
- Inline comments on selections
- AI assistant integrated into the editor
- Git-like versioning (save points, branching, diffing)
- Multi-file document management
- Clean three-pane-ish layout

### What Changes
| Kale | Wale |
|------|------|
| Electron + Node filesystem | Next.js + Supabase |
| CodeMirror 6 (raw markdown) | TBD — likely TipTap/ProseMirror (rich text, export to markdown) |
| Claude Code CLI via PTY | AI SDK (model-agnostic: Anthropic, OpenRouter, etc.) |
| MCP IDE server | Not needed — AI talks to the app directly |
| Git on disk | Database-backed versioning (snapshots, branches, diffs) |
| Files on disk | Documents in Postgres |
| Single user, local | Web-native, auth via Supabase Auth |

---

## Architecture Decisions

**Locked in:** Next.js (App Router) + Supabase (Postgres, Auth, Storage).

### 1. Editor: TBD — TipTap vs. CodeMirror 6 vs. Novel vs. Plate

This is the biggest open decision. The constraints:

- We want **rich text editing** (not raw markdown) with **markdown export**
- Need inline comments anchored to selections
- Need AI to be able to read and write document content
- Need good keyboard shortcuts, formatting toolbar

**Options:**

| Editor | Pros | Cons |
|--------|------|------|
| **TipTap** (ProseMirror wrapper) | Rich text native, great extension ecosystem, comment/collab extensions exist, markdown import/export via `tiptap-markdown` | Heavier than CM6, ProseMirror learning curve for deep customization |
| **CodeMirror 6** (what Kale uses) | We have 1300 lines of proven extensions, lightweight, fast | Raw markdown editing, not rich text — would need to build rich text on top or abandon that goal |
| **Novel** (TipTap-based, Vercel) | Beautiful defaults, AI completions built in, Tailwind-native | Less control, opinionated, may fight us on custom features |
| **Plate** (Slate-based) | Pluggable, good TypeScript, rich text native | Smaller ecosystem than TipTap, Slate can be finicky |

**Leaning toward TipTap** because:
- Rich text with markdown export is the stated goal
- Comment/annotation extensions already exist
- Large ecosystem, good docs, active maintenance
- ProseMirror underneath is battle-tested

### 2. AI Integration: Model-Agnostic SDK Layer

No Claude Code CLI available in the browser. We need:

- **Server-side AI proxy** (Next.js API route or server action) that holds API keys
- **Model abstraction layer** so we can swap between Anthropic, OpenRouter, OpenAI, etc.
- **Streaming responses** to the client for real-time AI output
- **Tool calling** support (AI can read/modify document content, manage files)

**Options for the abstraction layer:**

| Approach | Pros | Cons |
|----------|------|------|
| **Vercel AI SDK (`ai`)** | Model-agnostic (Anthropic, OpenAI, Google, etc.), streaming primitives, React hooks (`useChat`, `useCompletion`), tool calling support, active maintenance | Another dependency, some abstraction overhead |
| **Roll our own** | Full control, minimal deps | Lots of boilerplate for streaming, tool calling, error handling |
| **LiteLLM proxy** | Huge model support, OpenAI-compatible API | Extra infra, Python-based, overkill for this |

**Vercel AI SDK is the strong choice.** It's TypeScript-native, works perfectly with Next.js, supports all the providers we care about, and handles streaming + tool calling out of the box. We can always drop down to raw SDK calls where needed.

### 3. Versioning: Database-Backed Git-Like System

Kale uses actual Git. Wale can't (no filesystem). We build a versioning system in Postgres that provides the UX of Git without Git:

**Core concepts:**
- **Snapshot**: A frozen copy of a document's content at a point in time (like a commit)
- **Branch**: A named pointer to a snapshot chain (like a git branch)
- **Diff**: Computed between snapshots for display (not stored — derived on read)

**Schema sketch:**
```
documents
  id, title, owner_id, created_at, updated_at

document_branches
  id, document_id, name, head_snapshot_id, is_default

document_snapshots
  id, document_id, branch_id, parent_snapshot_id,
  content (jsonb — TipTap JSON or markdown),
  message, created_at, created_by

document_current
  document_id, branch_id, content (jsonb — live working copy)
```

**UX:**
- Auto-save writes to `document_current` (the working copy)
- "Save version" creates a snapshot (like `git commit`)
- Branch switcher lets you create/switch branches
- Diff view shows changes between snapshots
- "Restore" reverts working copy to a snapshot

This gives us Git-like semantics without Git. The content is just JSON (TipTap document tree) or markdown text, stored in Postgres.

### 4. Document Format: TipTap JSON (Internal) → Markdown (Export)

- **Internal format**: TipTap's ProseMirror JSON document tree, stored as `jsonb` in Postgres
- **Export**: Markdown generated on demand via TipTap serializer
- **Import**: Markdown parsed into TipTap JSON on upload
- **Comments**: Stored as marks in the TipTap document tree (not HTML markers like Kale)
- **Assets**: Images uploaded to Supabase Storage, referenced by URL in the doc

This is cleaner than Kale's approach of embedding comment markers in markdown text.

---

## Data Model (Draft)

```sql
-- Users (managed by Supabase Auth, extended with profiles)
create table profiles (
  id uuid references auth.users primary key,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Projects (collections of documents)
create table projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references profiles(id),
  title text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Documents
create table documents (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  title text not null default 'Untitled',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Branches per document
create table document_branches (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  name text not null default 'main',
  head_snapshot_id uuid, -- references document_snapshots(id), added after
  is_default boolean default false,
  created_at timestamptz default now(),
  unique(document_id, name)
);

-- Snapshots (version history)
create table document_snapshots (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  branch_id uuid references document_branches(id) on delete cascade,
  parent_snapshot_id uuid references document_snapshots(id),
  content jsonb not null, -- TipTap document JSON
  message text,
  created_by uuid references profiles(id),
  created_at timestamptz default now()
);

-- Add FK now that snapshots table exists
alter table document_branches
  add constraint fk_head_snapshot
  foreign key (head_snapshot_id) references document_snapshots(id);

-- Working copy (auto-saved, mutable)
create table document_working_copies (
  document_id uuid references documents(id) on delete cascade,
  branch_id uuid references document_branches(id) on delete cascade,
  content jsonb not null,
  updated_at timestamptz default now(),
  primary key (document_id, branch_id)
);

-- Inline comments (separate from doc content for querying)
create table comments (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  author_id uuid references profiles(id),
  content text not null,
  anchor_from int, -- position in TipTap doc
  anchor_to int,
  resolved boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- AI conversations per document
create table ai_conversations (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade,
  model text, -- 'claude-sonnet-4-20250514', 'gpt-4o', etc.
  provider text, -- 'anthropic', 'openrouter', 'openai'
  created_at timestamptz default now()
);

create table ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references ai_conversations(id) on delete cascade,
  role text not null, -- 'user', 'assistant', 'system', 'tool'
  content jsonb not null,
  created_at timestamptz default now()
);
```

---

## Implementation Phases

### Phase 1: Foundation
- [x] Next.js project with TypeScript + Tailwind
- [x] Supabase local dev environment
- [ ] Supabase schema migration (tables above)
- [ ] Supabase Auth setup (email + OAuth)
- [ ] Basic app shell (layout, routing, auth pages)
- [ ] TipTap editor integration (basic rich text editing)

### Phase 2: Document Management
- [ ] Create / open / list documents
- [ ] Auto-save to `document_working_copies`
- [ ] Markdown export
- [ ] Project organization (folders/collections)

### Phase 3: Versioning
- [ ] "Save version" (create snapshot)
- [ ] Version history sidebar
- [ ] Diff view between snapshots
- [ ] Branch create / switch
- [ ] Restore from snapshot

### Phase 4: AI Integration
- [ ] Vercel AI SDK setup with Anthropic provider
- [ ] AI chat panel (like Kale's terminal pane, but richer)
- [ ] Tool calling: AI reads/modifies document content
- [ ] Model switcher (Anthropic, OpenRouter, etc.)
- [ ] Conversation persistence

### Phase 5: Comments & Collaboration
- [ ] Inline comments on text selections
- [ ] Comment sidebar (like Kale's, but stored in DB)
- [ ] AI-generated comments / suggestions

### Phase 6: Polish
- [ ] Keyboard shortcuts matching Kale
- [ ] Spellcheck (browser-native or library)
- [ ] File explorer / document tree
- [ ] Responsive layout with collapsible panes
- [ ] Dark mode

---

## Open Questions

1. **Editor choice**: TipTap is the frontrunner — should we prototype with it before committing?
2. **Comment storage**: In the TipTap doc JSON as marks, or in a separate `comments` table with position anchors, or both?
3. **Realtime / collab**: Not in v1, but should we design the schema to not preclude it?
4. **AI tool calling scope**: What can the AI do? Just read/write the current doc, or also manage files, create versions, etc.?
5. **Deployment target**: Vercel? Self-hosted? Does it matter yet?
