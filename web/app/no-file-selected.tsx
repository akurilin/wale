"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileExplorer } from "@/components/file-explorer";

const LAST_FILE_KEY = "wale:lastOpenedFile";

/**
 * Shown when no valid file is active. Two modes:
 * - `autoResolve=true` (default): tries to reopen the last file from
 *   localStorage, falls back to the first file in the list, or shows the
 *   empty state. Used when the user lands on the bare URL with no `?file=`.
 * - `autoResolve=false`: skips resolution and shows the empty state
 *   immediately. Used when the URL contains an invalid or nonexistent file
 *   (i.e. a 404-style scenario).
 */
export function NoFileSelected({
  useTempStorage,
  autoResolve = true,
}: {
  useTempStorage: boolean;
  autoResolve?: boolean;
}) {
  const router = useRouter();
  const [resolved, setResolved] = useState(!autoResolve);

  const navigateToFile = (target: string) => {
    const params = new URLSearchParams({ file: target });
    if (useTempStorage) params.set("tmp", "true");
    router.replace(`/?${params.toString()}`);
  };

  useEffect(() => {
    if (!autoResolve) return;

    let cancelled = false;

    async function resolve() {
      const lastFile = localStorage.getItem(LAST_FILE_KEY);

      const params = new URLSearchParams();
      if (useTempStorage) params.set("tmp", "true");

      try {
        const res = await fetch(`/api/files?${params.toString()}`);
        if (res.ok) {
          const { files } = (await res.json()) as { files: string[] };

          if (cancelled) return;

          if (lastFile && files.includes(lastFile)) {
            navigateToFile(lastFile);
            return;
          }

          if (files.length > 0) {
            navigateToFile(files[0]);
            return;
          }
        }
      } catch {
        // Fall through to empty state
      }

      if (!cancelled) setResolved(true);
    }

    resolve();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useTempStorage, autoResolve]);

  const handleSelectFile = (target: string | null) => {
    if (target) navigateToFile(target);
  };

  if (!resolved) return null;

  return (
    <div className="flex h-screen">
      <div className="w-[200px] border-r border-border">
        <FileExplorer
          activeFile={null}
          useTempStorage={useTempStorage}
          onSelectFile={handleSelectFile}
        />
      </div>
      <div className="flex-1 bg-gray-50" />
      <div className="w-[400px] border-l border-border" />
    </div>
  );
}
