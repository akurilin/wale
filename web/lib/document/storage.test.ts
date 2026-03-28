import fs from "fs/promises";
import path from "path";
import { afterEach, describe, expect, it } from "vitest";
import {
  DATA_DIR,
  TEMP_DATA_DIR,
  readDocument,
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

    // File should now exist on disk
    const onDisk = await fs.readFile(path.join(DATA_DIR, filename), "utf-8");
    expect(JSON.parse(onDisk)).toEqual(content);
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
    expect(JSON.parse(onDisk)).toEqual(content);
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
    expect(raw).toBe(JSON.stringify(doc, null, 2));
    expect(JSON.parse(raw)).toEqual(doc);
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
    expect(JSON.parse(raw)).toEqual(doc);
  });
});

describe("path sanitization", () => {
  it("strips directory traversal from filename", async () => {
    const filename = `test-safe-${Date.now()}.json`;
    testPath(filename);

    // Attempting traversal should still write inside DATA_DIR
    await writeDocument(`../../etc/${filename}`, { type: "doc", content: [] });
    const raw = await fs.readFile(path.join(DATA_DIR, filename), "utf-8");
    expect(JSON.parse(raw)).toEqual({ type: "doc", content: [] });
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
    expect(JSON.parse(raw)).toEqual({ type: "doc", content: [] });
  });
});
