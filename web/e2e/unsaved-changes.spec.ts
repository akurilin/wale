import { test, expect } from "@playwright/test";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { TEMP_DATA_DIR } from "../lib/document/storage";
import { serializeEnvelope, emptyMeta } from "../lib/document/envelope";

const mod = os.platform() === "darwin" ? "Meta" : "Control";

test.describe("Unsaved Changes", () => {
  const filesToCleanup: string[] = [];

  test.afterEach(async () => {
    for (const filepath of filesToCleanup) {
      await fs.unlink(filepath).catch(() => {});
    }
    filesToCleanup.length = 0;
  });

  function trackFile(filename: string) {
    filesToCleanup.push(path.join(TEMP_DATA_DIR, filename));
  }

  async function createFileOnDisk(filename: string) {
    const doc = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: `Content of ${filename}` }],
        },
      ],
    };
    await fs.mkdir(TEMP_DATA_DIR, { recursive: true });
    await fs.writeFile(
      path.join(TEMP_DATA_DIR, filename),
      serializeEnvelope(emptyMeta(), doc),
    );
    trackFile(filename);
  }

  test("typing without saving then switching shows a warning dialog", async ({
    page,
  }) => {
    const f1 = `test-dirty-a-${Date.now()}.json`;
    const f2 = `test-dirty-b-${Date.now()}.json`;
    await createFileOnDisk(f1);
    await createFileOnDisk(f2);

    await page.goto(`/?file=${f1}&tmp=true`);
    await page.waitForFunction(() => !!window.tiptapEditor);

    // Wait for the dirty tracker to capture initial content
    await page.waitForTimeout(1000);

    // Type something without saving
    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.type("Unsaved edits here");

    // Try to switch files
    await page
      .locator('[data-testid="file-explorer"]')
      .getByText(f2.replace(".json", ""))
      .click();

    // The unsaved changes dialog should appear
    await expect(
      page.getByRole("heading", { name: "Unsaved changes" }),
    ).toBeVisible();
  });

  test("confirming the dialog discards changes and switches", async ({
    page,
  }) => {
    const f1 = `test-discard-a-${Date.now()}.json`;
    const f2 = `test-discard-b-${Date.now()}.json`;
    await createFileOnDisk(f1);
    await createFileOnDisk(f2);

    await page.goto(`/?file=${f1}&tmp=true`);
    await page.waitForFunction(() => !!window.tiptapEditor);
    await page.waitForTimeout(1000);

    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.type("Will be discarded");

    await page
      .locator('[data-testid="file-explorer"]')
      .getByText(f2.replace(".json", ""))
      .click();

    await expect(
      page.getByRole("heading", { name: "Unsaved changes" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /discard/i }).click();

    // Should have navigated to f2
    await page.waitForURL(`**/?file=${f2}&tmp=true`);
    expect(page.url()).toContain(`file=${f2}`);
  });

  test("canceling the dialog stays on the current file", async ({ page }) => {
    const f1 = `test-cancel-a-${Date.now()}.json`;
    const f2 = `test-cancel-b-${Date.now()}.json`;
    await createFileOnDisk(f1);
    await createFileOnDisk(f2);

    await page.goto(`/?file=${f1}&tmp=true`);
    await page.waitForFunction(() => !!window.tiptapEditor);
    await page.waitForTimeout(1000);

    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.type("Keep my edits");

    await page
      .locator('[data-testid="file-explorer"]')
      .getByText(f2.replace(".json", ""))
      .click();

    await expect(
      page.getByRole("heading", { name: "Unsaved changes" }),
    ).toBeVisible();
    await page.getByRole("button", { name: /cancel/i }).click();

    // Should still be on f1
    expect(page.url()).toContain(`file=${f1}`);
  });

  test("saving then switching shows no warning", async ({ page }) => {
    const f1 = `test-saved-a-${Date.now()}.json`;
    const f2 = `test-saved-b-${Date.now()}.json`;
    await createFileOnDisk(f1);
    await createFileOnDisk(f2);

    await page.goto(`/?file=${f1}&tmp=true`);
    await page.waitForFunction(() => !!window.tiptapEditor);

    const editor = page.locator(".tiptap");
    await editor.click();
    await page.keyboard.type("Saved content");
    await page.keyboard.press(`${mod}+s`);

    // Wait for save to complete
    await expect(async () => {
      const raw = await fs.readFile(path.join(TEMP_DATA_DIR, f1), "utf-8");
      expect(raw).toContain("Saved content");
    }).toPass({ timeout: 5000 });

    // Switch files — no dialog should appear
    await page
      .locator('[data-testid="file-explorer"]')
      .getByText(f2.replace(".json", ""))
      .click();

    await page.waitForURL(`**/?file=${f2}&tmp=true`);
    expect(page.url()).toContain(`file=${f2}`);
  });

  test("no edits means no warning on switch", async ({ page }) => {
    const f1 = `test-clean-a-${Date.now()}.json`;
    const f2 = `test-clean-b-${Date.now()}.json`;
    await createFileOnDisk(f1);
    await createFileOnDisk(f2);

    await page.goto(`/?file=${f1}&tmp=true`);
    await page.waitForFunction(() => !!window.tiptapEditor);

    // Switch without editing
    await page
      .locator('[data-testid="file-explorer"]')
      .getByText(f2.replace(".json", ""))
      .click();

    await page.waitForURL(`**/?file=${f2}&tmp=true`);
    expect(page.url()).toContain(`file=${f2}`);
  });
});
