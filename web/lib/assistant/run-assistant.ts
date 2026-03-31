import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { updateDocumentMeta } from "@/lib/document/storage";
import { buildDocumentTools } from "./document-tools";
import { createModel, modelConfig } from "./model";
import { buildSystemPrompt } from "./prompt";
import type { AssistantRequest } from "./types";

/**
 * Converts a validated assistant request into a streaming model call.
 * This is the single place where prompt construction, tool wiring, and the
 * model runtime come together before the API route returns a stream response.
 */
export async function runAssistant(request: AssistantRequest) {
  const messages = await convertToModelMessages(request.messages);
  const tools = request.document
    ? buildDocumentTools(request.document)
    : undefined;

  const modelId = request.model ?? modelConfig.modelId;
  const model = createModel(modelId);

  return streamText({
    model,
    messages,
    system: buildSystemPrompt({
      ...request,
      hasDocumentTools: Boolean(tools),
    }),
    tools,
    stopWhen: tools ? stepCountIs(5) : undefined,
    onFinish: ({ totalUsage }) => {
      if (!request.document) return;

      const inputTokens = totalUsage.inputTokens ?? 0;
      const outputTokens = totalUsage.outputTokens ?? 0;
      if (inputTokens === 0 && outputTokens === 0) return;

      updateDocumentMeta(
        request.document.filename,
        { temporary: request.document.temporary },
        (meta) => {
          const existing = meta.usage[modelId];
          meta.usage[modelId] = {
            inputTokens: (existing?.inputTokens ?? 0) + inputTokens,
            outputTokens: (existing?.outputTokens ?? 0) + outputTokens,
          };
        },
      ).catch((err) => {
        console.error("Failed to update document usage metadata:", err);
      });
    },
  });
}
