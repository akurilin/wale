import { test, expect, type Page } from "@playwright/test";
import type { JSONContent } from "@tiptap/core";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { TEMP_DATA_DIR } from "../lib/document/storage";
import {
  emptyMeta,
  parseEnvelope,
  serializeEnvelope,
} from "../lib/document/envelope";

const mod = os.platform() === "darwin" ? "Meta" : "Control";

const EMPTY_DOC = {
  type: "doc" as const,
  content: [{ type: "paragraph" as const }],
};

/** Creates an empty document on disk so page.tsx's existence check passes. */
async function seedFile(filepath: string): Promise<void> {
  await fs.mkdir(path.dirname(filepath), { recursive: true });
  await fs.writeFile(filepath, serializeEnvelope(emptyMeta(), EMPTY_DOC));
}

async function getEditorJSON(page: Page): Promise<JSONContent | null> {
  return page.evaluate(() => window.tiptapEditor?.getJSON() ?? null);
}

function extractText(node: JSONContent | null): string {
  if (!node) return "";
  let text = node.text ?? "";
  for (const child of node.content ?? []) {
    text += extractText(child);
  }
  return text;
}

test.describe("Document Sync", () => {
  const filesToCleanup: string[] = [];

  test.afterEach(async () => {
    for (const filepath of filesToCleanup) {
      await fs.unlink(filepath).catch(() => {});
    }
    filesToCleanup.length = 0;
  });

  test("Cmd+S saves editor content to disk", async ({ page }) => {
    const filename = `test-save-${Date.now()}.json`;
    const filepath = path.join(TEMP_DATA_DIR, filename);
    filesToCleanup.push(filepath);

    await seedFile(filepath);
    await page.goto(`/?file=${filename}&tmp=true`);
    await page.waitForFunction(() => !!window.tiptapEditor);

    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.type("Hello, this is a test document.");

    await page.keyboard.press(`${mod}+s`);

    await expect(async () => {
      const raw = await fs.readFile(filepath, "utf-8");
      const { doc } = parseEnvelope(raw);
      expect(extractText(doc as JSONContent)).toContain(
        "Hello, this is a test document.",
      );
    }).toPass({ timeout: 5000 });
  });

  test("external file edit is reflected in the editor", async ({ page }) => {
    const filename = `test-reload-${Date.now()}.json`;
    const filepath = path.join(TEMP_DATA_DIR, filename);
    filesToCleanup.push(filepath);

    await seedFile(filepath);
    await page.goto(`/?file=${filename}&tmp=true`);
    await page.waitForFunction(() => !!window.tiptapEditor);

    const externalContent: JSONContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Externally written content." }],
        },
      ],
    };
    await fs.writeFile(filepath, JSON.stringify(externalContent, null, 2));

    await expect(async () => {
      const json = await getEditorJSON(page);
      expect(extractText(json)).toContain("Externally written content.");
    }).toPass({ timeout: 5000 });
  });

  test("save does not trigger redundant reload", async ({ page }) => {
    const filename = `test-no-loop-${Date.now()}.json`;
    const filepath = path.join(TEMP_DATA_DIR, filename);
    filesToCleanup.push(filepath);

    await seedFile(filepath);
    await page.goto(`/?file=${filename}&tmp=true`);
    await page.waitForFunction(() => !!window.tiptapEditor);

    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.type("Content to save.");

    await page.keyboard.press(`${mod}+s`);

    // Wait for save to complete
    await expect(async () => {
      const raw = await fs.readFile(filepath, "utf-8");
      expect(raw).toContain("Content to save.");
    }).toPass({ timeout: 5000 });

    // Type more after saving
    await page.keyboard.type(" Extra text after save.");

    // Wait several poll cycles — if loop prevention fails, the editor would
    // reload the saved version and lose "Extra text after save."
    await page.waitForTimeout(3000);

    const json = await getEditorJSON(page);
    expect(extractText(json)).toContain("Extra text after save.");
  });

  test("nonexistent file shows empty state instead of the editor", async ({
    page,
  }) => {
    const filename = `test-missing-${Date.now()}.json`;

    await page.goto(`/?file=${filename}&tmp=true`);

    // Should not render the editor — the TipTap instance should never appear.
    await expect(page.locator(".tiptap")).not.toBeVisible({ timeout: 3000 });
  });

  test("missing file param opens the first available file", async ({
    page,
  }) => {
    const filename = `test-first-${Date.now()}.json`;
    const filepath = path.join(TEMP_DATA_DIR, filename);
    filesToCleanup.push(filepath);

    await seedFile(filepath);

    await page.goto("/?tmp=true");
    await page.waitForURL(`**/?file=*&tmp=true`);

    expect(page.url()).toContain(`file=`);
  });
});
