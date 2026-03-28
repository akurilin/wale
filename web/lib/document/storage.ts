import fs from "fs/promises";
import path from "path";

const DATA_DIR = path.resolve(process.cwd(), "..", "data");

const EMPTY_DOCUMENT = {
  type: "doc" as const,
  content: [{ type: "paragraph" as const }],
};

function resolveDocPath(filename: string): string {
  const safe = path.basename(filename);
  if (!safe) throw new Error("Invalid filename.");
  return path.join(DATA_DIR, safe);
}

export async function readDocument(filename: string): Promise<string> {
  const filepath = resolveDocPath(filename);
  try {
    return await fs.readFile(filepath, "utf-8");
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      const content = JSON.stringify(EMPTY_DOCUMENT, null, 2);
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(filepath, content);
      return content;
    }
    throw error;
  }
}

export async function writeDocument(
  filename: string,
  content: unknown,
): Promise<void> {
  const filepath = resolveDocPath(filename);
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(filepath, JSON.stringify(content, null, 2));
}
