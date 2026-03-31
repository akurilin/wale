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

/**
 * Chooses between the checked-in data directory and the temporary scratch
 * directory used during local development and tests.
 */
function getDocumentDirectory({
  temporary = false,
}: DocumentStorageOptions): string {
  return temporary ? TEMP_DATA_DIR : DATA_DIR;
}

/**
 * Resolves a user-supplied filename to a safe on-disk path.
 * We intentionally strip directory segments with `basename` because document
 * handles come from URLs and should never escape the storage root.
 */
function resolveDocPath(
  filename: string,
  options: DocumentStorageOptions = {},
): string {
  const safe = path.basename(filename);
  if (!safe) throw new Error("Invalid filename.");
  return path.join(getDocumentDirectory(options), safe);
}

/**
 * Reads a document from storage and lazily creates an empty TipTap document
 * when the file does not exist yet. This keeps the rest of the app free from a
 * separate "create document first" bootstrap path.
 */
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

/**
 * Serializes a TipTap JSON document to disk using the same pretty-printed shape
 * that the read path and revision hashing logic expect.
 */
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
