import {
  isValidFilename,
  readDocument,
  writeDocument,
} from "@/lib/document/storage";
import { type NextRequest, NextResponse } from "next/server";

const INVALID_FILE = NextResponse.json(
  { error: "Invalid filename." },
  { status: 400 },
);

/**
 * Returns the raw TipTap JSON document for the requested file handle.
 * The editor reads this directly so the response intentionally stays close to
 * the on-disk representation instead of wrapping it in extra API metadata.
 */
export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file");
  const useTempStorage = req.nextUrl.searchParams.get("tmp") === "true";
  if (!file || !isValidFilename(file)) {
    return INVALID_FILE;
  }

  try {
    const raw = await readDocument(file, { temporary: useTempStorage });
    return new NextResponse(raw, {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to read document." },
      { status: 500 },
    );
  }
}

/**
 * Persists a full document snapshot from the client.
 * The write path is intentionally simple today: the caller sends the whole
 * TipTap JSON tree and storage replaces the previous file contents.
 */
export async function PUT(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file");
  const useTempStorage = req.nextUrl.searchParams.get("tmp") === "true";
  if (!file || !isValidFilename(file)) {
    return INVALID_FILE;
  }

  let body: { content?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!body.content) {
    return NextResponse.json(
      { error: "Missing content field." },
      { status: 400 },
    );
  }

  try {
    await writeDocument(file, body.content, { temporary: useTempStorage });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to write document." },
      { status: 500 },
    );
  }
}
