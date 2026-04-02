"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { TokenUsage } from "@/components/token-usage";
import { FileExplorer } from "@/components/file-explorer";
import { UnsavedChangesDialog } from "@/components/unsaved-changes-dialog";
import { useDocumentSync } from "@/lib/document/use-document-sync";
import { useDirtyTracker } from "@/lib/document/use-dirty-tracker";
import { Assistant } from "./assistant";

const LAST_FILE_KEY = "wale:lastOpenedFile";

declare global {
  interface Window {
    tiptapEditor?: Editor;
  }
}

/**
 * Client-side shell for the writing experience.
 * It owns the TipTap instance, wires document synchronization, and renders the
 * file explorer, editor, and assistant side by side around the same live state.
 */
export function EditorPageClient({
  filename,
  useTempStorage,
}: {
  filename: string;
  useTempStorage: boolean;
}) {
  const router = useRouter();
  const [pendingNavigation, setPendingNavigation] = useState<string | null>(
    null,
  );
  const didPersist = useRef(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: "Start writing...",
      }),
    ],
    autofocus: true,
    immediatelyRender: false,
  });

  useDocumentSync(editor, filename, useTempStorage);
  const { isDirty, markClean } = useDirtyTracker(editor);

  // Remember the last opened file so we can reopen it on next visit.
  useEffect(() => {
    if (!didPersist.current) {
      localStorage.setItem(LAST_FILE_KEY, filename);
      didPersist.current = true;
    }
  }, [filename]);

  useEffect(() => {
    if (editor && process.env.NODE_ENV !== "production") {
      window.tiptapEditor = editor;
    }
    return () => {
      delete window.tiptapEditor;
    };
  }, [editor]);

  const navigateToFile = useCallback(
    (targetFile: string) => {
      if (targetFile === filename) return;

      localStorage.setItem(LAST_FILE_KEY, targetFile);
      const params = new URLSearchParams({ file: targetFile });
      if (useTempStorage) params.set("tmp", "true");
      router.push(`/?${params.toString()}`);
    },
    [filename, useTempStorage, router],
  );

  /** Navigate to the empty state (no file selected). */
  const navigateHome = useCallback(() => {
    localStorage.removeItem(LAST_FILE_KEY);
    router.push(useTempStorage ? "/?tmp=true" : "/");
  }, [useTempStorage, router]);

  const handleSelectFile = useCallback(
    (targetFile: string | null) => {
      if (targetFile === null) {
        navigateHome();
        return;
      }
      if (targetFile === filename) return;

      if (isDirty) {
        setPendingNavigation(targetFile);
      } else {
        navigateToFile(targetFile);
      }
    },
    [filename, isDirty, navigateToFile, navigateHome],
  );

  const handleDiscardAndNavigate = useCallback(() => {
    const target = pendingNavigation;
    setPendingNavigation(null);
    if (target) {
      markClean();
      navigateToFile(target);
    }
  }, [pendingNavigation, navigateToFile, markClean]);

  const handleCancelNavigation = useCallback(() => {
    setPendingNavigation(null);
  }, []);

  return (
    <div className="flex h-screen">
      <div className="w-[200px] border-r border-border">
        <FileExplorer
          activeFile={filename}
          useTempStorage={useTempStorage}
          onSelectFile={handleSelectFile}
        />
      </div>
      <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-12">
        <div className="paper">
          <EditorContent editor={editor} />
        </div>
      </div>
      <TokenUsage filename={filename} useTempStorage={useTempStorage} />
      <div className="w-[400px] border-l border-border">
        <Assistant
          editor={editor}
          filename={filename}
          useTempStorage={useTempStorage}
        />
      </div>
      <UnsavedChangesDialog
        open={pendingNavigation !== null}
        onDiscard={handleDiscardAndNavigate}
        onCancel={handleCancelNavigation}
      />
    </div>
  );
}
