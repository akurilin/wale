This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## TODO: Assistant Document Tools

The assistant can read and edit the current document via two tools (`read_document` and `apply_document_edits`) defined in `web/lib/assistant/document-tools.ts`, with core logic in `web/lib/document/agent-document.ts`. The current implementation has several issues worth addressing:

### Switch to string-replacement editing

The current approach requires the model to send the **entire block text** as `expectedText` and `newText`, even for a one-word fix. Claude is heavily trained on `old_string` → `new_string` replacement semantics (this is how the Edit tool works in Claude Code, Cursor, etc.), so a string-replacement tool would be:

- More token-efficient (fixing a typo doesn't require echoing two full paragraphs)
- More natural for the model (strong RLHF priors for this pattern)
- Less error-prone (smaller match surface = fewer subtle transcription mistakes)

The replacement tool should operate on the plain-text representation and map replacements back onto the ProseMirror node tree, preserving inline marks. This is more complex to implement on the backend but pays off on every interaction.

### Fix formatting destruction on edit

`replaceTopLevelBlockText` in `agent-document.ts:124` replaces a block's entire `content` array with a single `{ type: "text", text: newText }` node. This **silently erases all inline formatting** (bold, italic, links, etc.). A string-level replacement that operates on text content while preserving the surrounding mark structure would fix this. This is the most important bug to fix — it causes silent data loss.

### Improve the system prompt for tool use

The tool instructions in `web/lib/assistant/prompt.ts` (lines 21–27) are only 5 generic sentences. Compare this to Claude Code, where detailed system prompt instructions are key to efficient tool use. Specific improvements:

- **Skip unnecessary reads**: "If the user's request can be answered from the excerpt/selection already in context, do not call `read_document`."
- **Describe the data model**: The model doesn't know that `blockId` is an array index, that only paragraphs/headings are editable, or that other node types exist but can't be touched. It discovers these limits via errors.
- **Batch edits**: "Combine all edits for a single revision into one `apply_document_edits` call instead of one call per block."
- **Conflict recovery**: "If `apply_document_edits` returns `ok: false`, call `read_document` to get the new revision and retry."
- **Scope the role**: The current identity line is generic. Frame the model as a writing editor that can both discuss and directly modify the document.

### Consider stable block IDs

Block IDs are currently array indices (`"0"`, `"1"`, ...). If any structural change (insertion, deletion) happens between read and edit, all block references after the change point become invalid. The revision hash catches this, but it means *any* structural edit invalidates *all* pending block references, not just affected ones. Stable IDs (e.g., via a TipTap `UniqueID` extension) would make the system more resilient to concurrent edits.

### Support block insertion and deletion

The current tools can only replace text within existing blocks. The model has no way to add a new paragraph, remove a heading, or restructure the document. Adding `insert_block` and `delete_block` operations (or folding them into the edit tool) would make the assistant meaningfully more capable.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
