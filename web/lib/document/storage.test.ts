import fs from "fs/promises";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import { parseEnvelope, serializeEnvelope } from "./envelope";
import {
  DATA_DIR,
  TEMP_DATA_DIR,
  readDocument,
  readDocumentMeta,
  updateDocumentMeta,
  writeDocument,
} from "./storage";

const testFiles: string[] = [];

function testPath(name: string, baseDir = DATA_DIR): string {
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

    const raw = await readDocument(filename);
    const content = JSON.parse(raw);

    expect(content).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });

    // File should now exist on disk as an envelope
    const onDisk = await fs.readFile(path.join(DATA_DIR, filename), "utf-8");
    const envelope = parseEnvelope(onDisk);
    expect(envelope.doc).toEqual(content);
  });

  it("returns content from an existing file", async () => {
    const filename = `test-read-existing-${Date.now()}.json`;
    const filepath = testPath(filename);
    const doc = { type: "doc", content: [{ type: "heading" }] };
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(doc, null, 2));

    const raw = await readDocument(filename);
    expect(JSON.parse(raw)).toEqual(doc);
  });

  it("creates a temp document under /tmp when requested", async () => {
    const filename = `test-read-temp-${Date.now()}.json`;
    const filepath = testPath(filename, TEMP_DATA_DIR);

    const raw = await readDocument(filename, { temporary: true });
    const content = JSON.parse(raw);

    expect(content).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });

    const onDisk = await fs.readFile(filepath, "utf-8");
    const envelope = parseEnvelope(onDisk);
    expect(envelope.doc).toEqual(content);
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

    await writeDocument(filename, doc);

    const raw = await fs.readFile(filepath, "utf-8");
    const envelope = parseEnvelope(raw);
    expect(envelope.doc).toEqual(doc);
  });

  it("writes to the temp directory when requested", async () => {
    const filename = `test-write-temp-${Date.now()}.json`;
    const filepath = testPath(filename, TEMP_DATA_DIR);
    const doc = {
      type: "doc",
      content: [{ type: "paragraph" }],
    };

    await writeDocument(filename, doc, { temporary: true });

    const raw = await fs.readFile(filepath, "utf-8");
    const envelope = parseEnvelope(raw);
    expect(envelope.doc).toEqual(doc);
  });
});

describe("path sanitization", () => {
  it("strips directory traversal from filename", async () => {
    const filename = `test-safe-${Date.now()}.json`;
    testPath(filename);

    // Attempting traversal should still write inside DATA_DIR
    await writeDocument(`../../etc/${filename}`, { type: "doc", content: [] });
    const raw = await fs.readFile(path.join(DATA_DIR, filename), "utf-8");
    const envelope = parseEnvelope(raw);
    expect(envelope.doc).toEqual({ type: "doc", content: [] });
  });

  it("strips directory traversal for temp storage too", async () => {
    const filename = `test-safe-temp-${Date.now()}.json`;
    testPath(filename, TEMP_DATA_DIR);

    await writeDocument(
      `../../etc/${filename}`,
      { type: "doc", content: [] },
      {
        temporary: true,
      },
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

    await writeDocument(filename, doc);

    const raw = await fs.readFile(path.join(DATA_DIR, filename), "utf-8");
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

    // Write an envelope with existing usage
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(filepath, serializeEnvelope(meta, doc));

    // Overwrite content via writeDocument
    const newDoc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Updated" }] },
      ],
    };
    await writeDocument(filename, newDoc);

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

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(filepath, serializeEnvelope(meta, doc));

    const raw = await readDocument(filename);
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

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(filepath, serializeEnvelope(meta, doc));

    const result = await readDocumentMeta(filename);
    expect(result).toEqual(meta);
  });

  it("returns empty meta for a bare TipTap file", async () => {
    const filename = `test-read-meta-bare-${Date.now()}.json`;
    const filepath = testPath(filename);
    const doc = { type: "doc", content: [{ type: "paragraph" }] };

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(doc, null, 2));

    const result = await readDocumentMeta(filename);
    expect(result).toEqual({ usage: {} });
  });
});

describe("updateDocumentMeta", () => {
  it("accumulates token usage for a model", async () => {
    const filename = `test-update-meta-${Date.now()}.json`;
    testPath(filename);
    const doc = { type: "doc", content: [{ type: "paragraph" }] };

    await writeDocument(filename, doc);

    await updateDocumentMeta(filename, {}, (meta) => {
      const existing = meta.usage["claude-haiku-4-5"];
      meta.usage["claude-haiku-4-5"] = {
        inputTokens: (existing?.inputTokens ?? 0) + 500,
        outputTokens: (existing?.outputTokens ?? 0) + 100,
      };
    });

    const meta1 = await readDocumentMeta(filename);
    expect(meta1.usage["claude-haiku-4-5"]).toEqual({
      inputTokens: 500,
      outputTokens: 100,
    });

    // Accumulate more
    await updateDocumentMeta(filename, {}, (meta) => {
      const existing = meta.usage["claude-haiku-4-5"];
      meta.usage["claude-haiku-4-5"] = {
        inputTokens: (existing?.inputTokens ?? 0) + 200,
        outputTokens: (existing?.outputTokens ?? 0) + 50,
      };
    });

    const meta2 = await readDocumentMeta(filename);
    expect(meta2.usage["claude-haiku-4-5"]).toEqual({
      inputTokens: 700,
      outputTokens: 150,
    });
  });

  it("works on a bare TipTap file", async () => {
    const filename = `test-update-meta-bare-${Date.now()}.json`;
    const filepath = testPath(filename);
    const doc = { type: "doc", content: [{ type: "paragraph" }] };

    // Write bare (not envelope) file
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(doc, null, 2));

    await updateDocumentMeta(filename, {}, (meta) => {
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
