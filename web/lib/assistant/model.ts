import { anthropic } from "@ai-sdk/anthropic";
import { createMockAssistantModel } from "./mock-model";

// Tests and local debugging can swap in a deterministic mock model so the
// assistant pipeline can be exercised without calling a live provider.
const useMockAssistantModel =
  process.env.WALE_ASSISTANT_MODEL === "mock-document-edit";

// Keep the human-readable model metadata alongside the actual model selection so
// prompts and diagnostics can describe the runtime accurately.
export const modelConfig = {
  provider: useMockAssistantModel ? "Mock" : "Anthropic",
  modelId: useMockAssistantModel ? "mock-document-edit" : "claude-haiku-4-5",
  displayName: useMockAssistantModel
    ? "Mock Document Edit Model"
    : "Claude Haiku 4.5",
} as const;

// Export the concrete model instance the assistant runtime streams against.
export const model = useMockAssistantModel
  ? createMockAssistantModel()
  : anthropic(modelConfig.modelId);
