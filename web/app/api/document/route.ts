import { readDocument, writeDocument } from "@/lib/document/storage";
import { type NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file");
  if (!file) {
    return NextResponse.json({ error: "Missing file param." }, { status: 400 });
  }

  try {
    const raw = await readDocument(file);
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

export async function PUT(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file");
  if (!file) {
    return NextResponse.json({ error: "Missing file param." }, { status: 400 });
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
    await writeDocument(file, body.content);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to write document." },
      { status: 500 },
    );
  }
}
