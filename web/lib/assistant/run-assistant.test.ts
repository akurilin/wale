import { beforeEach, describe, expect, it, vi } from "vitest";

const mockModel = { id: "mock-model" };

const { convertToModelMessagesMock, streamTextMock } = vi.hoisted(() => ({
  convertToModelMessagesMock: vi.fn(),
  streamTextMock: vi.fn(),
}));

vi.mock("./model", () => ({
  model: mockModel,
  modelConfig: {
    provider: "Anthropic",
    modelId: "claude-haiku-4-5",
    displayName: "Claude Haiku 4.5",
  },
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
  document: {
    filename: "draft.json",
    temporary: true,
  },
  documentContext: {
    selectionText: "This paragraph needs work.",
    excerpt:
      "This paragraph needs work. The rest of the draft is about rituals.",
  },
};

describe("runAssistant", () => {
  beforeEach(() => {
    convertToModelMessagesMock.mockReset();
    streamTextMock.mockReset();
  });

  it("uses the server-owned prompt and validated messages", async () => {
    const convertedMessages = [
      { role: "user", content: [{ type: "text", text: "Hello" }] },
    ];
    const result = {
      toUIMessageStreamResponse: vi.fn(),
    };

    convertToModelMessagesMock.mockResolvedValue(convertedMessages);
    streamTextMock.mockReturnValue(result);

    const response = await runAssistant(validRequest);

    expect(response).toBe(result);
    expect(convertToModelMessagesMock).toHaveBeenCalledWith(
      validRequest.messages,
    );
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: mockModel,
        messages: convertedMessages,
        system: expect.stringContaining("This paragraph needs work."),
        tools: expect.objectContaining({
          read_document: expect.any(Object),
          edit_document: expect.any(Object),
        }),
        stopWhen: expect.any(Function),
      }),
    );
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining(
          "The rest of the draft is about rituals.",
        ),
      }),
    );
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining(
          "The current document is available through tools.",
        ),
      }),
    );
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining(
          "Use edit_document to modify the document.",
        ),
      }),
    );
  });
});
