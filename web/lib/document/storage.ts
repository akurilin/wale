import fs from "fs/promises";
import path from "path";

export const DATA_DIR = path.resolve(process.cwd(), "..", "data");
export const TEMP_DATA_DIR = path.resolve("/tmp", "wale");

const EMPTY_DOCUMENT = {
  type: "doc" as const,
  content: [{ type: "paragraph" as const }],
};

export type DocumentStorageOptions = {
  temporary?: boolean;
};

function getDocumentDirectory({
  temporary = false,
}: DocumentStorageOptions): string {
  return temporary ? TEMP_DATA_DIR : DATA_DIR;
}

function resolveDocPath(
  filename: string,
  options: DocumentStorageOptions = {},
): string {
  const safe = path.basename(filename);
  if (!safe) throw new Error("Invalid filename.");
  return path.join(getDocumentDirectory(options), safe);
}

export async function readDocument(
  filename: string,
  options: DocumentStorageOptions = {},
): Promise<string> {
  const filepath = resolveDocPath(filename, options);
  const documentDirectory = getDocumentDirectory(options);

  try {
    return await fs.readFile(filepath, "utf-8");
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      const content = JSON.stringify(EMPTY_DOCUMENT, null, 2);
      await fs.mkdir(documentDirectory, { recursive: true });
      await fs.writeFile(filepath, content);
      return content;
    }
    throw error;
  }
}

export async function writeDocument(
  filename: string,
  content: unknown,
  options: DocumentStorageOptions = {},
): Promise<void> {
  const filepath = resolveDocPath(filename, options);
  const documentDirectory = getDocumentDirectory(options);

  await fs.mkdir(documentDirectory, { recursive: true });
  await fs.writeFile(filepath, JSON.stringify(content, null, 2));
}
