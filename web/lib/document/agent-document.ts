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

  block.content =
    newText.length > 0 ? [{ type: "text", text: newText } as JSONContent] : [];

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
