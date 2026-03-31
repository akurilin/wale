import { beforeEach, describe, expect, it, vi } from "vitest";

const mockModel = { id: "mock-model" };

const { convertToModelMessagesMock, streamTextMock, updateDocumentMetaMock } =
  vi.hoisted(() => ({
    convertToModelMessagesMock: vi.fn(),
    streamTextMock: vi.fn(),
    updateDocumentMetaMock: vi.fn(),
  }));

vi.mock("./model", () => ({
  createModel: () => mockModel,
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

vi.mock("@/lib/document/storage", () => ({
  updateDocumentMeta: updateDocumentMetaMock,
}));

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
    updateDocumentMetaMock.mockReset();
    updateDocumentMetaMock.mockResolvedValue(undefined);
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

  it("passes an onFinish callback to streamText", async () => {
    convertToModelMessagesMock.mockResolvedValue([]);
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: vi.fn(),
    });

    await runAssistant(validRequest);

    const streamTextArgs = streamTextMock.mock.calls[0][0];
    expect(streamTextArgs.onFinish).toBeTypeOf("function");
  });

  it("onFinish accumulates token usage via updateDocumentMeta", async () => {
    convertToModelMessagesMock.mockResolvedValue([]);
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: vi.fn(),
    });

    await runAssistant(validRequest);

    // Extract and invoke the onFinish callback
    const streamTextArgs = streamTextMock.mock.calls[0][0];
    const onFinish = streamTextArgs.onFinish;

    onFinish({
      totalUsage: {
        inputTokens: 500,
        outputTokens: 100,
        totalTokens: 600,
      },
    });

    // Allow the promise to resolve
    await vi.waitFor(() => {
      expect(updateDocumentMetaMock).toHaveBeenCalledWith(
        "draft.json",
        { temporary: true },
        expect.any(Function),
      );
    });

    // Verify the updater function accumulates correctly
    const updater = updateDocumentMetaMock.mock.calls[0][2];
    const meta = { usage: {} as Record<string, unknown> };
    updater(meta);
    expect(meta.usage["claude-haiku-4-5"]).toEqual({
      inputTokens: 500,
      outputTokens: 100,
    });

    // Call again to verify accumulation
    updater(meta);
    expect(meta.usage["claude-haiku-4-5"]).toEqual({
      inputTokens: 1000,
      outputTokens: 200,
    });
  });

  it("skips usage tracking when there is no document", async () => {
    const requestWithoutDoc: AssistantRequest = {
      ...validRequest,
      document: undefined,
    };

    convertToModelMessagesMock.mockResolvedValue([]);
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: vi.fn(),
    });

    await runAssistant(requestWithoutDoc);

    const streamTextArgs = streamTextMock.mock.calls[0][0];
    streamTextArgs.onFinish({
      totalUsage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
    });

    // Give async operations a tick
    await new Promise((r) => setTimeout(r, 10));
    expect(updateDocumentMetaMock).not.toHaveBeenCalled();
  });

  it("skips usage tracking when tokens are zero", async () => {
    convertToModelMessagesMock.mockResolvedValue([]);
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: vi.fn(),
    });

    await runAssistant(validRequest);

    const streamTextArgs = streamTextMock.mock.calls[0][0];
    streamTextArgs.onFinish({
      totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    });

    await new Promise((r) => setTimeout(r, 10));
    expect(updateDocumentMetaMock).not.toHaveBeenCalled();
  });

  it("uses request model ID when provided", async () => {
    const requestWithModel: AssistantRequest = {
      ...validRequest,
      model: "claude-sonnet-4-5",
    };

    convertToModelMessagesMock.mockResolvedValue([]);
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: vi.fn(),
    });

    await runAssistant(requestWithModel);

    const streamTextArgs = streamTextMock.mock.calls[0][0];
    streamTextArgs.onFinish({
      totalUsage: { inputTokens: 200, outputTokens: 80, totalTokens: 280 },
    });

    await vi.waitFor(() => {
      expect(updateDocumentMetaMock).toHaveBeenCalled();
    });

    const updater = updateDocumentMetaMock.mock.calls[0][2];
    const meta = { usage: {} as Record<string, unknown> };
    updater(meta);
    expect(meta.usage["claude-sonnet-4-5"]).toEqual({
      inputTokens: 200,
      outputTokens: 80,
    });
  });
});
