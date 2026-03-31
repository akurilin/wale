import { convertReadableStreamToArray } from "ai/test";
import { describe, expect, it } from "vitest";
import { createMockAssistantModel } from "./mock-model";

describe("createMockAssistantModel", () => {
  it("requests the semantic edit tool after reading the document", async () => {
    const model = createMockAssistantModel();

    const result = await model.doStream({
      prompt: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Turn the first paragraph into a level 2 heading.",
            },
          ],
        },
        {
          role: "assistant",
          content: [
            {
              type: "tool-result",
              toolCallId: "tool-read-document",
              toolName: "read_document",
              output: {
                type: "json",
                value: {
                  revision: "revision-1",
                  blocks: [
                    {
                      id: "0",
                      type: "paragraph",
                      text: "Turn me into a heading",
                    },
                  ],
                },
              },
            },
          ],
        },
      ],
    } as Parameters<typeof model.doStream>[0]);

    const chunks = await convertReadableStreamToArray(result.stream);

    expect(chunks[0]).toMatchObject({
      type: "tool-call",
      toolName: "edit_document",
    });
    expect(JSON.parse((chunks[0] as { input: string }).input)).toEqual({
      baseRevision: "revision-1",
      operations: [
        {
          type: "set_block_type",
          blockId: "0",
          blockType: "heading",
          level: 2,
        },
      ],
    });
  });
});
