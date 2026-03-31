import { createHash } from "crypto";
import type { JSONContent } from "@tiptap/core";
import {
  readDocument,
  type DocumentStorageOptions,
  writeDocument,
} from "./storage";

type AssistantDocumentBlockType = "blockquote" | "heading" | "paragraph";
type AssistantTextBlockType = "heading" | "paragraph";
type AssistantMarkType = "bold" | "italic";

type ReplaceTextOperation = {
  type: "replace_text";
  blockId: string;
  expectedText: string;
  newText: string;
};

type SetBlockTypeOperation = {
  type: "set_block_type";
  blockId: string;
  blockType: AssistantTextBlockType;
  level?: 1 | 2 | 3;
};

type ApplyMarkOperation = {
  type: "apply_mark";
  blockId: string;
  from: number;
  to: number;
  mark: AssistantMarkType;
};

type InsertBlockOperation = {
  type: "insert_block";
  index: number;
  blockType: AssistantTextBlockType;
  text: string;
  level?: 1 | 2 | 3;
};

type WrapInBlockquoteOperation = {
  type: "wrap_in_blockquote";
  blockId: string;
};

type DocumentOperationResult =
  | {
      ok: true;
      updatedBlockIds: string[];
    }
  | {
      ok: false;
      conflict: string;
    };

type AssistantBlockNode = JSONContent & { type: AssistantDocumentBlockType };
type AssistantTextBlockNode = JSONContent & { type: AssistantTextBlockType };
type AssistantMark = NonNullable<JSONContent["marks"]>[number];

export type AssistantDocumentBlock = {
  id: string;
  type: AssistantDocumentBlockType;
  text: string;
};

export type ReadDocumentForAssistantResult = {
  revision: string;
  blocks: AssistantDocumentBlock[];
};

export type DocumentEdit = {
  blockId: string;
  expectedText: string;
  newText: string;
};

export type ApplyDocumentEditsInput = {
  baseRevision: string;
  edits: DocumentEdit[];
};

export type DocumentOperation =
  | ReplaceTextOperation
  | SetBlockTypeOperation
  | ApplyMarkOperation
  | InsertBlockOperation
  | WrapInBlockquoteOperation;

export type EditDocumentInput = {
  baseRevision: string;
  operations: DocumentOperation[];
};

export type EditDocumentResult =
  | {
      ok: true;
      revision: string;
      updatedBlocks: AssistantDocumentBlock[];
    }
  | {
      ok: false;
      revision: string;
      conflict: string;
    };

export type ApplyDocumentEditsResult = EditDocumentResult;

/**
 * Produces the optimistic concurrency token for the raw on-disk document.
 * We hash the serialized JSON rather than the parsed tree so any write that
 * changes the file contents invalidates stale assistant edits.
 */
function getRevision(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/**
 * Parses the stored TipTap JSON document into the structure the assistant
 * editing helpers operate on.
 */
function parseDocument(raw: string): JSONContent {
  return JSON.parse(raw) as JSONContent;
}

/**
 * Serializes the in-memory TipTap tree in the same stable shape the storage
 * layer writes to disk so revision hashes match persisted document contents.
 */
function serializeDocument(document: JSONContent): string {
  return JSON.stringify(document, null, 2);
}

/**
 * Flattens a node subtree into plain text for assistant-facing comparisons and
 * range calculations while the backend still preserves the full tree on disk.
 */
function getNodeText(node: JSONContent | undefined): string {
  if (!node) {
    return "";
  }

  let text = node.text ?? "";

  for (const child of node.content ?? []) {
    text += getNodeText(child);
  }

  return text;
}

/**
 * Limits assistant-visible blocks to prose-oriented top-level nodes that map
 * cleanly to Wale's writing model today.
 */
function isAssistantTopLevelBlock(
  node: JSONContent | null | undefined,
): node is AssistantBlockNode {
  return (
    node?.type === "blockquote" ||
    node?.type === "heading" ||
    node?.type === "paragraph"
  );
}

/**
 * Identifies blocks whose own inline content can be rewritten or marked
 * directly without first unwrapping any surrounding container node.
 */
function isAssistantTextBlock(
  node: JSONContent | null | undefined,
): node is AssistantTextBlockNode {
  return node?.type === "heading" || node?.type === "paragraph";
}

/**
 * Resolves a block id to a current top-level array index. Block ids are still
 * stringified indexes, so malformed identifiers must be rejected early.
 */
function resolveBlockIndex(
  document: JSONContent,
  blockId: string,
): number | null {
  const blockIndex = Number(blockId);

  if (!Number.isInteger(blockIndex) || String(blockIndex) !== blockId) {
    return null;
  }

  if (blockIndex < 0 || blockIndex >= (document.content?.length ?? 0)) {
    return null;
  }

  return blockIndex;
}

/**
 * Resolves a single assistant block reference back to the live document.
 */
function getAssistantBlock(
  document: JSONContent,
  blockId: string,
): AssistantDocumentBlock | null {
  const blockIndex = resolveBlockIndex(document, blockId);
  if (blockIndex === null) {
    return null;
  }

  const block = document.content?.[blockIndex];
  if (!isAssistantTopLevelBlock(block)) {
    return null;
  }

  return {
    id: blockId,
    type: block.type,
    text: getNodeText(block),
  };
}

/**
 * Fetches the live top-level node for structural operations.
 */
function getAssistantBlockNode(
  document: JSONContent,
  blockId: string,
): AssistantBlockNode | null {
  const blockIndex = resolveBlockIndex(document, blockId);
  if (blockIndex === null) {
    return null;
  }

  const block = document.content?.[blockIndex];
  return isAssistantTopLevelBlock(block) ? block : null;
}

/**
 * Projects the editable top-level document blocks into the simplified shape
 * exposed to the assistant tools.
 */
function getAssistantBlocks(document: JSONContent): AssistantDocumentBlock[] {
  return (document.content ?? []).flatMap((block, index) => {
    if (!isAssistantTopLevelBlock(block)) {
      return [];
    }

    return [
      {
        id: String(index),
        type: block.type,
        text: getNodeText(block),
      },
    ];
  });
}

/**
 * Finds the shared prefix between the old and new block text so the edit logic
 * can isolate the smallest changed span.
 */
function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  const len = Math.min(a.length, b.length);
  while (i < len && a[i] === b[i]) i++;
  return i;
}

/**
 * Finds the shared suffix after the prefix has been accounted for.
 * The prefix length matters so overlapping prefix/suffix matches do not cause
 * the replacement window to collapse incorrectly.
 */
function commonSuffixLength(a: string, b: string, prefixLen: number): number {
  let i = 0;
  const maxLen = Math.min(a.length - prefixLen, b.length - prefixLen);
  while (i < maxLen && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
}

/**
 * Compares mark arrays by value so adjacent text nodes are only merged when
 * they carry the same inline formatting.
 */
function sameMarks(a: JSONContent["marks"], b: JSONContent["marks"]): boolean {
  if (!a?.length && !b?.length) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Recombines neighboring text nodes after an edit.
 * TipTap allows adjacent text nodes with identical marks, but merging them here
 * keeps the stored document shape stable and easier to reason about.
 */
function mergeAdjacentTextNodes(nodes: JSONContent[]): JSONContent[] {
  const result: JSONContent[] = [];
  for (const node of nodes) {
    const prev = result[result.length - 1];
    if (
      prev?.type === "text" &&
      node.type === "text" &&
      sameMarks(prev.marks, node.marks)
    ) {
      prev.text = (prev.text ?? "") + (node.text ?? "");
    } else {
      result.push(node);
    }
  }
  return result;
}

/**
 * Creates a standalone text node and defensively clones its marks so later
 * transforms do not accidentally mutate sibling nodes.
 */
function createTextNode(
  text: string,
  marks?: JSONContent["marks"],
): JSONContent {
  const node: JSONContent = {
    type: "text",
    text,
  };

  if (marks?.length) {
    node.marks = marks.map((mark) => ({ ...mark })) as JSONContent["marks"];
  }

  return node;
}

/**
 * Builds the inline content array for plain-text block creation.
 */
function createTextContent(text: string): JSONContent[] {
  return text.length > 0 ? [createTextNode(text)] : [];
}

/**
 * Creates a supported top-level block from semantic operation arguments.
 */
function createTopLevelBlock(
  blockType: AssistantTextBlockType,
  text: string,
  level?: 1 | 2 | 3,
): JSONContent {
  if (blockType === "heading") {
    return {
      type: "heading",
      attrs: { level: level ?? 1 },
      content: createTextContent(text),
    };
  }

  return {
    type: "paragraph",
    content: createTextContent(text),
  };
}

/**
 * Adds a supported inline mark without duplicating an existing mark of the
 * same type on the same text segment.
 */
function addMark(
  marks: JSONContent["marks"],
  mark: AssistantMarkType,
): NonNullable<JSONContent["marks"]> {
  const nextMarks: NonNullable<JSONContent["marks"]> = marks
    ? (marks.map((value) => ({ ...value })) as NonNullable<
        JSONContent["marks"]
      >)
    : [];

  if (!nextMarks.some((value) => value.type === mark)) {
    nextMarks.push({ type: mark } as AssistantMark);
  }

  return nextMarks;
}

/**
 * Rewrites a block's text while preserving as much inline mark structure as the
 * old and new strings allow. The algorithm replaces only the differing span and
 * borrows marks from the overlapping nodes around that span.
 */
function replaceTextPreservingMarks(
  content: JSONContent[],
  oldText: string,
  newText: string,
): JSONContent[] {
  const prefixLen = commonPrefixLength(oldText, newText);
  const suffixLen = commonSuffixLength(oldText, newText, prefixLen);

  const editStart = prefixLen;
  const editEndOld = oldText.length - suffixLen;
  const replacement = newText.slice(prefixLen, newText.length - suffixLen);

  const result: JSONContent[] = [];
  let pos = 0;
  let replacementEmitted = false;

  for (const node of content) {
    if (node.type !== "text") {
      result.push(node);
      continue;
    }

    const text = node.text ?? "";
    const nodeStart = pos;
    const nodeEnd = pos + text.length;
    pos = nodeEnd;

    if (nodeEnd <= editStart) {
      result.push(node);
      continue;
    }

    if (nodeStart >= editEndOld) {
      if (!replacementEmitted) {
        if (replacement.length > 0) {
          result.push(createTextNode(replacement));
        }
        replacementEmitted = true;
      }
      result.push(node);
      continue;
    }

    if (nodeStart < editStart) {
      result.push(
        createTextNode(text.slice(0, editStart - nodeStart), node.marks),
      );
    }

    if (!replacementEmitted) {
      if (replacement.length > 0) {
        result.push(createTextNode(replacement, node.marks));
      }
      replacementEmitted = true;
    }

    if (nodeEnd > editEndOld) {
      result.push(
        createTextNode(text.slice(editEndOld - nodeStart), node.marks),
      );
    }
  }

  if (!replacementEmitted && replacement.length > 0) {
    result.push(createTextNode(replacement));
  }

  return mergeAdjacentTextNodes(result);
}

/**
 * Applies a mark to the exact character range inside one text block by
 * splitting the touched text nodes and reusing any untouched formatting.
 */
function applyMarkToContent(
  content: JSONContent[],
  from: number,
  to: number,
  mark: AssistantMarkType,
): JSONContent[] {
  const result: JSONContent[] = [];
  let pos = 0;

  for (const node of content) {
    if (node.type !== "text") {
      result.push(node);
      continue;
    }

    const text = node.text ?? "";
    const nodeStart = pos;
    const nodeEnd = pos + text.length;
    pos = nodeEnd;

    if (nodeEnd <= from || nodeStart >= to) {
      result.push(node);
      continue;
    }

    if (nodeStart < from) {
      result.push(createTextNode(text.slice(0, from - nodeStart), node.marks));
    }

    const markStart = Math.max(from, nodeStart) - nodeStart;
    const markEnd = Math.min(to, nodeEnd) - nodeStart;
    result.push(
      createTextNode(text.slice(markStart, markEnd), addMark(node.marks, mark)),
    );

    if (nodeEnd > to) {
      result.push(createTextNode(text.slice(to - nodeStart), node.marks));
    }
  }

  return mergeAdjacentTextNodes(result);
}

/**
 * Applies a plain-text replacement to one editable top-level text block.
 * Empty blocks stay valid by clearing their content array, while populated
 * blocks route through the mark-preserving replacement helper above.
 */
function replaceTextInTextBlock(
  block: AssistantTextBlockNode,
  newText: string,
): void {
  if (newText.length === 0) {
    block.content = [];
  } else if (!block.content?.length) {
    block.content = createTextContent(newText);
  } else {
    const oldText = getNodeText(block);
    block.content = replaceTextPreservingMarks(block.content, oldText, newText);
  }
}

/**
 * Executes a semantic document operation against a cloned TipTap tree.
 * Failures return a conflict string so the caller can abort before writing.
 */
function applyOperation(
  document: JSONContent,
  operation: DocumentOperation,
): DocumentOperationResult {
  switch (operation.type) {
    case "replace_text": {
      const block = getAssistantBlockNode(document, operation.blockId);

      if (!isAssistantTextBlock(block)) {
        return {
          ok: false,
          conflict: `Block ${operation.blockId} is not an editable top-level paragraph or heading.`,
        };
      }

      const blockText = getNodeText(block);
      if (blockText !== operation.expectedText) {
        return {
          ok: false,
          conflict: `Block ${operation.blockId} no longer matches the expected text. Expected "${operation.expectedText}" but found "${blockText}"`,
        };
      }

      replaceTextInTextBlock(block, operation.newText);
      return {
        ok: true,
        updatedBlockIds: [operation.blockId],
      };
    }

    case "set_block_type": {
      const block = getAssistantBlockNode(document, operation.blockId);

      if (!isAssistantTextBlock(block)) {
        return {
          ok: false,
          conflict: `Block ${operation.blockId} is not a top-level paragraph or heading.`,
        };
      }

      if (operation.blockType === "heading") {
        block.type = "heading";
        block.attrs = { level: operation.level ?? 1 };
      } else {
        block.type = "paragraph";
        delete block.attrs;
      }

      return {
        ok: true,
        updatedBlockIds: [operation.blockId],
      };
    }

    case "apply_mark": {
      const block = getAssistantBlockNode(document, operation.blockId);

      if (!isAssistantTextBlock(block)) {
        return {
          ok: false,
          conflict: `Block ${operation.blockId} is not a top-level paragraph or heading.`,
        };
      }

      const blockText = getNodeText(block);
      if (
        !Number.isInteger(operation.from) ||
        !Number.isInteger(operation.to) ||
        operation.from < 0 ||
        operation.from >= operation.to ||
        operation.to > blockText.length
      ) {
        return {
          ok: false,
          conflict: `Mark range ${operation.from}-${operation.to} is out of bounds for block ${operation.blockId} text "${blockText}"`,
        };
      }

      block.content = applyMarkToContent(
        block.content ?? [],
        operation.from,
        operation.to,
        operation.mark,
      );

      return {
        ok: true,
        updatedBlockIds: [operation.blockId],
      };
    }

    case "insert_block": {
      const content = document.content ?? [];
      if (
        !Number.isInteger(operation.index) ||
        operation.index < 0 ||
        operation.index > content.length
      ) {
        return {
          ok: false,
          conflict: `Insert index ${operation.index} is out of bounds.`,
        };
      }

      content.splice(
        operation.index,
        0,
        createTopLevelBlock(
          operation.blockType,
          operation.text,
          operation.level,
        ),
      );
      document.content = content;

      return {
        ok: true,
        updatedBlockIds: [String(operation.index)],
      };
    }

    case "wrap_in_blockquote": {
      const blockIndex = resolveBlockIndex(document, operation.blockId);
      if (blockIndex === null) {
        return {
          ok: false,
          conflict: `Block ${operation.blockId} is not an editable top-level block.`,
        };
      }

      const block = document.content?.[blockIndex];
      if (!isAssistantTopLevelBlock(block)) {
        return {
          ok: false,
          conflict: `Block ${operation.blockId} is not an editable top-level block.`,
        };
      }

      if (block.type === "blockquote") {
        return {
          ok: false,
          conflict: `Block ${operation.blockId} is already a blockquote.`,
        };
      }

      document.content?.splice(blockIndex, 1, {
        type: "blockquote",
        content: [block],
      });

      return {
        ok: true,
        updatedBlockIds: [operation.blockId],
      };
    }
  }
}

/**
 * Exposes the assistant-safe document view: a revision token plus the readable
 * top-level prose blocks the current tool contract can target.
 */
export async function readDocumentForAssistant(
  filename: string,
  options: DocumentStorageOptions = {},
): Promise<ReadDocumentForAssistantResult> {
  const raw = await readDocument(filename, options);
  const document = parseDocument(raw);

  return {
    revision: getRevision(raw),
    blocks: getAssistantBlocks(document),
  };
}

/**
 * Applies semantic document operations atomically against a specific base
 * revision so block transforms and inline formatting stay backend-controlled.
 */
export async function editDocument(
  filename: string,
  input: EditDocumentInput,
  options: DocumentStorageOptions = {},
): Promise<EditDocumentResult> {
  const raw = await readDocument(filename, options);
  const currentRevision = getRevision(raw);

  if (currentRevision !== input.baseRevision) {
    return {
      ok: false,
      revision: currentRevision,
      conflict: "Document changed before the edit could be applied.",
    };
  }

  const document = parseDocument(raw);
  const nextDocument = structuredClone(document);
  const updatedBlockIds: string[] = [];

  for (const operation of input.operations) {
    const result = applyOperation(nextDocument, operation);

    if (!result.ok) {
      return {
        ok: false,
        revision: currentRevision,
        conflict: result.conflict,
      };
    }

    for (const blockId of result.updatedBlockIds) {
      if (!updatedBlockIds.includes(blockId)) {
        updatedBlockIds.push(blockId);
      }
    }
  }

  await writeDocument(filename, nextDocument, options);

  return {
    ok: true,
    revision: getRevision(serializeDocument(nextDocument)),
    updatedBlocks: updatedBlockIds.flatMap((blockId) => {
      const block = getAssistantBlock(nextDocument, blockId);
      return block ? [block] : [];
    }),
  };
}

/**
 * Keeps the old plain-text assistant edit contract available by translating it
 * into the richer semantic executor one replace operation at a time.
 */
export async function applyDocumentEdits(
  filename: string,
  input: ApplyDocumentEditsInput,
  options: DocumentStorageOptions = {},
): Promise<ApplyDocumentEditsResult> {
  return editDocument(
    filename,
    {
      baseRevision: input.baseRevision,
      operations: input.edits.map((edit) => ({
        type: "replace_text" as const,
        blockId: edit.blockId,
        expectedText: edit.expectedText,
        newText: edit.newText,
      })),
    },
    options,
  );
}
