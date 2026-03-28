"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useDocumentSync } from "@/lib/document/use-document-sync";
import { Assistant } from "./assistant";

declare global {
  interface Window {
    tiptapEditor?: Editor;
  }
}

export function EditorPageClient({
  filename,
  useTempStorage,
}: {
  filename: string;
  useTempStorage: boolean;
}) {
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

  useEffect(() => {
    if (editor && process.env.NODE_ENV !== "production") {
      window.tiptapEditor = editor;
    }
    return () => {
      delete window.tiptapEditor;
    };
  }, [editor]);

  return (
    <div className="flex h-screen">
      <div className="flex-1 overflow-y-auto bg-gray-50 px-4 py-12">
        <div className="paper">
          <EditorContent editor={editor} />
        </div>
      </div>
      <div className="w-[400px] border-l border-border">
        <Assistant />
      </div>
    </div>
  );
}
