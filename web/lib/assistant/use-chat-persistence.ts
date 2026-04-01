"use client";

import { useEffect, useRef } from "react";
import type { AssistantRuntime } from "@assistant-ui/react";

/**
 * Persists chat messages per-file by loading from and saving to the document
 * envelope via the /api/files/messages endpoint.
 *
 * On mount: fetches saved messages and hydrates the runtime thread via
 * importExternalState (the AI SDK round-trip format).
 * On runEnd: exports current state and saves to storage.
 */
export function useChatPersistence(
  runtime: AssistantRuntime,
  filename: string,
  useTempStorage: boolean,
): void {
  const loadedFileRef = useRef<string | null>(null);

  // Load persisted messages on mount or file change
  useEffect(() => {
    // Avoid re-loading if we already loaded for this file
    if (loadedFileRef.current === filename) return;

    let cancelled = false;

    const params = new URLSearchParams({ file: filename });
    if (useTempStorage) params.set("tmp", "true");

    fetch(`/api/files/messages?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { messages: unknown[] } | null) => {
        if (cancelled || !body?.messages?.length) return;
        loadedFileRef.current = filename;
        try {
          runtime.thread.importExternalState(body.messages);
        } catch {
          // If import fails (format mismatch), silently start fresh
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [runtime, filename, useTempStorage]);

  // Save messages after each completed assistant turn
  useEffect(() => {
    const saveMessages = () => {
      let externalState: unknown;
      try {
        externalState = runtime.thread.exportExternalState();
      } catch {
        return;
      }

      if (
        !externalState ||
        (Array.isArray(externalState) && externalState.length === 0)
      ) {
        return;
      }

      const params = new URLSearchParams({ file: filename });
      if (useTempStorage) params.set("tmp", "true");

      fetch(`/api/files/messages?${params.toString()}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: externalState }),
      }).catch(() => {});
    };

    const unsubscribe = runtime.thread.unstable_on("runEnd", saveMessages);
    return unsubscribe;
  }, [runtime, filename, useTempStorage]);
}
