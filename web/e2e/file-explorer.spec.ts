import { test, expect } from "@playwright/test";
import fs from "fs/promises";
import path from "path";
import { TEMP_DATA_DIR } from "../lib/document/storage";
import { serializeEnvelope, emptyMeta } from "../lib/document/envelope";

test.describe("File Explorer", () => {
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

  test("displays existing files in the data directory", async ({ page }) => {
    const f1 = `test-list-a-${Date.now()}.json`;
    const f2 = `test-list-b-${Date.now()}.json`;
    await createFileOnDisk(f1);
    await createFileOnDisk(f2);

    await page.goto(`/?file=${f1}&tmp=true`);
    await page.waitForFunction(() => !!window.tiptapEditor);

    const explorer = page.locator('[data-testid="file-explorer"]');
    await expect(explorer.getByText(f1.replace(".json", ""))).toBeVisible();
    await expect(explorer.getByText(f2.replace(".json", ""))).toBeVisible();
  });

  test("highlights the currently active file", async ({ page }) => {
    const filename = `test-active-${Date.now()}.json`;
    await createFileOnDisk(filename);

    await page.goto(`/?file=${filename}&tmp=true`);
    await page.waitForFunction(() => !!window.tiptapEditor);

    const activeItem = page.locator(
      '[data-testid="file-explorer"] [data-active="true"]',
    );
    await expect(activeItem).toContainText(filename.replace(".json", ""));
  });

  test("clicking a file navigates to it", async ({ page }) => {
    const f1 = `test-nav-a-${Date.now()}.json`;
    const f2 = `test-nav-b-${Date.now()}.json`;
    await createFileOnDisk(f1);
    await createFileOnDisk(f2);

    await page.goto(`/?file=${f1}&tmp=true`);
    await page.waitForFunction(() => !!window.tiptapEditor);

    // Click the second file
    await page
      .locator('[data-testid="file-explorer"]')
      .getByText(f2.replace(".json", ""))
      .click();

    await page.waitForURL(`**/?file=${f2}&tmp=true`);
    expect(page.url()).toContain(`file=${f2}`);
  });

  test("creating a new file adds it to the list and opens it", async ({
    page,
  }) => {
    const existing = `test-create-ctx-${Date.now()}.json`;
    await createFileOnDisk(existing);

    await page.goto(`/?file=${existing}&tmp=true`);
    await page.waitForFunction(() => !!window.tiptapEditor);

    await page
      .locator('[data-testid="file-explorer"]')
      .getByRole("button", { name: /new/i })
      .click();

    // Should navigate to the new untitled file
    await expect(async () => {
      expect(page.url()).toContain("file=untitled-");
    }).toPass({ timeout: 5000 });

    // Track for cleanup
    const url = new URL(page.url());
    const newFile = url.searchParams.get("file");
    if (newFile) trackFile(newFile);
  });

  test("deleting a file removes it from the list", async ({ page }) => {
    const f1 = `test-del-a-${Date.now()}.json`;
    const f2 = `test-del-b-${Date.now()}.json`;
    await createFileOnDisk(f1);
    await createFileOnDisk(f2);

    await page.goto(`/?file=${f1}&tmp=true`);
    await page.waitForFunction(() => !!window.tiptapEditor);

    const explorer = page.locator('[data-testid="file-explorer"]');

    // Hover over f2 to reveal the delete button
    const f2Item = explorer.getByText(f2.replace(".json", "")).locator("..");
    await f2Item.hover();
    await f2Item.getByTitle(`Delete ${f2}`).click();

    // f2 should disappear from the list
    await expect(explorer.getByText(f2.replace(".json", ""))).not.toBeVisible();
  });

  test("double-clicking a file enters rename mode and Enter confirms", async ({
    page,
  }) => {
    const original = `test-rename-${Date.now()}.json`;
    const renamed = `test-renamed-${Date.now()}.json`;
    await createFileOnDisk(original);
    trackFile(renamed);

    await page.goto(`/?file=${original}&tmp=true`);
    await page.waitForFunction(() => !!window.tiptapEditor);

    const explorer = page.locator('[data-testid="file-explorer"]');
    const fileButton = explorer.getByText(original.replace(".json", ""));

    // Double-click to enter rename mode
    await fileButton.dblclick();

    const input = explorer.getByLabel("Rename file");
    await expect(input).toBeVisible();

    // Clear and type the new name
    await input.fill(renamed.replace(".json", ""));
    await input.press("Enter");

    // The renamed file should appear and the old name should be gone
    await expect(
      explorer.getByText(renamed.replace(".json", "")),
    ).toBeVisible();
    await expect(
      explorer.getByText(original.replace(".json", "")),
    ).not.toBeVisible();

    // URL should update since we renamed the active file
    await expect(async () => {
      expect(page.url()).toContain(`file=${renamed}`);
    }).toPass({ timeout: 5000 });
  });

  test("Escape cancels rename without changing the file", async ({ page }) => {
    const filename = `test-esc-rename-${Date.now()}.json`;
    await createFileOnDisk(filename);

    await page.goto(`/?file=${filename}&tmp=true`);
    await page.waitForFunction(() => !!window.tiptapEditor);

    const explorer = page.locator('[data-testid="file-explorer"]');
    await explorer.getByText(filename.replace(".json", "")).dblclick();

    const input = explorer.getByLabel("Rename file");
    await input.fill("something-else");
    await input.press("Escape");

    // Input should be gone and original name should remain
    await expect(input).not.toBeVisible();
    await expect(
      explorer.getByText(filename.replace(".json", "")),
    ).toBeVisible();
  });

  test("rename shows error for duplicate name", async ({ page }) => {
    const f1 = `test-dup-a-${Date.now()}.json`;
    const f2 = `test-dup-b-${Date.now()}.json`;
    await createFileOnDisk(f1);
    await createFileOnDisk(f2);

    await page.goto(`/?file=${f1}&tmp=true`);
    await page.waitForFunction(() => !!window.tiptapEditor);

    const explorer = page.locator('[data-testid="file-explorer"]');
    await explorer.getByText(f1.replace(".json", "")).dblclick();

    const input = explorer.getByLabel("Rename file");
    // Try to rename f1 to f2's name
    await input.fill(f2.replace(".json", ""));
    await input.press("Enter");

    // Should show error and stay in rename mode
    await expect(explorer.getByText("Name already taken")).toBeVisible();
  });
});
