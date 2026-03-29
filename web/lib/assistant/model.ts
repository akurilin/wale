import { anthropic } from "@ai-sdk/anthropic";
import { createMockAssistantModel } from "./mock-model";

const useMockAssistantModel =
  process.env.WALE_ASSISTANT_MODEL === "mock-document-edit";

export const modelConfig = {
  provider: useMockAssistantModel ? "Mock" : "Anthropic",
  modelId: useMockAssistantModel ? "mock-document-edit" : "claude-haiku-4-5",
  displayName: useMockAssistantModel
    ? "Mock Document Edit Model"
    : "Claude Haiku 4.5",
} as const;

export const model = useMockAssistantModel
  ? createMockAssistantModel()
  : anthropic(modelConfig.modelId);
