import fs from "fs/promises";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { parseEnvelope, serializeEnvelope } from "./envelope";
import {
  TEMP_DATA_DIR,
  deleteDocument,
  listDocuments,
  readDocument,
  readDocumentMessages,
  readDocumentMeta,
  renameDocument,
  updateDocumentMeta,
  writeDocument,
  writeDocumentMessages,
} from "./storage";

/** All tests use TEMP_DATA_DIR to avoid writing into the repo's data/ folder. */
const TEMP = { temporary: true } as const;

const testFiles: string[] = [];

function testPath(name: string, baseDir = TEMP_DATA_DIR): string {
  const filepath = path.join(baseDir, name);
  testFiles.push(filepath);
  return filepath;
}

afterEach(async () => {
  for (const filepath of testFiles) {
    await fs.unlink(filepath).catch(() => {});
  }
  testFiles.length = 0;
});

describe("readDocument", () => {
  it("creates an empty document when file does not exist", async () => {
    const filename = `test-read-create-${Date.now()}.json`;
    testPath(filename);

    const raw = await readDocument(filename, TEMP);
    const content = JSON.parse(raw);

    expect(content).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });

    // File should now exist on disk as an envelope
    const onDisk = await fs.readFile(
      path.join(TEMP_DATA_DIR, filename),
      "utf-8",
    );
    const envelope = parseEnvelope(onDisk);
    expect(envelope.doc).toEqual(content);
  });

  it("returns content from an existing file", async () => {
    const filename = `test-read-existing-${Date.now()}.json`;
    const filepath = testPath(filename);
    const doc = { type: "doc", content: [{ type: "heading" }] };
    await fs.mkdir(TEMP_DATA_DIR, { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(doc, null, 2));

    const raw = await readDocument(filename, TEMP);
    expect(JSON.parse(raw)).toEqual(doc);
  });
});

describe("writeDocument", () => {
  it("writes pretty-printed JSON and creates the directory", async () => {
    const filename = `test-write-${Date.now()}.json`;
    const filepath = testPath(filename);
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello" }],
        },
      ],
    };

    await writeDocument(filename, doc, TEMP);

    const raw = await fs.readFile(filepath, "utf-8");
    const envelope = parseEnvelope(raw);
    expect(envelope.doc).toEqual(doc);
  });
});

describe("path sanitization", () => {
  it("strips directory traversal from filename", async () => {
    const filename = `test-safe-${Date.now()}.json`;
    testPath(filename);

    // Attempting traversal should still write inside TEMP_DATA_DIR
    await writeDocument(
      `../../etc/${filename}`,
      { type: "doc", content: [] },
      TEMP,
    );
    const raw = await fs.readFile(path.join(TEMP_DATA_DIR, filename), "utf-8");
    const envelope = parseEnvelope(raw);
    expect(envelope.doc).toEqual({ type: "doc", content: [] });
  });
});

describe("envelope integration", () => {
  it("writeDocument wraps content in an envelope on disk", async () => {
    const filename = `test-envelope-write-${Date.now()}.json`;
    testPath(filename);
    const doc = { type: "doc", content: [{ type: "paragraph" }] };

    await writeDocument(filename, doc, TEMP);

    const raw = await fs.readFile(path.join(TEMP_DATA_DIR, filename), "utf-8");
    const envelope = parseEnvelope(raw);
    expect(envelope.doc).toEqual(doc);
    expect(envelope.meta).toEqual({ usage: {} });
  });

  it("writeDocument preserves existing meta when overwriting content", async () => {
    const filename = `test-envelope-preserve-${Date.now()}.json`;
    const filepath = testPath(filename);
    const doc = { type: "doc", content: [{ type: "paragraph" }] };
    const meta = {
      usage: { "claude-haiku-4-5": { inputTokens: 100, outputTokens: 50 } },
    };

    await fs.mkdir(TEMP_DATA_DIR, { recursive: true });
    await fs.writeFile(filepath, serializeEnvelope(meta, doc));

    const newDoc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Updated" }] },
      ],
    };
    await writeDocument(filename, newDoc, TEMP);

    const raw = await fs.readFile(filepath, "utf-8");
    const envelope = parseEnvelope(raw);
    expect(envelope.doc).toEqual(newDoc);
    expect(envelope.meta).toEqual(meta);
  });

  it("readDocument returns only the doc portion from an envelope file", async () => {
    const filename = `test-envelope-read-${Date.now()}.json`;
    const filepath = testPath(filename);
    const doc = { type: "doc", content: [{ type: "heading" }] };
    const meta = {
      usage: { "claude-haiku-4-5": { inputTokens: 10, outputTokens: 5 } },
    };

    await fs.mkdir(TEMP_DATA_DIR, { recursive: true });
    await fs.writeFile(filepath, serializeEnvelope(meta, doc));

    const raw = await readDocument(filename, TEMP);
    expect(JSON.parse(raw)).toEqual(doc);
  });
});

describe("readDocumentMeta", () => {
  it("returns meta from an envelope file", async () => {
    const filename = `test-read-meta-${Date.now()}.json`;
    const filepath = testPath(filename);
    const doc = { type: "doc", content: [{ type: "paragraph" }] };
    const meta = {
      usage: { "claude-sonnet-4-5": { inputTokens: 200, outputTokens: 80 } },
    };

    await fs.mkdir(TEMP_DATA_DIR, { recursive: true });
    await fs.writeFile(filepath, serializeEnvelope(meta, doc));

    const result = await readDocumentMeta(filename, TEMP);
    expect(result).toEqual(meta);
  });

  it("returns empty meta for a bare TipTap file", async () => {
    const filename = `test-read-meta-bare-${Date.now()}.json`;
    const filepath = testPath(filename);
    const doc = { type: "doc", content: [{ type: "paragraph" }] };

    await fs.mkdir(TEMP_DATA_DIR, { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(doc, null, 2));

    const result = await readDocumentMeta(filename, TEMP);
    expect(result).toEqual({ usage: {} });
  });
});

describe("listDocuments", () => {
  it("returns filenames of JSON files in the data directory", async () => {
    const f1 = `test-list-a-${Date.now()}.json`;
    const f2 = `test-list-b-${Date.now()}.json`;
    testPath(f1);
    testPath(f2);

    await writeDocument(f1, { type: "doc", content: [] }, TEMP);
    await writeDocument(f2, { type: "doc", content: [] }, TEMP);

    const files = await listDocuments(TEMP);
    expect(files).toContain(f1);
    expect(files).toContain(f2);
  });

  it("ignores non-JSON files", async () => {
    const jsonFile = `test-list-json-${Date.now()}.json`;
    const txtFile = `test-list-txt-${Date.now()}.txt`;
    testPath(jsonFile);
    testPath(txtFile);

    await fs.mkdir(TEMP_DATA_DIR, { recursive: true });
    await fs.writeFile(path.join(TEMP_DATA_DIR, jsonFile), "{}");
    await fs.writeFile(path.join(TEMP_DATA_DIR, txtFile), "hello");

    const files = await listDocuments(TEMP);
    expect(files).toContain(jsonFile);
    expect(files).not.toContain(txtFile);
  });

  it("returns empty array for an empty directory", async () => {
    const files = await listDocuments(TEMP);
    expect(Array.isArray(files)).toBe(true);
  });
});

describe("renameDocument", () => {
  it("renames the file on disk and preserves content", async () => {
    const oldName = `test-rename-old-${Date.now()}.json`;
    const newName = `test-rename-new-${Date.now()}.json`;
    testPath(oldName);
    testPath(newName);

    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Keep me" }] },
      ],
    };
    await writeDocument(oldName, doc, TEMP);

    await renameDocument(oldName, newName, TEMP);

    // Old file should be gone
    await expect(
      fs.access(path.join(TEMP_DATA_DIR, oldName)),
    ).rejects.toThrow();

    // New file should exist with same content
    const raw = await readDocument(newName, TEMP);
    expect(JSON.parse(raw)).toEqual(doc);
  });

  it("throws when target name already exists", async () => {
    const oldName = `test-rename-src-${Date.now()}.json`;
    const newName = `test-rename-dst-${Date.now()}.json`;
    testPath(oldName);
    testPath(newName);

    await writeDocument(oldName, { type: "doc", content: [] }, TEMP);
    await writeDocument(newName, { type: "doc", content: [] }, TEMP);

    await expect(renameDocument(oldName, newName, TEMP)).rejects.toThrow(
      /already exists/,
    );
  });

  it("throws when source file does not exist", async () => {
    await expect(
      renameDocument(`nonexistent-${Date.now()}.json`, "target.json", TEMP),
    ).rejects.toThrow();
  });
});

describe("deleteDocument", () => {
  it("removes the file from disk", async () => {
    const filename = `test-delete-${Date.now()}.json`;
    const filepath = testPath(filename);

    await writeDocument(filename, { type: "doc", content: [] }, TEMP);
    await expect(fs.access(filepath)).resolves.toBeUndefined();

    await deleteDocument(filename, TEMP);
    await expect(fs.access(filepath)).rejects.toThrow();
  });

  it("throws when file does not exist", async () => {
    await expect(
      deleteDocument(`nonexistent-${Date.now()}.json`, TEMP),
    ).rejects.toThrow();
  });
});

describe("readDocumentMessages", () => {
  it("returns messages from an existing envelope", async () => {
    const filename = `test-read-msgs-${Date.now()}.json`;
    const filepath = testPath(filename);
    const doc = { type: "doc", content: [{ type: "paragraph" }] };
    const messages = [
      { id: "1", role: "user", content: "Hello" },
      { id: "2", role: "assistant", content: "Hi!" },
    ];

    await fs.mkdir(TEMP_DATA_DIR, { recursive: true });
    await fs.writeFile(
      filepath,
      serializeEnvelope({ usage: {} }, doc, messages),
    );

    const result = await readDocumentMessages(filename, TEMP);
    expect(result).toEqual(messages);
  });

  it("returns empty array for a file with no messages", async () => {
    const filename = `test-read-msgs-empty-${Date.now()}.json`;
    const filepath = testPath(filename);
    const doc = { type: "doc", content: [{ type: "paragraph" }] };

    await fs.mkdir(TEMP_DATA_DIR, { recursive: true });
    await fs.writeFile(filepath, serializeEnvelope({ usage: {} }, doc));

    const result = await readDocumentMessages(filename, TEMP);
    expect(result).toEqual([]);
  });

  it("returns empty array for a newly created file", async () => {
    const filename = `test-read-msgs-new-${Date.now()}.json`;
    testPath(filename);

    const result = await readDocumentMessages(filename, TEMP);
    expect(result).toEqual([]);
  });
});

describe("writeDocumentMessages", () => {
  it("persists messages without touching doc content", async () => {
    const filename = `test-write-msgs-${Date.now()}.json`;
    testPath(filename);
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Keep me" }] },
      ],
    };

    await writeDocument(filename, doc, TEMP);

    const messages = [{ id: "1", role: "user", content: "Hello" }];
    await writeDocumentMessages(filename, messages, TEMP);

    const raw = await readDocument(filename, TEMP);
    expect(JSON.parse(raw)).toEqual(doc);

    const result = await readDocumentMessages(filename, TEMP);
    expect(result).toEqual(messages);
  });

  it("preserves existing meta when writing messages", async () => {
    const filename = `test-write-msgs-meta-${Date.now()}.json`;
    testPath(filename);
    const doc = { type: "doc", content: [{ type: "paragraph" }] };
    const meta = {
      usage: { "claude-haiku-4-5": { inputTokens: 100, outputTokens: 50 } },
    };

    await fs.mkdir(TEMP_DATA_DIR, { recursive: true });
    await fs.writeFile(
      path.join(TEMP_DATA_DIR, filename),
      serializeEnvelope(meta, doc),
    );

    const messages = [{ id: "1", role: "user", content: "test" }];
    await writeDocumentMessages(filename, messages, TEMP);

    const readMeta = await readDocumentMeta(filename, TEMP);
    expect(readMeta).toEqual(meta);
  });
});

describe("updateDocumentMeta", () => {
  it("accumulates token usage for a model", async () => {
    const filename = `test-update-meta-${Date.now()}.json`;
    testPath(filename);
    const doc = { type: "doc", content: [{ type: "paragraph" }] };

    await writeDocument(filename, doc, TEMP);

    await updateDocumentMeta(filename, TEMP, (meta) => {
      const existing = meta.usage["claude-haiku-4-5"];
      meta.usage["claude-haiku-4-5"] = {
        inputTokens: (existing?.inputTokens ?? 0) + 500,
        outputTokens: (existing?.outputTokens ?? 0) + 100,
      };
    });

    const meta1 = await readDocumentMeta(filename, TEMP);
    expect(meta1.usage["claude-haiku-4-5"]).toEqual({
      inputTokens: 500,
      outputTokens: 100,
    });

    await updateDocumentMeta(filename, TEMP, (meta) => {
      const existing = meta.usage["claude-haiku-4-5"];
      meta.usage["claude-haiku-4-5"] = {
        inputTokens: (existing?.inputTokens ?? 0) + 200,
        outputTokens: (existing?.outputTokens ?? 0) + 50,
      };
    });

    const meta2 = await readDocumentMeta(filename, TEMP);
    expect(meta2.usage["claude-haiku-4-5"]).toEqual({
      inputTokens: 700,
      outputTokens: 150,
    });
  });

  it("works on a bare TipTap file", async () => {
    const filename = `test-update-meta-bare-${Date.now()}.json`;
    const filepath = testPath(filename);
    const doc = { type: "doc", content: [{ type: "paragraph" }] };

    await fs.mkdir(TEMP_DATA_DIR, { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(doc, null, 2));

    await updateDocumentMeta(filename, TEMP, (meta) => {
      meta.usage["claude-haiku-4-5"] = {
        inputTokens: 300,
        outputTokens: 75,
      };
    });

    const raw = await fs.readFile(filepath, "utf-8");
    const envelope = parseEnvelope(raw);
    expect(envelope.doc).toEqual(doc);
    expect(envelope.meta.usage["claude-haiku-4-5"]).toEqual({
      inputTokens: 300,
      outputTokens: 75,
    });
  });
});
