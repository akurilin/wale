"use client";

import type { Editor } from "@tiptap/react";
import { useEffect, useRef } from "react";
import { getDocumentApiUrl, saveDocumentToApi } from "./api";

const POLL_INTERVAL_MS = 1000;

export function useDocumentSync(
  editor: Editor | null,
  filename: string,
  useTempStorage: boolean,
): void {
  const lastFileContentRef = useRef<string | null>(null);

  // Initial load
  useEffect(() => {
    if (!editor) return;

    let cancelled = false;
    lastFileContentRef.current = null;
    fetch(getDocumentApiUrl(filename, useTempStorage))
      .then((res) => {
        if (!res.ok) throw new Error(`GET failed: ${res.status}`);
        return res.text();
      })
      .then((raw) => {
        if (cancelled) return;
        if (lastFileContentRef.current !== null) return;
        lastFileContentRef.current = raw;
        editor.commands.setContent(JSON.parse(raw));
      })
      .catch((err) => console.error("Document load failed:", err));

    return () => {
      cancelled = true;
    };
  }, [editor, filename, useTempStorage]);

  // Cmd+S / Ctrl+S save
  useEffect(() => {
    if (!editor) return;

    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        const content = editor.getJSON();
        const raw = JSON.stringify(content, null, 2);
        lastFileContentRef.current = raw;
        saveDocumentToApi(filename, useTempStorage, content).catch((err) =>
          console.error("Document save failed:", err),
        );
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [editor, filename, useTempStorage]);

  // Poll for external changes
  useEffect(() => {
    if (!editor) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(getDocumentApiUrl(filename, useTempStorage));
        if (!res.ok) return;
        const raw = await res.text();
        if (raw !== lastFileContentRef.current) {
          lastFileContentRef.current = raw;
          editor.commands.setContent(JSON.parse(raw));
        }
      } catch {
        // Silently skip failed polls
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [editor, filename, useTempStorage]);
}
