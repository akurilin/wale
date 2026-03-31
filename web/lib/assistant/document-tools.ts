import { tool } from "ai";
import { z } from "zod";
import {
  applyDocumentEdits,
  readDocumentForAssistant,
} from "@/lib/document/agent-document";
import type { AssistantDocumentHandle } from "./types";

const readDocumentInputSchema = z.object({});

const applyDocumentEditsInputSchema = z.object({
  baseRevision: z.string().trim().min(1),
  edits: z
    .array(
      z.object({
        blockId: z.string().trim().min(1),
        expectedText: z.string(),
        newText: z.string(),
      }),
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
        "Read the current document's editable top-level paragraphs and headings.",
      inputSchema: readDocumentInputSchema,
      execute: async () =>
        readDocumentForAssistant(document.filename, {
          temporary: document.temporary,
        }),
    }),
    apply_document_edits: tool({
      description:
        "Apply exact block-level text replacements to the current document.",
      inputSchema: applyDocumentEditsInputSchema,
      execute: async (input) =>
        applyDocumentEdits(document.filename, input, {
          temporary: document.temporary,
        }),
    }),
  };
}
