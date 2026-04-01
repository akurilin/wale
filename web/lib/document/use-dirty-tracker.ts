"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";

/**
 * Tracks whether the editor has unsaved changes relative to the last
 * Cmd+S save or initial load.
 *
 * Relies on the parent component remounting when the filename changes
 * (via React key), so all state starts fresh per file.
 */
export function useDirtyTracker(editor: Editor | null): {
  isDirty: boolean;
  markClean: () => void;
} {
  const [isDirty, setIsDirty] = useState(false);
  const savedContentRef = useRef<string | null>(null);

  // Capture the initial content once the editor loads it.
  // The timeout lets useDocumentSync load the content first.
  useEffect(() => {
    if (!editor) return;

    const timeout = setTimeout(() => {
      if (savedContentRef.current === null) {
        savedContentRef.current = JSON.stringify(editor.getJSON());
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [editor]);

  // Listen for edits via the TipTap update event
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      if (savedContentRef.current === null) return;
      const current = JSON.stringify(editor.getJSON());
      setIsDirty(current !== savedContentRef.current);
    };

    editor.on("update", handleUpdate);
    return () => {
      editor.off("update", handleUpdate);
    };
  }, [editor]);

  // Listen for saves (Cmd+S) to reset dirty state via keydown event
  useEffect(() => {
    if (!editor) return;

    const handleSave = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        savedContentRef.current = JSON.stringify(editor.getJSON());
        setIsDirty(false);
      }
    };

    document.addEventListener("keydown", handleSave);
    return () => document.removeEventListener("keydown", handleSave);
  }, [editor]);

  const markClean = useCallback(() => {
    if (editor) {
      savedContentRef.current = JSON.stringify(editor.getJSON());
    }
    setIsDirty(false);
  }, [editor]);

  return { isDirty, markClean };
}
