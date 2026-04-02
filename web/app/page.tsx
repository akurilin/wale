import { redirect } from "next/navigation";
import { documentExists, isValidFilename } from "@/lib/document/storage";
import { EditorPageClient } from "./editor-page-client";
import { NoFileSelected } from "./no-file-selected";

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Normalizes App Router query values down to a single string.
 * We accept `string[]` because Next can surface repeated params that way, but
 * this page only supports one active document handle at a time.
 */
function getSingleParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Server entry point for the editor page.
 * When a `?file=` param is present, renders the editor for that document.
 * Otherwise, hands off to NoFileSelected which reopens the last file,
 * falls back to the first available file, or shows an empty state.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: PageSearchParams;
}) {
  const params = await searchParams;
  const file = getSingleParam(params.file);
  const legacyDoc = getSingleParam(params.doc);
  const useTempStorage = getSingleParam(params.tmp) === "true";

  // Redirect legacy ?doc= URLs to the canonical ?file= shape.
  if (!file && legacyDoc) {
    const redirectParams = new URLSearchParams({ file: legacyDoc });
    if (useTempStorage) redirectParams.set("tmp", "true");
    redirect(`/?${redirectParams.toString()}`);
  }

  if (!file) {
    return <NoFileSelected useTempStorage={useTempStorage} />;
  }

  // Reject invalid or nonexistent filenames — show the empty state without
  // trying to auto-resolve to a different file.
  if (
    !isValidFilename(file) ||
    !(await documentExists(file, { temporary: useTempStorage }))
  ) {
    return (
      <NoFileSelected useTempStorage={useTempStorage} autoResolve={false} />
    );
  }

  return (
    <EditorPageClient
      key={file}
      filename={file}
      useTempStorage={useTempStorage}
    />
  );
}
