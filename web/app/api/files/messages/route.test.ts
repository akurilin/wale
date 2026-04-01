import { beforeEach, describe, expect, it, vi } from "vitest";

const { readDocumentMessagesMock, writeDocumentMessagesMock } = vi.hoisted(
  () => ({
    readDocumentMessagesMock: vi.fn(),
    writeDocumentMessagesMock: vi.fn(),
  }),
);

vi.mock("@/lib/document/storage", () => ({
  readDocumentMessages: readDocumentMessagesMock,
  writeDocumentMessages: writeDocumentMessagesMock,
}));

const { GET, PUT } = await import("./route");

describe("GET /api/files/messages", () => {
  beforeEach(() => {
    readDocumentMessagesMock.mockReset();
  });

  it("returns messages for the given file", async () => {
    const messages = [{ id: "1", role: "user", content: "Hi" }];
    readDocumentMessagesMock.mockResolvedValue(messages);

    const res = await GET(
      new Request("http://localhost/api/files/messages?file=doc.json"),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ messages });
    expect(readDocumentMessagesMock).toHaveBeenCalledWith("doc.json", {
      temporary: false,
    });
  });

  it("returns 400 when file param is missing", async () => {
    const res = await GET(new Request("http://localhost/api/files/messages"));

    expect(res.status).toBe(400);
    expect(readDocumentMessagesMock).not.toHaveBeenCalled();
  });

  it("passes tmp flag through", async () => {
    readDocumentMessagesMock.mockResolvedValue([]);

    await GET(
      new Request("http://localhost/api/files/messages?file=doc.json&tmp=true"),
    );

    expect(readDocumentMessagesMock).toHaveBeenCalledWith("doc.json", {
      temporary: true,
    });
  });
});

describe("PUT /api/files/messages", () => {
  beforeEach(() => {
    writeDocumentMessagesMock.mockReset();
    writeDocumentMessagesMock.mockResolvedValue(undefined);
  });

  it("persists messages for the given file", async () => {
    const messages = [
      { id: "1", role: "user", content: "Hello" },
      { id: "2", role: "assistant", content: "Hi!" },
    ];

    const res = await PUT(
      new Request("http://localhost/api/files/messages?file=doc.json", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages }),
      }),
    );

    expect(res.status).toBe(200);
    expect(writeDocumentMessagesMock).toHaveBeenCalledWith(
      "doc.json",
      messages,
      { temporary: false },
    );
  });

  it("returns 400 when file param is missing", async () => {
    const res = await PUT(
      new Request("http://localhost/api/files/messages", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: [] }),
      }),
    );

    expect(res.status).toBe(400);
    expect(writeDocumentMessagesMock).not.toHaveBeenCalled();
  });

  it("returns 400 when messages is not an array", async () => {
    const res = await PUT(
      new Request("http://localhost/api/files/messages?file=doc.json", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: "not-array" }),
      }),
    );

    expect(res.status).toBe(400);
    expect(writeDocumentMessagesMock).not.toHaveBeenCalled();
  });
});
