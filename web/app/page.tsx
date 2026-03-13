"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

declare global {
  interface Window {
    tiptapEditor?: Editor;
  }
}

export default function Home() {
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

  useEffect(() => {
    if (editor && process.env.NODE_ENV !== "production") {
      window.tiptapEditor = editor;
    }
    return () => {
      delete window.tiptapEditor;
    };
  }, [editor]);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="paper">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
