import { test, expect, type Page } from "@playwright/test";
import os from "os";

const mod = os.platform() === "darwin" ? "Meta" : "Control";
const emptyDocument = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

async function getEditorJSON(page: Page) {
  return page.evaluate(() => window.tiptapEditor?.getJSON());
}

test.describe("TipTap Editor", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.waitForFunction(() => !!window.tiptapEditor);
  });

  test("renders starter content on load", async ({ page }) => {
    const json = await getEditorJSON(page);
    const content = json?.content;

    expect(json?.type).toBe("doc");
    expect(content).toBeDefined();
    expect(content!.length).toBe(11);

    expect(content![0]).toMatchObject({
      type: "heading",
      attrs: { level: 1 },
    });
    expect(content![0].content?.[0].text).toBe(
      "Designing a Better Writing Ritual"
    );

    expect(content![2]).toMatchObject({
      type: "heading",
      attrs: { level: 2 },
    });
    expect(content![2].content?.[0].text).toBe("Start With a Simple Frame");

    expect(content![1]).toMatchObject({
      type: "paragraph",
    });
    expect(content![1].content).toContainEqual({
      type: "text",
      text: "steady intention",
      marks: [{ type: "bold" }],
    });

    expect(content![4]).toMatchObject({
      type: "paragraph",
    });
    expect(content![4].content).toContainEqual({
      type: "text",
      text: "light",
      marks: [{ type: "italic" }],
    });
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
    const content = json?.content;

    expect(content).toBeDefined();
    expect(content!.length).toBeGreaterThanOrEqual(5);

    // H1
    expect(content![0]).toMatchObject({
      type: "heading",
      attrs: { level: 1 },
    });
    expect(content![0].content?.[0].text).toBe("My Document Title");

    // Paragraph with bold
    expect(content![1].type).toBe("paragraph");
    const p1 = content![1].content!;
    expect(p1[0]).toMatchObject({ type: "text", text: "This is " });
    expect(p1[1]).toMatchObject({
      type: "text",
      text: "bold text",
      marks: [{ type: "bold" }],
    });
    expect(p1[2]).toMatchObject({ type: "text", text: " in a paragraph." });

    // Paragraph with italic
    expect(content![2].type).toBe("paragraph");
    const p2 = content![2].content!;
    expect(p2[0]).toMatchObject({ type: "text", text: "And some " });
    expect(p2[1]).toMatchObject({
      type: "text",
      text: "italic words",
      marks: [{ type: "italic" }],
    });
    expect(p2[2]).toMatchObject({ type: "text", text: " here." });

    // H2
    expect(content![3]).toMatchObject({
      type: "heading",
      attrs: { level: 2 },
    });
    expect(content![3].content?.[0].text).toBe("A Subheading");

    // Blockquote
    expect(content![4].type).toBe("blockquote");
    expect(content![4].content?.[0].type).toBe("paragraph");
    expect(content![4].content?.[0].content?.[0].text).toBe(
      "This is a blockquote."
    );
  });
});
