import { redirect } from "next/navigation";
import { EditorPageClient } from "./editor-page-client";

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
 * It redirects legacy or incomplete URLs into the canonical `?file=` shape so
 * the client editor can assume it always receives an explicit document target.
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

  if (!file) {
    const redirectParams = new URLSearchParams();
    redirectParams.set("file", legacyDoc || "default.json");

    if (useTempStorage) {
      redirectParams.set("tmp", "true");
    }

    redirect(`/?${redirectParams.toString()}`);
  }

  return (
    <EditorPageClient
      key={file}
      filename={file}
      useTempStorage={useTempStorage}
    />
  );
}
