import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText } from "ai";
import { buildSystemPrompt } from "./prompt";
import type { AssistantRequest } from "./types";

export async function runAssistant(request: AssistantRequest) {
  const messages = await convertToModelMessages(request.messages);

  return streamText({
    model: anthropic("claude-haiku-4-5"),
    messages,
    system: buildSystemPrompt(request),
  });
}
