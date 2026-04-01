/** Per-model token accumulator stored in the document envelope. */
export type ModelUsage = {
  inputTokens: number;
  outputTokens: number;
};

/** Metadata that lives alongside the TipTap document on disk. */
export type DocumentMeta = {
  usage: Record<string, ModelUsage>;
  selectedModel?: string;
};

/** The on-disk shape: metadata envelope wrapping a TipTap document. */
export type DocumentEnvelope = {
  meta: DocumentMeta;
  doc: unknown;
  messages: unknown[];
};

/** Returns a fresh empty meta object. */
export function emptyMeta(): DocumentMeta {
  return { usage: {} };
}

/**
 * Detects whether parsed JSON is an envelope (has a `doc` key) or a bare
 * TipTap document, and normalizes to the envelope shape. Bare documents get
 * wrapped with empty meta so the rest of the stack can always assume envelopes.
 */
export function parseEnvelope(raw: string): DocumentEnvelope {
  const parsed = JSON.parse(raw);

  if (parsed && typeof parsed === "object" && "doc" in parsed) {
    return {
      meta: parsed.meta ?? emptyMeta(),
      doc: parsed.doc,
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
    };
  }

  return { meta: emptyMeta(), doc: parsed, messages: [] };
}

/** Serializes an envelope to pretty-printed JSON for on-disk storage. */
export function serializeEnvelope(
  meta: DocumentMeta,
  doc: unknown,
  messages?: unknown[],
): string {
  const envelope: Record<string, unknown> = { meta, doc };
  if (messages && messages.length > 0) {
    envelope.messages = messages;
  }
  return JSON.stringify(envelope, null, 2);
}
