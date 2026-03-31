import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { buildDocumentTools } from "./document-tools";
import { model } from "./model";
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

  return streamText({
    model,
    messages,
    system: buildSystemPrompt({
      ...request,
      hasDocumentTools: Boolean(tools),
    }),
    tools,
    stopWhen: tools ? stepCountIs(5) : undefined,
  });
}
