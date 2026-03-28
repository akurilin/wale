import { anthropic } from "@ai-sdk/anthropic";

export const modelConfig = {
  provider: "Anthropic",
  modelId: "claude-haiku-4-5",
  displayName: "Claude Haiku 4.5",
} as const;

export const model = anthropic(modelConfig.modelId);
