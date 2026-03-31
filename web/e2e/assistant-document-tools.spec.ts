import { test, expect, type Page } from "@playwright/test";
import type { JSONContent } from "@tiptap/core";
import fs from "fs/promises";
import path from "path";
import { TEMP_DATA_DIR } from "../lib/document/storage";

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

test.describe("Assistant Document Tools", () => {
  const filesToCleanup: string[] = [];

  test.afterEach(async () => {
    for (const filepath of filesToCleanup) {
      await fs.unlink(filepath).catch(() => {});
    }
    filesToCleanup.length = 0;
  });

  test("reads and performs a semantic block edit through backend tools", async ({
    page,
  }) => {
    const filename = `assistant-tools-${Date.now()}.json`;
    filesToCleanup.push(path.join(TEMP_DATA_DIR, filename));

    await page.goto(`/?file=${filename}&tmp=true`);
    await page.waitForFunction(() => !!window.tiptapEditor);

    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.type("Original paragraph written by the user.");

    await page
      .getByLabel("Message input")
      .fill("Turn the first paragraph into a level 2 heading.");
    await page.getByLabel("Send message").click();

    await expect(
      page.getByText("Updated the document using the available tools."),
    ).toBeVisible();

    await expect(async () => {
      const json = await getEditorJSON(page);
      expect(json?.content?.[0]).toMatchObject({
        type: "heading",
        attrs: { level: 2 },
      });
      expect(extractText(json)).toContain(
        "Original paragraph written by the user.",
      );
    }).toPass({ timeout: 10_000 });
  });
});
