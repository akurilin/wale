import { readDocumentMeta, updateDocumentMeta } from "@/lib/document/storage";
import { type NextRequest, NextResponse } from "next/server";

/** Returns the metadata envelope for a document, primarily token usage. */
export async function GET(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file");
  const useTempStorage = req.nextUrl.searchParams.get("tmp") === "true";
  if (!file) {
    return NextResponse.json({ error: "Missing file param." }, { status: 400 });
  }

  try {
    const meta = await readDocumentMeta(file, { temporary: useTempStorage });
    return NextResponse.json(meta);
  } catch {
    return NextResponse.json(
      { error: "Failed to read document metadata." },
      { status: 500 },
    );
  }
}

/** Updates metadata fields on a document envelope. */
export async function PUT(req: NextRequest) {
  const file = req.nextUrl.searchParams.get("file");
  const useTempStorage = req.nextUrl.searchParams.get("tmp") === "true";
  if (!file) {
    return NextResponse.json({ error: "Missing file param." }, { status: 400 });
  }

  let body: { selectedModel?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    await updateDocumentMeta(file, { temporary: useTempStorage }, (meta) => {
      if (body.selectedModel !== undefined) {
        meta.selectedModel = body.selectedModel || undefined;
      }
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to update document metadata." },
      { status: 500 },
    );
  }
}
