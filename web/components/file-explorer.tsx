"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

/**
 * Left-side file explorer pane. Lists all document files in the data directory,
 * highlights the active file, and provides create/delete/rename actions.
 *
 * Rename is triggered by double-clicking a file name, which switches it to an
 * inline text input (Finder-style). Enter or blur confirms; Escape cancels.
 * All rename state is self-contained here.
 */
export function FileExplorer({
  activeFile,
  useTempStorage,
  onSelectFile,
}: {
  activeFile: string | null;
  useTempStorage: boolean;
  onSelectFile: (filename: string | null) => void;
}) {
  const [files, setFiles] = useState<string[]>([]);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const fetchFiles = useCallback(async () => {
    const params = new URLSearchParams();
    if (useTempStorage) params.set("tmp", "true");
    try {
      const res = await fetch(`/api/files?${params.toString()}`);
      if (res.ok) {
        const body = await res.json();
        setFiles(body.files);
      }
    } catch {
      // Silently skip failed fetches
    }
  }, [useTempStorage]);

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (useTempStorage) params.set("tmp", "true");
    fetch(`/api/files?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        if (!cancelled && body?.files) setFiles(body.files);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [useTempStorage]);

  // Focus and select the input text when entering rename mode
  useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renaming]);

  const handleCreate = async () => {
    const params = new URLSearchParams();
    if (useTempStorage) params.set("tmp", "true");
    try {
      const res = await fetch(`/api/files?${params.toString()}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const body = await res.json();
        await fetchFiles();
        onSelectFile(body.file);
      }
    } catch {
      // Silently skip failed creates
    }
  };

  const handleDelete = async (filename: string) => {
    const displayName = filename.replace(/\.json$/, "");
    if (!window.confirm(`Delete "${displayName}"?`)) return;

    const params = new URLSearchParams({ file: filename });
    if (useTempStorage) params.set("tmp", "true");
    try {
      const res = await fetch(`/api/files?${params.toString()}`, {
        method: "DELETE",
      });
      if (res.ok) {
        await fetchFiles();
        if (filename === activeFile) {
          const remaining = files.filter((f) => f !== filename);
          onSelectFile(remaining.length > 0 ? remaining[0] : null);
        }
      }
    } catch {
      // Silently skip failed deletes
    }
  };

  const startRename = (filename: string) => {
    setRenaming(filename);
    setRenameValue(filename.replace(/\.json$/, ""));
    setRenameError(null);
  };

  const cancelRename = () => {
    setRenaming(null);
    setRenameValue("");
    setRenameError(null);
  };

  const commitRename = async () => {
    if (!renaming) return;

    const trimmed = renameValue.trim();
    if (!trimmed) {
      cancelRename();
      return;
    }

    const newName = trimmed.endsWith(".json") ? trimmed : `${trimmed}.json`;

    // No change — just exit rename mode
    if (newName === renaming) {
      cancelRename();
      return;
    }

    // Client-side duplicate check for immediate feedback
    if (files.includes(newName)) {
      setRenameError("Name already taken");
      return;
    }

    const params = new URLSearchParams();
    if (useTempStorage) params.set("tmp", "true");

    try {
      const res = await fetch(`/api/files?${params.toString()}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ oldName: renaming, newName }),
      });

      if (res.status === 409) {
        setRenameError("Name already taken");
        return;
      }

      if (res.ok) {
        await fetchFiles();
        // If we renamed the active file, navigate to the new name
        if (renaming === activeFile) {
          onSelectFile(newName);
        }
        cancelRename();
      }
    } catch {
      setRenameError("Rename failed");
    }
  };

  const handleRenameKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      cancelRename();
    } else if (e.key === "Enter") {
      commitRename();
    }
  };

  return (
    <div className="flex h-full flex-col" data-testid="file-explorer">
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-sm font-medium text-foreground">Files</span>
        <button
          onClick={handleCreate}
          className="rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          title="New file"
        >
          + New
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {files.map((filename) => (
          <div
            key={filename}
            data-active={filename === activeFile}
            className={`group flex items-center justify-between px-3 py-1.5 text-sm ${
              filename === activeFile
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50"
            }`}
          >
            {renaming === filename ? (
              <div className="min-w-0 flex-1">
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameValue}
                  onChange={(e) => {
                    setRenameValue(e.target.value);
                    setRenameError(null);
                  }}
                  onBlur={commitRename}
                  onKeyDown={handleRenameKeyDown}
                  className={`w-full rounded border bg-background px-1 py-0.5 text-sm outline-none ${
                    renameError
                      ? "border-destructive"
                      : "border-ring/50 focus:border-ring"
                  }`}
                  aria-label="Rename file"
                />
                {renameError && (
                  <div className="mt-0.5 text-xs text-destructive">
                    {renameError}
                  </div>
                )}
              </div>
            ) : (
              <button
                className="min-w-0 flex-1 cursor-pointer truncate text-left"
                onClick={() => onSelectFile(filename)}
                onDoubleClick={(e) => {
                  e.preventDefault();
                  startRename(filename);
                }}
                title={filename}
              >
                {filename.replace(/\.json$/, "")}
              </button>
            )}
            {renaming !== filename && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(filename);
                }}
                className="ml-1 hidden cursor-pointer rounded px-1 py-0.5 text-xs text-muted-foreground hover:text-destructive group-hover:block"
                title={`Delete ${filename}`}
              >
                🗑
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
