import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  listDocumentsMock,
  writeDocumentMock,
  deleteDocumentMock,
  renameDocumentMock,
  listReturn,
} = vi.hoisted(() => ({
  listDocumentsMock: vi.fn(),
  writeDocumentMock: vi.fn(),
  deleteDocumentMock: vi.fn(),
  renameDocumentMock: vi.fn(),
  listReturn: [] as string[],
}));

vi.mock("@/lib/document/storage", () => ({
  listDocuments: listDocumentsMock,
  writeDocument: writeDocumentMock,
  deleteDocument: deleteDocumentMock,
  renameDocument: renameDocumentMock,
}));

const { GET, POST, DELETE, PATCH } = await import("./route");

describe("GET /api/files", () => {
  beforeEach(() => {
    listDocumentsMock.mockReset();
  });

  it("returns a JSON array of filenames", async () => {
    listDocumentsMock.mockResolvedValue(["doc-a.json", "doc-b.json"]);

    const res = await GET(
      new Request("http://localhost/api/files", { method: "GET" }),
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ files: ["doc-a.json", "doc-b.json"] });
  });

  it("passes tmp flag through to storage", async () => {
    listDocumentsMock.mockResolvedValue([]);

    await GET(
      new Request("http://localhost/api/files?tmp=true", { method: "GET" }),
    );

    expect(listDocumentsMock).toHaveBeenCalledWith({ temporary: true });
  });
});

describe("POST /api/files", () => {
  beforeEach(() => {
    listDocumentsMock.mockReset();
    writeDocumentMock.mockReset();
    listDocumentsMock.mockResolvedValue(listReturn);
    writeDocumentMock.mockResolvedValue(undefined);
  });

  it("creates a file with the given name", async () => {
    const res = await POST(
      new Request("http://localhost/api/files", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "my-doc.json" }),
      }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ file: "my-doc.json" });
    expect(writeDocumentMock).toHaveBeenCalledWith(
      "my-doc.json",
      expect.objectContaining({ type: "doc" }),
      { temporary: false },
    );
  });

  it("auto-generates untitled-1.json when no name given", async () => {
    listDocumentsMock.mockResolvedValue([]);

    const res = await POST(
      new Request("http://localhost/api/files", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ file: "untitled-1.json" });
  });

  it("increments to untitled-2.json if untitled-1 already exists", async () => {
    listDocumentsMock.mockResolvedValue(["untitled-1.json"]);

    const res = await POST(
      new Request("http://localhost/api/files", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      }),
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({ file: "untitled-2.json" });
  });

  it("returns 409 if file already exists", async () => {
    listDocumentsMock.mockResolvedValue(["existing.json"]);

    const res = await POST(
      new Request("http://localhost/api/files", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "existing.json" }),
      }),
    );

    expect(res.status).toBe(409);
    expect(writeDocumentMock).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/files", () => {
  beforeEach(() => {
    deleteDocumentMock.mockReset();
  });

  it("deletes the specified file", async () => {
    deleteDocumentMock.mockResolvedValue(undefined);

    const res = await DELETE(
      new Request("http://localhost/api/files?file=old.json", {
        method: "DELETE",
      }),
    );

    expect(res.status).toBe(200);
    expect(deleteDocumentMock).toHaveBeenCalledWith("old.json", {
      temporary: false,
    });
  });

  it("returns 400 when file param is missing", async () => {
    const res = await DELETE(
      new Request("http://localhost/api/files", { method: "DELETE" }),
    );

    expect(res.status).toBe(400);
    expect(deleteDocumentMock).not.toHaveBeenCalled();
  });

  it("returns 404 when file does not exist", async () => {
    deleteDocumentMock.mockRejectedValue(
      Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
    );

    const res = await DELETE(
      new Request("http://localhost/api/files?file=ghost.json", {
        method: "DELETE",
      }),
    );

    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/files", () => {
  beforeEach(() => {
    renameDocumentMock.mockReset();
    renameDocumentMock.mockResolvedValue(undefined);
  });

  it("renames a file", async () => {
    const res = await PATCH(
      new Request("http://localhost/api/files", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ oldName: "draft.json", newName: "final.json" }),
      }),
    );

    expect(res.status).toBe(200);
    expect(renameDocumentMock).toHaveBeenCalledWith(
      "draft.json",
      "final.json",
      {
        temporary: false,
      },
    );
  });

  it("returns 400 when oldName is missing", async () => {
    const res = await PATCH(
      new Request("http://localhost/api/files", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ newName: "final.json" }),
      }),
    );

    expect(res.status).toBe(400);
    expect(renameDocumentMock).not.toHaveBeenCalled();
  });

  it("returns 400 when newName is missing", async () => {
    const res = await PATCH(
      new Request("http://localhost/api/files", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ oldName: "draft.json" }),
      }),
    );

    expect(res.status).toBe(400);
    expect(renameDocumentMock).not.toHaveBeenCalled();
  });

  it("returns 409 when target already exists", async () => {
    renameDocumentMock.mockRejectedValue(new Error("already exists"));

    const res = await PATCH(
      new Request("http://localhost/api/files", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ oldName: "a.json", newName: "b.json" }),
      }),
    );

    expect(res.status).toBe(409);
  });

  it("passes tmp flag through", async () => {
    const res = await PATCH(
      new Request("http://localhost/api/files?tmp=true", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ oldName: "a.json", newName: "b.json" }),
      }),
    );

    expect(res.status).toBe(200);
    expect(renameDocumentMock).toHaveBeenCalledWith("a.json", "b.json", {
      temporary: true,
    });
  });
});
