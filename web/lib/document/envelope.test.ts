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

describe("parseEnvelope (messages)", () => {
  it("extracts messages array when present in envelope", () => {
    const messages = [
      { id: "1", role: "user", content: "Hello" },
      { id: "2", role: "assistant", content: "Hi there!" },
    ];
    const envelope = { meta: metaWithUsage, doc: bareTipTapDoc, messages };
    const result = parseEnvelope(JSON.stringify(envelope));

    expect(result.messages).toEqual(messages);
  });

  it("returns empty array when messages field is missing", () => {
    const envelope = { meta: metaWithUsage, doc: bareTipTapDoc };
    const result = parseEnvelope(JSON.stringify(envelope));

    expect(result.messages).toEqual([]);
  });

  it("returns empty array for bare TipTap documents", () => {
    const result = parseEnvelope(JSON.stringify(bareTipTapDoc));

    expect(result.messages).toEqual([]);
  });
});

describe("serializeEnvelope (messages)", () => {
  it("includes messages in output when provided", () => {
    const messages = [{ id: "1", role: "user", content: "Hello" }];
    const serialized = serializeEnvelope(
      metaWithUsage,
      bareTipTapDoc,
      messages,
    );
    const parsed = JSON.parse(serialized);

    expect(parsed.messages).toEqual(messages);
  });

  it("omits messages key when array is empty", () => {
    const serialized = serializeEnvelope(metaWithUsage, bareTipTapDoc, []);
    const parsed = JSON.parse(serialized);

    expect(parsed).not.toHaveProperty("messages");
  });

  it("omits messages key when not provided", () => {
    const serialized = serializeEnvelope(metaWithUsage, bareTipTapDoc);
    const parsed = JSON.parse(serialized);

    expect(parsed).not.toHaveProperty("messages");
  });

  it("round-trips messages through serialize → parse", () => {
    const messages = [
      { id: "1", role: "user", content: "Hello" },
      { id: "2", role: "assistant", content: "Hi!" },
    ];
    const serialized = serializeEnvelope(
      metaWithUsage,
      bareTipTapDoc,
      messages,
    );
    const result = parseEnvelope(serialized);

    expect(result.messages).toEqual(messages);
    expect(result.meta).toEqual(metaWithUsage);
    expect(result.doc).toEqual(bareTipTapDoc);
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
