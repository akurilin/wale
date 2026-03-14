import { describe, expect, it } from "vitest";
import { AssistantRequestError, parseAssistantRequest } from "./types";

const validMessage = {
  id: "msg-1",
  role: "user" as const,
  parts: [{ type: "text" as const, text: "Hello from the editor" }],
};

describe("parseAssistantRequest", () => {
  it("defaults to chat mode and strips unsupported top-level fields", async () => {
    const request = await parseAssistantRequest({
      messages: [validMessage],
      system: "ignore me",
      callSettings: { temperature: 0.2 },
      documentContext: {
        selectionText: "Hello from the editor",
      },
    });

    expect(request).toEqual({
      mode: "chat",
      messages: [validMessage],
      documentContext: {
        selectionText: "Hello from the editor",
      },
    });
  });

  it("rejects unsupported modes", async () => {
    await expect(
      parseAssistantRequest({
        mode: "rewrite-selection",
        messages: [validMessage],
      }),
    ).rejects.toBeInstanceOf(AssistantRequestError);
  });

  it("rejects malformed UI messages", async () => {
    await expect(
      parseAssistantRequest({
        messages: [
          {
            id: "msg-1",
            role: "user",
            parts: [{ type: "text" }],
          },
        ],
      }),
    ).rejects.toBeInstanceOf(AssistantRequestError);
  });
});
