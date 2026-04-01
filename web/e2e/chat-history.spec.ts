import { test, expect } from "@playwright/test";
import fs from "fs/promises";
import path from "path";
import { TEMP_DATA_DIR } from "../lib/document/storage";
import { serializeEnvelope, emptyMeta } from "../lib/document/envelope";

test.describe("Chat History", () => {
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

  test("a new file starts with an empty chat thread", async ({ page }) => {
    const filename = `test-empty-chat-${Date.now()}.json`;
    await createFileOnDisk(filename);

    await page.goto(`/?file=${filename}&tmp=true`);
    await page.waitForFunction(() => !!window.tiptapEditor);

    // The thread should show the welcome/empty state with no messages
    const thread = page.locator(".aui-thread-viewport");
    await expect(thread).toBeVisible();

    // No user or assistant messages should be present
    const messages = page.locator(
      '[data-role="user"], [data-role="assistant"]',
    );
    await expect(messages).toHaveCount(0);
  });

  test("two different files maintain independent chat histories", async ({
    page,
  }) => {
    const f1 = `test-chat-a-${Date.now()}.json`;
    const f2 = `test-chat-b-${Date.now()}.json`;
    await createFileOnDisk(f1);
    await createFileOnDisk(f2);

    // Open file 1 and send a message
    await page.goto(`/?file=${f1}&tmp=true`);
    await page.waitForFunction(() => !!window.tiptapEditor);

    const composer = page.locator(".aui-composer-input");
    await composer.first().fill("Message for file one");
    await composer.first().press("Enter");

    // Wait for the assistant to respond (mock model)
    await expect(page.locator('[data-role="assistant"]').first()).toBeVisible({
      timeout: 15000,
    });

    // Navigate to file 2
    await page
      .locator('[data-testid="file-explorer"]')
      .getByText(f2.replace(".json", ""))
      .click();
    await page.waitForURL(`**/?file=${f2}&tmp=true`);
    await page.waitForFunction(() => !!window.tiptapEditor);

    // File 2 should have no messages
    await expect(async () => {
      const count = await page.locator('[data-role="user"]').count();
      expect(count).toBe(0);
    }).toPass({ timeout: 5000 });
  });
});
