export function getDocumentApiUrl(
  filename: string,
  useTempStorage: boolean,
): string {
  const searchParams = new URLSearchParams({ file: filename });

  if (useTempStorage) {
    searchParams.set("tmp", "true");
  }

  return `/api/document?${searchParams.toString()}`;
}

export async function saveDocumentToApi(
  filename: string,
  useTempStorage: boolean,
  content: unknown,
): Promise<void> {
  const response = await fetch(getDocumentApiUrl(filename, useTempStorage), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });

  if (!response.ok) {
    throw new Error(`PUT failed: ${response.status}`);
  }
}
