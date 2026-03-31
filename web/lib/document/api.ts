/**
 * Builds the canonical document API URL used by the editor and assistant.
 * The `tmp` flag is only present for temporary storage so the stable URL shape
 * stays short for the normal path.
 */
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

/**
 * Persists the current editor document through the API route instead of writing
 * to storage directly from the client. The wrapper keeps the fetch details in
 * one place so the rest of the editor only deals with document handles.
 */
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
