import { beforeEach, describe, expect, it, vi } from "vitest";

const { anthropicMock, convertToModelMessagesMock, streamTextMock } =
  vi.hoisted(() => ({
    anthropicMock: vi.fn(),
    convertToModelMessagesMock: vi.fn(),
    streamTextMock: vi.fn(),
  }));

vi.mock("@ai-sdk/anthropic", () => ({
  anthropic: anthropicMock,
}));

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");

  return {
    ...actual,
    convertToModelMessages: convertToModelMessagesMock,
    streamText: streamTextMock,
  };
});

import type { AssistantRequest } from "./types";
const { runAssistant } = await import("./run-assistant");

const validRequest: AssistantRequest = {
  mode: "chat",
  messages: [
    {
      id: "msg-1",
      role: "user",
      parts: [{ type: "text", text: "Help me rewrite this paragraph." }],
    },
  ],
  documentContext: {
    selectionText: "This paragraph needs work.",
    excerpt:
      "This paragraph needs work. The rest of the draft is about rituals.",
  },
};

describe("runAssistant", () => {
  beforeEach(() => {
    anthropicMock.mockReset();
    convertToModelMessagesMock.mockReset();
    streamTextMock.mockReset();
  });

  it("uses the server-owned prompt and validated messages", async () => {
    const model = { id: "mock-model" };
    const convertedMessages = [
      { role: "user", content: [{ type: "text", text: "Hello" }] },
    ];
    const result = {
      toUIMessageStreamResponse: vi.fn(),
    };

    anthropicMock.mockReturnValue(model);
    convertToModelMessagesMock.mockResolvedValue(convertedMessages);
    streamTextMock.mockReturnValue(result);

    const response = await runAssistant(validRequest);

    expect(response).toBe(result);
    expect(anthropicMock).toHaveBeenCalledWith("claude-haiku-4-5");
    expect(convertToModelMessagesMock).toHaveBeenCalledWith(
      validRequest.messages,
    );
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model,
        messages: convertedMessages,
        system: expect.stringContaining("This paragraph needs work."),
      }),
    );
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining(
          "The rest of the draft is about rituals.",
        ),
      }),
    );
  });
});
