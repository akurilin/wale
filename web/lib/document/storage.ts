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

/**
 * Regex for valid document filenames: one or more alphanumerics, hyphens, or
 * underscores, followed by `.json`. No spaces, path separators, or shell-unsafe
 * characters are allowed.
 */
const VALID_FILENAME_RE = /^[a-zA-Z0-9_-]+\.json$/;

/**
 * Returns true when `name` is a safe, well-formed document filename.
 * Rejects path traversal, empty strings, and names with characters that could
 * cause trouble on the filesystem or in URLs.
 */
export function isValidFilename(name: string): boolean {
  return VALID_FILENAME_RE.test(name);
}

/**
 * Checks whether a document file exists on disk without creating it.
 */
export async function documentExists(
  filename: string,
  options: DocumentStorageOptions = {},
): Promise<boolean> {
  const filepath = resolveDocPath(filename, options);
  try {
    await fs.access(filepath);
    return true;
  } catch {
    return false;
  }
}

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

  // Preserve existing meta and messages if the file already exists
  let meta = emptyMeta();
  let messages: unknown[] = [];
  try {
    const existing = await fs.readFile(filepath, "utf-8");
    const envelope = parseEnvelope(existing);
    meta = envelope.meta;
    messages = envelope.messages;
  } catch {
    // File doesn't exist yet — use empty defaults
  }

  await fs.mkdir(documentDirectory, { recursive: true });
  await fs.writeFile(filepath, serializeEnvelope(meta, content, messages));
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
  const { meta, doc, messages } = parseEnvelope(raw);

  updater(meta);

  await fs.writeFile(filepath, serializeEnvelope(meta, doc, messages));
}

/**
 * Returns all JSON document filenames in the storage directory. Non-JSON files
 * (like .DS_Store) are excluded. Creates the directory if it doesn't exist.
 */
export async function listDocuments(
  options: DocumentStorageOptions = {},
): Promise<string[]> {
  const dir = getDocumentDirectory(options);
  try {
    const entries = await fs.readdir(dir);
    return entries.filter((name) => name.endsWith(".json"));
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      await fs.mkdir(dir, { recursive: true });
      return [];
    }
    throw error;
  }
}

/**
 * Renames a document file on disk. Throws if the target name already exists
 * or the source does not exist. The full envelope (doc, meta, messages) moves
 * intact since it's a filesystem-level rename.
 */
export async function renameDocument(
  oldName: string,
  newName: string,
  options: DocumentStorageOptions = {},
): Promise<void> {
  const oldPath = resolveDocPath(oldName, options);
  const newPath = resolveDocPath(newName, options);

  // Check target doesn't already exist
  try {
    await fs.access(newPath);
    throw new Error(`File "${newName}" already exists.`);
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("already exists")) {
      throw error;
    }
    // ENOENT is expected — target doesn't exist, safe to proceed
  }

  await fs.rename(oldPath, newPath);
}

/**
 * Deletes a document file from disk. Throws if the file does not exist.
 */
export async function deleteDocument(
  filename: string,
  options: DocumentStorageOptions = {},
): Promise<void> {
  const filepath = resolveDocPath(filename, options);
  await fs.unlink(filepath);
}

/**
 * Returns the persisted chat messages from a document's envelope.
 * Creates the file with an empty document if it doesn't exist yet.
 */
export async function readDocumentMessages(
  filename: string,
  options: DocumentStorageOptions = {},
): Promise<unknown[]> {
  const raw = await readRawFile(filename, options);
  return parseEnvelope(raw).messages;
}

/**
 * Persists chat messages into the document envelope without touching the
 * document content or metadata.
 */
export async function writeDocumentMessages(
  filename: string,
  messages: unknown[],
  options: DocumentStorageOptions = {},
): Promise<void> {
  const filepath = resolveDocPath(filename, options);
  const raw = await readRawFile(filename, options);
  const { meta, doc } = parseEnvelope(raw);

  await fs.writeFile(filepath, serializeEnvelope(meta, doc, messages));
}
