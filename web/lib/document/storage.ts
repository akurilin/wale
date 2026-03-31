import fs from "fs/promises";
import path from "path";
import {
  type DocumentMeta,
  emptyMeta,
  parseEnvelope,
  serializeEnvelope,
} from "./envelope";

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
 * Reads the raw file content and returns it as a string. If the file does not
 * exist, creates an empty envelope and persists it so the rest of the app
 * doesn't need a separate bootstrap path.
 */
async function readRawFile(
  filename: string,
  options: DocumentStorageOptions = {},
): Promise<string> {
  const filepath = resolveDocPath(filename, options);
  const documentDirectory = getDocumentDirectory(options);

  try {
    return await fs.readFile(filepath, "utf-8");
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      const content = serializeEnvelope(emptyMeta(), EMPTY_DOCUMENT);
      await fs.mkdir(documentDirectory, { recursive: true });
      await fs.writeFile(filepath, content);
      return content;
    }
    throw error;
  }
}

/**
 * Reads a document from storage and returns only the TipTap doc portion.
 * Callers (the editor, the API) never see the envelope metadata — they get the
 * same JSON shape they've always expected.
 */
export async function readDocument(
  filename: string,
  options: DocumentStorageOptions = {},
): Promise<string> {
  const raw = await readRawFile(filename, options);
  const { doc } = parseEnvelope(raw);
  return JSON.stringify(doc, null, 2);
}

/**
 * Returns the metadata portion of a document's envelope. Creates the file with
 * empty meta if it does not exist yet.
 */
export async function readDocumentMeta(
  filename: string,
  options: DocumentStorageOptions = {},
): Promise<DocumentMeta> {
  const raw = await readRawFile(filename, options);
  return parseEnvelope(raw).meta;
}

/**
 * Persists a TipTap JSON document to disk inside an envelope. If the file
 * already contains an envelope with metadata, the metadata is preserved.
 */
export async function writeDocument(
  filename: string,
  content: unknown,
  options: DocumentStorageOptions = {},
): Promise<void> {
  const filepath = resolveDocPath(filename, options);
  const documentDirectory = getDocumentDirectory(options);

  // Preserve existing meta if the file already exists
  let meta = emptyMeta();
  try {
    const existing = await fs.readFile(filepath, "utf-8");
    meta = parseEnvelope(existing).meta;
  } catch {
    // File doesn't exist yet — use empty meta
  }

  await fs.mkdir(documentDirectory, { recursive: true });
  await fs.writeFile(filepath, serializeEnvelope(meta, content));
}

/**
 * Atomically reads the document envelope, applies a mutating callback to its
 * metadata, and writes it back. The document content is left untouched.
 */
export async function updateDocumentMeta(
  filename: string,
  options: DocumentStorageOptions = {},
  updater: (meta: DocumentMeta) => void,
): Promise<void> {
  const filepath = resolveDocPath(filename, options);
  const raw = await readRawFile(filename, options);
  const { meta, doc } = parseEnvelope(raw);

  updater(meta);

  await fs.writeFile(filepath, serializeEnvelope(meta, doc));
}
