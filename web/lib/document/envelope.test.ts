import { describe, expect, it } from "vitest";
import {
  type DocumentMeta,
  emptyMeta,
  parseEnvelope,
  serializeEnvelope,
} from "./envelope";

const bareTipTapDoc = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }],
};

const metaWithUsage: DocumentMeta = {
  usage: {
    "claude-haiku-4-5": { inputTokens: 500, outputTokens: 100 },
  },
};

describe("parseEnvelope", () => {
  it("wraps bare TipTap JSON with empty meta", () => {
    const raw = JSON.stringify(bareTipTapDoc);
    const result = parseEnvelope(raw);

    expect(result.doc).toEqual(bareTipTapDoc);
    expect(result.meta).toEqual(emptyMeta());
  });

  it("parses a full envelope correctly", () => {
    const envelope = { meta: metaWithUsage, doc: bareTipTapDoc };
    const raw = JSON.stringify(envelope);
    const result = parseEnvelope(raw);

    expect(result.doc).toEqual(bareTipTapDoc);
    expect(result.meta).toEqual(metaWithUsage);
  });

  it("handles envelope with empty usage", () => {
    const envelope = { meta: { usage: {} }, doc: bareTipTapDoc };
    const raw = JSON.stringify(envelope);
    const result = parseEnvelope(raw);

    expect(result.meta).toEqual({ usage: {} });
    expect(result.doc).toEqual(bareTipTapDoc);
  });

  it("handles envelope with multiple models in usage", () => {
    const meta: DocumentMeta = {
      usage: {
        "claude-haiku-4-5": { inputTokens: 500, outputTokens: 100 },
        "claude-sonnet-4-5": { inputTokens: 2000, outputTokens: 800 },
      },
    };
    const envelope = { meta, doc: bareTipTapDoc };
    const raw = JSON.stringify(envelope);
    const result = parseEnvelope(raw);

    expect(result.meta).toEqual(meta);
  });
});

describe("serializeEnvelope", () => {
  it("produces valid JSON that round-trips through parseEnvelope", () => {
    const serialized = serializeEnvelope(metaWithUsage, bareTipTapDoc);
    const parsed = parseEnvelope(serialized);

    expect(parsed.meta).toEqual(metaWithUsage);
    expect(parsed.doc).toEqual(bareTipTapDoc);
  });

  it("pretty-prints with 2-space indentation", () => {
    const serialized = serializeEnvelope(emptyMeta(), bareTipTapDoc);
    const expected = JSON.stringify(
      { meta: emptyMeta(), doc: bareTipTapDoc },
      null,
      2,
    );

    expect(serialized).toBe(expected);
  });
});

describe("emptyMeta", () => {
  it("returns a fresh object each time", () => {
    const a = emptyMeta();
    const b = emptyMeta();

    expect(a).toEqual(b);
    expect(a).not.toBe(b);
  });
});
