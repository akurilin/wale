import { modelConfig } from "./model";
import type { AssistantDocumentContext, AssistantMode } from "./types";

const buildBaseChatPrompt = () =>
  [
    "You are Wale, an AI writing assistant embedded in a document editor.",
    `You are powered by ${modelConfig.displayName}, provided by ${modelConfig.provider} (model ID: ${modelConfig.modelId}).`,
    `The current time is ${new Date().toISOString()}.`,
    "Help the user with their writing clearly, accurately, and concisely.",
    "Use the provided document context when it is relevant, and say when context is missing instead of inventing it.",
  ].join(" ");

const buildChatContextPrompt = (
  documentContext: AssistantDocumentContext | undefined,
  hasDocumentTools: boolean,
) => {
  const sections = [buildBaseChatPrompt()];

  if (hasDocumentTools) {
    sections.push(
      [
        "The current document is available through tools.",
        "Use read_document to inspect the canonical document before making document-specific claims.",
        "Use apply_document_edits to modify the document.",
        "Do not claim an edit was made unless apply_document_edits returned ok: true.",
        "When editing, copy the exact expectedText from read_document so conflicts are detected cleanly.",
      ].join(" "),
    );
  }

  if (!documentContext) {
    return sections.join("\n\n");
  }

  sections.push("Document context:");

  if (documentContext.selectionText) {
    sections.push(`Current selection:\n${documentContext.selectionText}`);
  }

  if (documentContext.excerpt) {
    sections.push(`Document excerpt:\n${documentContext.excerpt}`);
  }

  return sections.join("\n\n");
};

export function buildSystemPrompt({
  mode,
  hasDocumentTools,
  documentContext,
}: {
  mode: AssistantMode;
  hasDocumentTools: boolean;
  documentContext?: AssistantDocumentContext;
}) {
  switch (mode) {
    case "chat":
      return buildChatContextPrompt(documentContext, hasDocumentTools);
  }
}
