"use client";

import { useEffect } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import type { Editor, JSONContent } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Assistant } from "./assistant";

declare global {
  interface Window {
    tiptapEditor?: Editor;
  }
}

const defaultDocument: JSONContent = {
  type: "doc",
  content: [
    {
      type: "heading",
      attrs: { level: 1 },
      content: [{ type: "text", text: "Designing a Better Writing Ritual" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "A good writing session starts before the first sentence. A small ritual, a clear screen, and a ",
        },
        {
          type: "text",
          text: "steady intention",
          marks: [{ type: "bold" }],
        },
        {
          type: "text",
          text: " can make the blank page feel less hostile.",
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Start With a Simple Frame" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Rather than chasing the perfect opening, begin with a rough frame. A title, a short thesis, and a few supporting notes are often enough to get momentum moving.",
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "This approach keeps the draft " },
        {
          type: "text",
          text: "light",
          marks: [{ type: "italic" }],
        },
        {
          type: "text",
          text: " and flexible, which makes revision easier once the real shape of the piece appears.",
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Let the Middle Be Messy" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "Most drafts improve when the writer stops editing every line on the way down. It is usually better to collect raw material first and organize it after the core idea is visible.",
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "When a section feels uncertain, leave a short note to yourself, mark the important phrase in ",
        },
        {
          type: "text",
          text: "bold",
          marks: [{ type: "bold" }],
        },
        {
          type: "text",
          text: ", and keep going instead of stalling.",
        },
      ],
    },
    {
      type: "heading",
      attrs: { level: 2 },
      content: [{ type: "text", text: "Finish by Tightening the Edges" }],
    },
    {
      type: "paragraph",
      content: [
        {
          type: "text",
          text: "The last pass is where tone, rhythm, and transitions come into focus. Read slowly, trim repeated thoughts, and keep only the sentences that still feel necessary.",
        },
      ],
    },
    {
      type: "paragraph",
      content: [
        { type: "text", text: "A draft does not need to feel " },
        {
          type: "text",
          text: "finished",
          marks: [{ type: "italic" }],
        },
        {
          type: "text",
          text: " to be useful. It only needs to leave you with something clearer than what you had before.",
        },
      ],
    },
  ],
};

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
    content: defaultDocument,
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
    <div className="flex h-screen">
      <div className="flex-1 overflow-y-auto py-12 px-4 bg-gray-50">
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
