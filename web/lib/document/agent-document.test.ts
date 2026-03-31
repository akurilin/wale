import fs from "fs/promises";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import type { JSONContent } from "@tiptap/core";
import { TEMP_DATA_DIR } from "./storage";
import {
  applyDocumentEdits,
  editDocument,
  readDocumentForAssistant,
} from "./agent-document";

const testFiles: string[] = [];

function registerTempFile(name: string): string {
  const filepath = path.join(TEMP_DATA_DIR, name);
  testFiles.push(filepath);
  return filepath;
}

async function writeTempDocument(
  filename: string,
  content: JSONContent,
): Promise<void> {
  const filepath = registerTempFile(filename);
  await fs.mkdir(TEMP_DATA_DIR, { recursive: true });
  await fs.writeFile(filepath, JSON.stringify(content, null, 2));
}

afterEach(async () => {
  for (const filepath of testFiles) {
    await fs.unlink(filepath).catch(() => {});
  }
  testFiles.length = 0;
});

describe("readDocumentForAssistant", () => {
  it("returns editable top-level blocks with a revision token", async () => {
    const filename = `assistant-read-${Date.now()}.json`;
    await writeTempDocument(filename, {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1 },
          content: [{ type: "text", text: "Draft title" }],
        },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "The " },
            {
              type: "text",
              text: "opening",
              marks: [{ type: "bold" }],
            },
            { type: "text", text: " paragraph." },
          ],
        },
        {
          type: "blockquote",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Quoted note." }],
            },
          ],
        },
      ],
    });

    const result = await readDocumentForAssistant(filename, {
      temporary: true,
    });

    expect(result.revision).toEqual(expect.any(String));
    expect(result.blocks).toEqual([
      { id: "0", type: "heading", text: "Draft title" },
      { id: "1", type: "paragraph", text: "The opening paragraph." },
      { id: "2", type: "blockquote", text: "Quoted note." },
    ]);
  });

  it("keeps the empty starter paragraph addressable", async () => {
    const filename = `assistant-empty-${Date.now()}.json`;
    registerTempFile(filename);

    const result = await readDocumentForAssistant(filename, {
      temporary: true,
    });

    expect(result.blocks).toEqual([{ id: "0", type: "paragraph", text: "" }]);
  });
});

describe("applyDocumentEdits", () => {
  it("replaces a paragraph when the revision and expected text match", async () => {
    const filename = `assistant-edit-${Date.now()}.json`;
    const filepath = registerTempFile(filename);
    await writeTempDocument(filename, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Old paragraph." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Another paragraph." }],
        },
      ],
    });

    const before = await readDocumentForAssistant(filename, {
      temporary: true,
    });
    const result = await applyDocumentEdits(
      filename,
      {
        baseRevision: before.revision,
        edits: [
          {
            blockId: "0",
            expectedText: "Old paragraph.",
            newText: "New paragraph written by the assistant.",
          },
        ],
      },
      { temporary: true },
    );

    expect(result).toEqual({
      ok: true,
      revision: expect.any(String),
      updatedBlocks: [
        {
          id: "0",
          type: "paragraph",
          text: "New paragraph written by the assistant.",
        },
      ],
    });
    expect(result.revision).not.toBe(before.revision);

    const onDisk = JSON.parse(
      await fs.readFile(filepath, "utf-8"),
    ) as JSONContent;
    expect(onDisk.content?.[0]).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "New paragraph written by the assistant." },
      ],
    });
    expect(onDisk.content?.[1]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "Another paragraph." }],
    });
  });

  it("returns a conflict when the base revision is stale", async () => {
    const filename = `assistant-stale-${Date.now()}.json`;
    const filepath = registerTempFile(filename);
    await writeTempDocument(filename, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Original paragraph." }],
        },
      ],
    });

    const before = await readDocumentForAssistant(filename, {
      temporary: true,
    });

    await fs.writeFile(
      filepath,
      JSON.stringify(
        {
          type: "doc",
          content: [
            {
              type: "paragraph",
              content: [{ type: "text", text: "Changed elsewhere." }],
            },
          ],
        },
        null,
        2,
      ),
    );

    const result = await applyDocumentEdits(
      filename,
      {
        baseRevision: before.revision,
        edits: [
          {
            blockId: "0",
            expectedText: "Original paragraph.",
            newText: "Assistant rewrite.",
          },
        ],
      },
      { temporary: true },
    );

    expect(result).toEqual({
      ok: false,
      conflict: "Document changed before the edit could be applied.",
      revision: expect.any(String),
    });

    const onDisk = JSON.parse(
      await fs.readFile(filepath, "utf-8"),
    ) as JSONContent;
    expect(onDisk.content?.[0]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "Changed elsewhere." }],
    });
  });

  it("returns a conflict when the expected text no longer matches", async () => {
    const filename = `assistant-mismatch-${Date.now()}.json`;
    const filepath = registerTempFile(filename);
    await writeTempDocument(filename, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Actual paragraph." }],
        },
      ],
    });

    const before = await readDocumentForAssistant(filename, {
      temporary: true,
    });

    const result = await applyDocumentEdits(
      filename,
      {
        baseRevision: before.revision,
        edits: [
          {
            blockId: "0",
            expectedText: "Different paragraph.",
            newText: "Assistant rewrite.",
          },
        ],
      },
      { temporary: true },
    );

    expect(result).toEqual({
      ok: false,
      conflict:
        'Block 0 no longer matches the expected text. Expected "Different paragraph." but found "Actual paragraph."',
      revision: before.revision,
    });

    const onDisk = JSON.parse(
      await fs.readFile(filepath, "utf-8"),
    ) as JSONContent;
    expect(onDisk.content?.[0]).toEqual({
      type: "paragraph",
      content: [{ type: "text", text: "Actual paragraph." }],
    });
  });

  it("preserves inline marks when replacing text in a formatted block", async () => {
    const filename = `assistant-marks-${Date.now()}.json`;
    const filepath = registerTempFile(filename);
    await writeTempDocument(filename, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "The " },
            {
              type: "text",
              text: "opening",
              marks: [{ type: "bold" }],
            },
            { type: "text", text: " paragraph." },
          ],
        },
      ],
    });

    const before = await readDocumentForAssistant(filename, {
      temporary: true,
    });
    const result = await applyDocumentEdits(
      filename,
      {
        baseRevision: before.revision,
        edits: [
          {
            blockId: "0",
            expectedText: "The opening paragraph.",
            newText: "The beginning paragraph.",
          },
        ],
      },
      { temporary: true },
    );

    expect(result).toEqual({
      ok: true,
      revision: expect.any(String),
      updatedBlocks: [
        {
          id: "0",
          type: "paragraph",
          text: "The beginning paragraph.",
        },
      ],
    });

    const onDisk = JSON.parse(
      await fs.readFile(filepath, "utf-8"),
    ) as JSONContent;
    expect(onDisk.content?.[0].content).toEqual([
      { type: "text", text: "The " },
      { type: "text", text: "beginning", marks: [{ type: "bold" }] },
      { type: "text", text: " paragraph." },
    ]);
  });

  it("preserves marks on untouched regions when editing plain text nearby", async () => {
    const filename = `assistant-marks-nearby-${Date.now()}.json`;
    const filepath = registerTempFile(filename);
    await writeTempDocument(filename, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "The " },
            {
              type: "text",
              text: "bold",
              marks: [{ type: "bold" }],
            },
            { type: "text", text: " paragraph." },
          ],
        },
      ],
    });

    const before = await readDocumentForAssistant(filename, {
      temporary: true,
    });
    const result = await applyDocumentEdits(
      filename,
      {
        baseRevision: before.revision,
        edits: [
          {
            blockId: "0",
            expectedText: "The bold paragraph.",
            newText: "The bold sentence.",
          },
        ],
      },
      { temporary: true },
    );

    expect(result).toEqual({
      ok: true,
      revision: expect.any(String),
      updatedBlocks: [
        {
          id: "0",
          type: "paragraph",
          text: "The bold sentence.",
        },
      ],
    });

    const onDisk = JSON.parse(
      await fs.readFile(filepath, "utf-8"),
    ) as JSONContent;
    expect(onDisk.content?.[0].content).toEqual([
      { type: "text", text: "The " },
      { type: "text", text: "bold", marks: [{ type: "bold" }] },
      { type: "text", text: " sentence." },
    ]);
  });

  it("validates all edits before writing so partial updates never reach disk", async () => {
    const filename = `assistant-atomic-${Date.now()}.json`;
    const filepath = registerTempFile(filename);
    await writeTempDocument(filename, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "First paragraph." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Second paragraph." }],
        },
      ],
    });

    const before = await readDocumentForAssistant(filename, {
      temporary: true,
    });

    const result = await applyDocumentEdits(
      filename,
      {
        baseRevision: before.revision,
        edits: [
          {
            blockId: "0",
            expectedText: "First paragraph.",
            newText: "First paragraph rewritten.",
          },
          {
            blockId: "1",
            expectedText: "Wrong second paragraph.",
            newText: "Second paragraph rewritten.",
          },
        ],
      },
      { temporary: true },
    );

    expect(result).toEqual({
      ok: false,
      conflict:
        'Block 1 no longer matches the expected text. Expected "Wrong second paragraph." but found "Second paragraph."',
      revision: before.revision,
    });

    const onDisk = JSON.parse(
      await fs.readFile(filepath, "utf-8"),
    ) as JSONContent;
    expect(onDisk.content).toEqual([
      {
        type: "paragraph",
        content: [{ type: "text", text: "First paragraph." }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Second paragraph." }],
      },
    ]);
  });
});

describe("editDocument", () => {
  it("converts a paragraph into a heading without rewriting its text", async () => {
    const filename = `assistant-structural-heading-${Date.now()}.json`;
    const filepath = registerTempFile(filename);
    await writeTempDocument(filename, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Section title" }],
        },
      ],
    });

    const before = await readDocumentForAssistant(filename, {
      temporary: true,
    });
    const result = await editDocument(
      filename,
      {
        baseRevision: before.revision,
        operations: [
          {
            type: "set_block_type",
            blockId: "0",
            blockType: "heading",
            level: 2,
          },
        ],
      },
      { temporary: true },
    );

    expect(result).toEqual({
      ok: true,
      revision: expect.any(String),
      updatedBlocks: [{ id: "0", type: "heading", text: "Section title" }],
    });

    const onDisk = JSON.parse(
      await fs.readFile(filepath, "utf-8"),
    ) as JSONContent;
    expect(onDisk.content?.[0]).toEqual({
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Section title" }],
    });
  });

  it("applies a bold mark to an inline text range", async () => {
    const filename = `assistant-structural-bold-${Date.now()}.json`;
    const filepath = registerTempFile(filename);
    await writeTempDocument(filename, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Make this bold." }],
        },
      ],
    });

    const before = await readDocumentForAssistant(filename, {
      temporary: true,
    });
    const result = await editDocument(
      filename,
      {
        baseRevision: before.revision,
        operations: [
          {
            type: "apply_mark",
            blockId: "0",
            from: 5,
            to: 9,
            mark: "bold",
          },
        ],
      },
      { temporary: true },
    );

    expect(result).toEqual({
      ok: true,
      revision: expect.any(String),
      updatedBlocks: [{ id: "0", type: "paragraph", text: "Make this bold." }],
    });

    const onDisk = JSON.parse(
      await fs.readFile(filepath, "utf-8"),
    ) as JSONContent;
    expect(onDisk.content?.[0]).toEqual({
      type: "paragraph",
      content: [
        { type: "text", text: "Make " },
        { type: "text", text: "this", marks: [{ type: "bold" }] },
        { type: "text", text: " bold." },
      ],
    });
  });

  it("inserts a new paragraph block at the requested index", async () => {
    const filename = `assistant-structural-insert-${Date.now()}.json`;
    const filepath = registerTempFile(filename);
    await writeTempDocument(filename, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "First paragraph." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Third paragraph." }],
        },
      ],
    });

    const before = await readDocumentForAssistant(filename, {
      temporary: true,
    });
    const result = await editDocument(
      filename,
      {
        baseRevision: before.revision,
        operations: [
          {
            type: "insert_block",
            index: 1,
            blockType: "paragraph",
            text: "Second paragraph.",
          },
        ],
      },
      { temporary: true },
    );

    expect(result).toEqual({
      ok: true,
      revision: expect.any(String),
      updatedBlocks: [
        { id: "1", type: "paragraph", text: "Second paragraph." },
      ],
    });

    const onDisk = JSON.parse(
      await fs.readFile(filepath, "utf-8"),
    ) as JSONContent;
    expect(onDisk.content).toEqual([
      {
        type: "paragraph",
        content: [{ type: "text", text: "First paragraph." }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Second paragraph." }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Third paragraph." }],
      },
    ]);
  });

  it("wraps a top-level block in a blockquote", async () => {
    const filename = `assistant-structural-quote-${Date.now()}.json`;
    const filepath = registerTempFile(filename);
    await writeTempDocument(filename, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Quoted note." }],
        },
      ],
    });

    const before = await readDocumentForAssistant(filename, {
      temporary: true,
    });
    const result = await editDocument(
      filename,
      {
        baseRevision: before.revision,
        operations: [{ type: "wrap_in_blockquote", blockId: "0" }],
      },
      { temporary: true },
    );

    expect(result).toEqual({
      ok: true,
      revision: expect.any(String),
      updatedBlocks: [{ id: "0", type: "blockquote", text: "Quoted note." }],
    });

    const onDisk = JSON.parse(
      await fs.readFile(filepath, "utf-8"),
    ) as JSONContent;
    expect(onDisk.content?.[0]).toEqual({
      type: "blockquote",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Quoted note." }],
        },
      ],
    });
  });

  it("validates a batch before writing so invalid semantic edits stay atomic", async () => {
    const filename = `assistant-structural-atomic-${Date.now()}.json`;
    const filepath = registerTempFile(filename);
    await writeTempDocument(filename, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "First paragraph." }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Second paragraph." }],
        },
      ],
    });

    const before = await readDocumentForAssistant(filename, {
      temporary: true,
    });
    const result = await editDocument(
      filename,
      {
        baseRevision: before.revision,
        operations: [
          {
            type: "set_block_type",
            blockId: "0",
            blockType: "heading",
            level: 2,
          },
          {
            type: "apply_mark",
            blockId: "1",
            from: 100,
            to: 110,
            mark: "italic",
          },
        ],
      },
      { temporary: true },
    );

    expect(result).toEqual({
      ok: false,
      conflict:
        'Mark range 100-110 is out of bounds for block 1 text "Second paragraph."',
      revision: before.revision,
    });

    const onDisk = JSON.parse(
      await fs.readFile(filepath, "utf-8"),
    ) as JSONContent;
    expect(onDisk.content).toEqual([
      {
        type: "paragraph",
        content: [{ type: "text", text: "First paragraph." }],
      },
      {
        type: "paragraph",
        content: [{ type: "text", text: "Second paragraph." }],
      },
    ]);
  });
});
