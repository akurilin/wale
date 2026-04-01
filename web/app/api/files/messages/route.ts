import {
  readDocumentMessages,
  writeDocumentMessages,
} from "@/lib/document/storage";
import { NextResponse } from "next/server";

/** Returns persisted chat messages for a document. */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get("file");
  const useTempStorage = searchParams.get("tmp") === "true";

  if (!file) {
    return NextResponse.json({ error: "Missing file param." }, { status: 400 });
  }

  try {
    const messages = await readDocumentMessages(file, {
      temporary: useTempStorage,
    });
    return NextResponse.json({ messages });
  } catch {
    return NextResponse.json(
      { error: "Failed to read messages." },
      { status: 500 },
    );
  }
}

/** Persists chat messages for a document. */
export async function PUT(req: Request) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get("file");
  const useTempStorage = searchParams.get("tmp") === "true";

  if (!file) {
    return NextResponse.json({ error: "Missing file param." }, { status: 400 });
  }

  let body: { messages?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!Array.isArray(body.messages)) {
    return NextResponse.json(
      { error: "messages must be an array." },
      { status: 400 },
    );
  }

  try {
    await writeDocumentMessages(file, body.messages, {
      temporary: useTempStorage,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to write messages." },
      { status: 500 },
    );
  }
}
