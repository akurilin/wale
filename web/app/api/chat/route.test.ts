import { beforeEach, describe, expect, it, vi } from "vitest";

const { runAssistantMock } = vi.hoisted(() => ({
  runAssistantMock: vi.fn(),
}));

vi.mock("@/lib/assistant/run-assistant", () => ({
  runAssistant: runAssistantMock,
}));

const { POST } = await import("./route");

const validMessage = {
  id: "msg-1",
  role: "user" as const,
  parts: [{ type: "text" as const, text: "Hello from the editor" }],
};

describe("POST /api/chat", () => {
  beforeEach(() => {
    runAssistantMock.mockReset();
  });

  it("returns 400 when the request payload is invalid", async () => {
    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messages: "not-an-array",
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        error: expect.stringContaining("Invalid assistant request"),
      }),
    );
    expect(runAssistantMock).not.toHaveBeenCalled();
  });

  it("passes the validated app request to the assistant service", async () => {
    runAssistantMock.mockResolvedValue({
      toUIMessageStreamResponse: () =>
        new Response("streamed-response", { status: 200 }),
    });

    const response = await POST(
      new Request("http://localhost/api/chat", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          messages: [validMessage],
          document: {
            filename: "draft.json",
            temporary: true,
          },
          system: "client owned prompt should be ignored",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("streamed-response");
    expect(runAssistantMock).toHaveBeenCalledWith({
      mode: "chat",
      document: {
        filename: "draft.json",
        temporary: true,
      },
      messages: [validMessage],
    });
  });
});
