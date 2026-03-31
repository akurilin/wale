import { tool } from "ai";
import { z } from "zod";
import {
  editDocument,
  readDocumentForAssistant,
} from "@/lib/document/agent-document";
import type { AssistantDocumentHandle } from "./types";

const readDocumentInputSchema = z.object({});

const editDocumentInputSchema = z.object({
  baseRevision: z.string().trim().min(1),
  operations: z
    .array(
      z.discriminatedUnion("type", [
        z.object({
          type: z.literal("replace_text"),
          blockId: z.string().trim().min(1),
          expectedText: z.string(),
          newText: z.string(),
        }),
        z.object({
          type: z.literal("set_block_type"),
          blockId: z.string().trim().min(1),
          blockType: z.enum(["heading", "paragraph"]),
          level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
        }),
        z.object({
          type: z.literal("apply_mark"),
          blockId: z.string().trim().min(1),
          from: z.number().int().min(0),
          to: z.number().int().min(0),
          mark: z.enum(["bold", "italic"]),
        }),
        z.object({
          type: z.literal("insert_block"),
          index: z.number().int().min(0),
          blockType: z.enum(["heading", "paragraph"]),
          text: z.string(),
          level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
        }),
        z.object({
          type: z.literal("wrap_in_blockquote"),
          blockId: z.string().trim().min(1),
        }),
      ]),
    )
    .min(1),
});

/**
 * Builds the per-document tool bundle exposed to the model.
 * The tools close over the current document handle so the assistant runtime
 * does not need to thread filenames through each tool invocation manually.
 */
export function buildDocumentTools(document: AssistantDocumentHandle) {
  return {
    read_document: tool({
      description:
        "Read the current document's top-level paragraphs, headings, and blockquotes.",
      inputSchema: readDocumentInputSchema,
      execute: async () =>
        readDocumentForAssistant(document.filename, {
          temporary: document.temporary,
        }),
    }),
    edit_document: tool({
      description:
        "Apply semantic document operations such as text replacement, block transforms, inline marks, inserts, and blockquotes.",
      inputSchema: editDocumentInputSchema,
      execute: async (input) =>
        editDocument(document.filename, input, {
          temporary: document.temporary,
        }),
    }),
  };
}
