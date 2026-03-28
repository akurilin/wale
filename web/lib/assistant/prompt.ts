import { modelConfig } from "./model";
import type { AssistantDocumentContext, AssistantMode } from "./types";

const BASE_CHAT_PROMPT = [
  "You are Wale, an AI writing assistant embedded in a document editor.",
  `You are powered by ${modelConfig.displayName}, provided by ${modelConfig.provider} (model ID: ${modelConfig.modelId}).`,
  "Help the user with their writing clearly, accurately, and concisely.",
  "Use the provided document context when it is relevant, and say when context is missing instead of inventing it.",
].join(" ");

const buildChatContextPrompt = (
  documentContext: AssistantDocumentContext | undefined,
) => {
  if (!documentContext) {
    return BASE_CHAT_PROMPT;
  }

  const sections = [BASE_CHAT_PROMPT, "Document context:"];

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
  documentContext,
}: {
  mode: AssistantMode;
  documentContext?: AssistantDocumentContext;
}) {
  switch (mode) {
    case "chat":
      return buildChatContextPrompt(documentContext);
  }
}
