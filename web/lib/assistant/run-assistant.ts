import { convertToModelMessages, stepCountIs, streamText } from "ai";
import { buildDocumentTools } from "./document-tools";
import { model } from "./model";
import { buildSystemPrompt } from "./prompt";
import type { AssistantRequest } from "./types";

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
