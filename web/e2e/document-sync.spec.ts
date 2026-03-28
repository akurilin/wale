import { test, expect, type Page } from "@playwright/test";
import type { JSONContent } from "@tiptap/core";
import fs from "fs/promises";
import os from "os";
import path from "path";

const mod = os.platform() === "darwin" ? "Meta" : "Control";
const DATA_DIR = path.resolve(__dirname, "..", "..", "data");

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
    const filepath = path.join(DATA_DIR, filename);
    filesToCleanup.push(filepath);

    await page.goto(`/?doc=${filename}`);
    await page.waitForFunction(() => !!window.tiptapEditor);

    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.type("Hello, this is a test document.");

    await page.keyboard.press(`${mod}+s`);

    await expect(async () => {
      const raw = await fs.readFile(filepath, "utf-8");
      const content: JSONContent = JSON.parse(raw);
      expect(extractText(content)).toContain("Hello, this is a test document.");
    }).toPass({ timeout: 5000 });
  });

  test("external file edit is reflected in the editor", async ({ page }) => {
    const filename = `test-reload-${Date.now()}.json`;
    const filepath = path.join(DATA_DIR, filename);
    filesToCleanup.push(filepath);

    await page.goto(`/?doc=${filename}`);
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
    const filepath = path.join(DATA_DIR, filename);
    filesToCleanup.push(filepath);

    await page.goto(`/?doc=${filename}`);
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

  test("opening a non-existent file creates it on disk", async ({ page }) => {
    const filename = `test-create-${Date.now()}.json`;
    const filepath = path.join(DATA_DIR, filename);
    filesToCleanup.push(filepath);

    await page.goto(`/?doc=${filename}`);
    await page.waitForFunction(() => !!window.tiptapEditor);

    await expect(async () => {
      const raw = await fs.readFile(filepath, "utf-8");
      const content: JSONContent = JSON.parse(raw);
      expect(content.type).toBe("doc");
    }).toPass({ timeout: 5000 });
  });
});
