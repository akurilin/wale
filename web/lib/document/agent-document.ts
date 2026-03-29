import { createHash } from "crypto";
import type { JSONContent } from "@tiptap/core";
import {
  readDocument,
  type DocumentStorageOptions,
  writeDocument,
} from "./storage";

export type AssistantDocumentBlock = {
  id: string;
  type: "heading" | "paragraph";
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

export type ApplyDocumentEditsResult =
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

function getRevision(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

function parseDocument(raw: string): JSONContent {
  return JSON.parse(raw) as JSONContent;
}

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

function isEditableTopLevelBlock(
  node: JSONContent | undefined,
): node is JSONContent & { type: "heading" | "paragraph" } {
  return node?.type === "heading" || node?.type === "paragraph";
}

function getEditableBlock(
  document: JSONContent,
  blockId: string,
): AssistantDocumentBlock | null {
  const blockIndex = Number(blockId);

  if (!Number.isInteger(blockIndex) || String(blockIndex) !== blockId) {
    return null;
  }

  const block = document.content?.[blockIndex];
  if (!isEditableTopLevelBlock(block)) {
    return null;
  }

  return {
    id: blockId,
    type: block.type,
    text: getNodeText(block),
  };
}

function getEditableBlocks(document: JSONContent): AssistantDocumentBlock[] {
  return (document.content ?? []).flatMap((block, index) => {
    if (!isEditableTopLevelBlock(block)) {
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

function commonPrefixLength(a: string, b: string): number {
  let i = 0;
  const len = Math.min(a.length, b.length);
  while (i < len && a[i] === b[i]) i++;
  return i;
}

function commonSuffixLength(a: string, b: string, prefixLen: number): number {
  let i = 0;
  const maxLen = Math.min(a.length - prefixLen, b.length - prefixLen);
  while (i < maxLen && a[a.length - 1 - i] === b[b.length - 1 - i]) i++;
  return i;
}

function sameMarks(a: JSONContent["marks"], b: JSONContent["marks"]): boolean {
  if (!a?.length && !b?.length) return true;
  return JSON.stringify(a) === JSON.stringify(b);
}

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
          result.push({ type: "text", text: replacement } as JSONContent);
        }
        replacementEmitted = true;
      }
      result.push(node);
      continue;
    }

    // Node overlaps the edit region

    if (nodeStart < editStart) {
      const kept: JSONContent = {
        type: "text",
        text: text.slice(0, editStart - nodeStart),
      };
      if (node.marks) kept.marks = node.marks;
      result.push(kept);
    }

    if (!replacementEmitted) {
      if (replacement.length > 0) {
        const rep: JSONContent = { type: "text", text: replacement };
        if (node.marks) rep.marks = node.marks;
        result.push(rep);
      }
      replacementEmitted = true;
    }

    if (nodeEnd > editEndOld) {
      const kept: JSONContent = {
        type: "text",
        text: text.slice(editEndOld - nodeStart),
      };
      if (node.marks) kept.marks = node.marks;
      result.push(kept);
    }
  }

  if (!replacementEmitted && replacement.length > 0) {
    result.push({ type: "text", text: replacement } as JSONContent);
  }

  return mergeAdjacentTextNodes(result);
}

function replaceTopLevelBlockText(
  document: JSONContent,
  blockId: string,
  newText: string,
): AssistantDocumentBlock | null {
  const blockIndex = Number(blockId);
  if (!Number.isInteger(blockIndex) || String(blockIndex) !== blockId) {
    return null;
  }

  const block = document.content?.[blockIndex];
  if (!isEditableTopLevelBlock(block)) {
    return null;
  }

  if (newText.length === 0) {
    block.content = [];
  } else if (!block.content?.length) {
    block.content = [{ type: "text", text: newText } as JSONContent];
  } else {
    const oldText = getNodeText(block);
    block.content = replaceTextPreservingMarks(block.content, oldText, newText);
  }

  return {
    id: blockId,
    type: block.type,
    text: newText,
  };
}

export async function readDocumentForAssistant(
  filename: string,
  options: DocumentStorageOptions = {},
): Promise<ReadDocumentForAssistantResult> {
  const raw = await readDocument(filename, options);
  const document = parseDocument(raw);

  return {
    revision: getRevision(raw),
    blocks: getEditableBlocks(document),
  };
}

export async function applyDocumentEdits(
  filename: string,
  input: ApplyDocumentEditsInput,
  options: DocumentStorageOptions = {},
): Promise<ApplyDocumentEditsResult> {
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

  for (const edit of input.edits) {
    const block = getEditableBlock(document, edit.blockId);

    if (!block) {
      return {
        ok: false,
        revision: currentRevision,
        conflict: `Block ${edit.blockId} is not an editable top-level paragraph or heading.`,
      };
    }

    if (block.text !== edit.expectedText) {
      return {
        ok: false,
        revision: currentRevision,
        conflict: `Block ${edit.blockId} no longer matches the expected text. Expected "${edit.expectedText}" but found "${block.text}"`,
      };
    }
  }

  const nextDocument = structuredClone(document);
  const updatedBlocks = input.edits.flatMap((edit) => {
    const updatedBlock = replaceTopLevelBlockText(
      nextDocument,
      edit.blockId,
      edit.newText,
    );

    return updatedBlock ? [updatedBlock] : [];
  });

  await writeDocument(filename, nextDocument, options);

  return {
    ok: true,
    revision: getRevision(JSON.stringify(nextDocument, null, 2)),
    updatedBlocks,
  };
}
