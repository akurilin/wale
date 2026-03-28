import { redirect } from "next/navigation";
import { EditorPageClient } from "./editor-page-client";

type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

function getSingleParam(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

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

  return <EditorPageClient filename={file} useTempStorage={useTempStorage} />;
}
