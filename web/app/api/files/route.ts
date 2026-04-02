import {
  deleteDocument,
  isValidFilename,
  listDocuments,
  renameDocument,
  writeDocument,
} from "@/lib/document/storage";
import { NextResponse } from "next/server";

const EMPTY_DOCUMENT = {
  type: "doc" as const,
  content: [{ type: "paragraph" as const }],
};

/** Returns all document filenames in the data directory. */
export async function GET(req: Request) {
  const useTempStorage = new URL(req.url).searchParams.get("tmp") === "true";

  try {
    const files = await listDocuments({ temporary: useTempStorage });
    return NextResponse.json({ files });
  } catch {
    return NextResponse.json(
      { error: "Failed to list files." },
      { status: 500 },
    );
  }
}

/**
 * Creates a new document file. Accepts an optional `name` in the JSON body;
 * without one it auto-generates "untitled-N.json".
 */
export async function POST(req: Request) {
  const useTempStorage = new URL(req.url).searchParams.get("tmp") === "true";

  let body: { name?: string } = {};
  try {
    body = await req.json();
  } catch {
    // empty body is fine — we'll auto-generate a name
  }

  try {
    const existing = await listDocuments({ temporary: useTempStorage });
    let filename = body.name;

    if (filename && !isValidFilename(filename)) {
      return NextResponse.json({ error: "Invalid filename." }, { status: 400 });
    }

    if (!filename) {
      let n = 1;
      while (existing.includes(`untitled-${n}.json`)) {
        n++;
      }
      filename = `untitled-${n}.json`;
    } else if (existing.includes(filename)) {
      return NextResponse.json(
        { error: "File already exists." },
        { status: 409 },
      );
    }

    await writeDocument(filename, EMPTY_DOCUMENT, {
      temporary: useTempStorage,
    });
    return NextResponse.json({ file: filename }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create file." },
      { status: 500 },
    );
  }
}

/** Renames a document file. Expects `{ oldName, newName }` in the JSON body. */
export async function PATCH(req: Request) {
  const useTempStorage = new URL(req.url).searchParams.get("tmp") === "true";

  let body: { oldName?: string; newName?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.oldName || !body.newName) {
    return NextResponse.json(
      { error: "Both oldName and newName are required." },
      { status: 400 },
    );
  }

  if (!isValidFilename(body.oldName) || !isValidFilename(body.newName)) {
    return NextResponse.json({ error: "Invalid filename." }, { status: 400 });
  }

  try {
    await renameDocument(body.oldName, body.newName, {
      temporary: useTempStorage,
    });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes("already exists")) {
      return NextResponse.json(
        { error: "File already exists." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Failed to rename file." },
      { status: 500 },
    );
  }
}

/** Deletes a document file by name. */
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get("file");
  const useTempStorage = searchParams.get("tmp") === "true";

  if (!file || !isValidFilename(file)) {
    return NextResponse.json({ error: "Invalid filename." }, { status: 400 });
  }

  try {
    await deleteDocument(file, { temporary: useTempStorage });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Failed to delete file." },
      { status: 500 },
    );
  }
}
