import { test, expect, type Page } from "@playwright/test";
import type { JSONContent } from "@tiptap/core";
import os from "os";

const mod = os.platform() === "darwin" ? "Meta" : "Control";
const emptyDocument: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

async function getEditorJSON(page: Page): Promise<JSONContent | null> {
  return page.evaluate(() => window.tiptapEditor?.getJSON() ?? null);
}

function getChildNodes(node: JSONContent | undefined): JSONContent[] {
  return node?.content ?? [];
}

function getNodeText(node: JSONContent | undefined): string | undefined {
  return node?.text;
}

test.describe("TipTap Editor", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => !!window.tiptapEditor);
  });

  test("renders empty document on load", async ({ page }) => {
    const json = await getEditorJSON(page);

    expect(json?.type).toBe("doc");
    expect(json?.content).toHaveLength(1);
    expect(json?.content?.[0]).toMatchObject({ type: "paragraph" });
  });

  test("types formatted content and validates document structure", async ({
    page,
  }) => {
    await page.evaluate((doc) => {
      window.tiptapEditor?.commands.setContent(doc);
    }, emptyDocument);

    const editor = page.locator(".tiptap");
    await editor.click();

    // H1 via markdown input rule
    await page.keyboard.type("# My Document Title");
    await page.keyboard.press("Enter");

    // Paragraph with bold text
    await page.keyboard.type("This is ");
    await page.keyboard.press(`${mod}+b`);
    await page.keyboard.type("bold text");
    await page.keyboard.press(`${mod}+b`);
    await page.keyboard.type(" in a paragraph.");
    await page.keyboard.press("Enter");

    // Paragraph with italic text
    await page.keyboard.type("And some ");
    await page.keyboard.press(`${mod}+i`);
    await page.keyboard.type("italic words");
    await page.keyboard.press(`${mod}+i`);
    await page.keyboard.type(" here.");
    await page.keyboard.press("Enter");

    // H2 via markdown input rule
    await page.keyboard.type("## A Subheading");
    await page.keyboard.press("Enter");

    // Blockquote via markdown input rule
    await page.keyboard.type("> This is a blockquote.");
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter"); // exit blockquote

    const json = await getEditorJSON(page);
    const content = json?.content ?? [];

    expect(content.length).toBeGreaterThanOrEqual(5);

    // H1
    expect(content[0]).toMatchObject({
      type: "heading",
      attrs: { level: 1 },
    });
    expect(getNodeText(getChildNodes(content[0])[0])).toBe("My Document Title");

    // Paragraph with bold
    expect(content[1]?.type).toBe("paragraph");
    const p1 = getChildNodes(content[1]);
    expect(p1[0]).toMatchObject({ type: "text", text: "This is " });
    expect(p1[1]).toMatchObject({
      type: "text",
      text: "bold text",
      marks: [{ type: "bold" }],
    });
    expect(p1[2]).toMatchObject({ type: "text", text: " in a paragraph." });

    // Paragraph with italic
    expect(content[2]?.type).toBe("paragraph");
    const p2 = getChildNodes(content[2]);
    expect(p2[0]).toMatchObject({ type: "text", text: "And some " });
    expect(p2[1]).toMatchObject({
      type: "text",
      text: "italic words",
      marks: [{ type: "italic" }],
    });
    expect(p2[2]).toMatchObject({ type: "text", text: " here." });

    // H2
    expect(content[3]).toMatchObject({
      type: "heading",
      attrs: { level: 2 },
    });
    expect(getNodeText(getChildNodes(content[3])[0])).toBe("A Subheading");

    // Blockquote
    expect(content[4]?.type).toBe("blockquote");
    const blockquoteParagraph = getChildNodes(content[4])[0];
    expect(blockquoteParagraph?.type).toBe("paragraph");
    expect(getNodeText(getChildNodes(blockquoteParagraph)[0])).toBe(
      "This is a blockquote.",
    );
  });
});
