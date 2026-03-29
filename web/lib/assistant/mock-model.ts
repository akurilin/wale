import type {
  LanguageModelV3Prompt,
  LanguageModelV3ToolResultPart,
} from "@ai-sdk/provider";
import { simulateReadableStream } from "ai";
import { MockLanguageModelV3 } from "ai/test";

function createUsage() {
  return {
    inputTokens: {
      total: 1,
      noCache: 1,
      cacheRead: undefined,
      cacheWrite: undefined,
    },
    outputTokens: {
      total: 1,
      text: 1,
      reasoning: undefined,
    },
  };
}

function createToolStep(toolCallId: string, toolName: string, input: unknown) {
  return {
    stream: simulateReadableStream({
      chunks: [
        {
          type: "tool-call" as const,
          toolCallId,
          toolName,
          input: JSON.stringify(input),
        },
        {
          type: "finish" as const,
          finishReason: { unified: "tool-calls" as const, raw: "tool-calls" },
          usage: createUsage(),
        },
      ],
    }),
  };
}

function createTextStep(text: string) {
  return {
    stream: simulateReadableStream({
      chunks: [
        { type: "text-start" as const, id: "text-1" },
        { type: "text-delta" as const, id: "text-1", delta: text },
        { type: "text-end" as const, id: "text-1" },
        {
          type: "finish" as const,
          finishReason: { unified: "stop" as const, raw: "stop" },
          usage: createUsage(),
        },
      ],
    }),
  };
}

function getLastUserText(prompt: LanguageModelV3Prompt): string {
  const userMessages = prompt.filter(
    (message): message is Extract<(typeof prompt)[number], { role: "user" }> =>
      message.role === "user",
  );

  const lastUserMessage = userMessages.at(-1);
  if (!lastUserMessage) {
    return "";
  }

  return lastUserMessage.content
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

function getToolResult<T>(
  prompt: LanguageModelV3Prompt,
  toolName: string,
): T | undefined {
  for (
    let messageIndex = prompt.length - 1;
    messageIndex >= 0;
    messageIndex--
  ) {
    const message = prompt[messageIndex];
    if (!Array.isArray(message.content)) {
      continue;
    }

    const toolResult = message.content.find(
      (part): part is LanguageModelV3ToolResultPart =>
        part.type === "tool-result" && part.toolName === toolName,
    );

    if (toolResult) {
      return toolResult.output.type === "json"
        ? (toolResult.output.value as T)
        : undefined;
    }
  }

  return undefined;
}

function extractRequestedRewrite(userText: string): string {
  const exactRewriteMatch = userText.match(/says exactly:\s*(.+)$/i);
  if (exactRewriteMatch) {
    return exactRewriteMatch[1].trim().replace(/^"(.*)"$/, "$1");
  }

  const sayRewriteMatch = userText.match(/to say:\s*(.+)$/i);
  if (sayRewriteMatch) {
    return sayRewriteMatch[1].trim().replace(/^"(.*)"$/, "$1");
  }

  return "Updated by the mock assistant.";
}

type ReadDocumentResult = {
  revision: string;
  blocks: Array<{ id: string; type: string; text: string }>;
};

export function createMockAssistantModel() {
  return new MockLanguageModelV3({
    provider: "mock",
    modelId: "mock-document-edit",
    doStream: async ({ prompt }) => {
      const readResult = getToolResult<ReadDocumentResult>(
        prompt,
        "read_document",
      );

      if (!readResult) {
        return createToolStep("tool-read-document", "read_document", {});
      }

      const applyResult = getToolResult<{ ok: boolean }>(
        prompt,
        "apply_document_edits",
      );

      if (!applyResult) {
        const targetBlock = readResult.blocks.find(
          (block) => block.type === "paragraph",
        );
        const replacementText = extractRequestedRewrite(
          getLastUserText(prompt),
        );

        return createToolStep(
          "tool-apply-document-edits",
          "apply_document_edits",
          {
            baseRevision: readResult.revision,
            edits: [
              {
                blockId: targetBlock?.id ?? "0",
                expectedText: targetBlock?.text ?? "",
                newText: replacementText,
              },
            ],
          },
        );
      }

      return createTextStep("Updated the document using the available tools.");
    },
  });
}
