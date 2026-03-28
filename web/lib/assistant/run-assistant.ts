import { convertToModelMessages, streamText } from "ai";
import { model } from "./model";
import { buildSystemPrompt } from "./prompt";
import type { AssistantRequest } from "./types";

export async function runAssistant(request: AssistantRequest) {
  const messages = await convertToModelMessages(request.messages);

  return streamText({
    model,
    messages,
    system: buildSystemPrompt(request),
  });
}
