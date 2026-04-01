"use client";

import { useCallback, useEffect, useState } from "react";
import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import type { Editor } from "@tiptap/core";
import { Thread } from "@/components/assistant-ui/thread";
import { saveDocumentToApi } from "@/lib/document/api";
import type { DocumentMeta } from "@/lib/document/envelope";
import { useChatPersistence } from "@/lib/assistant/use-chat-persistence";

const DEFAULT_MODEL_ID = "claude-haiku-4-5";

/**
 * Extracts the currently selected plain text from the editor for prompt
 * context. Empty selections intentionally collapse to `undefined` so the
 * assistant payload only includes focused context when it is actually useful.
 */
function getSelectionText(editor: Editor | null): string | undefined {
  if (!editor) {
    return undefined;
  }

  const { from, to, empty } = editor.state.selection;
  if (empty) {
    return undefined;
  }

  const text = editor.state.doc.textBetween(from, to, "\n\n").trim();
  return text.length > 0 ? text : undefined;
}

/**
 * Hosts the assistant-ui runtime for the current editor session.
 * Before sending a message it flushes the latest editor content to storage so
 * server-side assistant tools always operate on the canonical document state.
 */
export const Assistant = ({
  editor,
  filename,
  useTempStorage,
}: {
  editor: Editor | null;
  filename: string;
  useTempStorage: boolean;
}) => {
  const [selectionText, setSelectionText] = useState<string | undefined>();
  const [modelId, setModelId] = useState(DEFAULT_MODEL_ID);

  // Load persisted model selection from document metadata on mount
  useEffect(() => {
    const params = new URLSearchParams({ file: filename });
    if (useTempStorage) params.set("tmp", "true");

    fetch(`/api/document/usage?${params.toString()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((meta: DocumentMeta | null) => {
        if (meta?.selectedModel) setModelId(meta.selectedModel);
      })
      .catch(() => {});
  }, [filename, useTempStorage]);

  const handleModelChange = useCallback(
    (id: string) => {
      setModelId(id);

      const params = new URLSearchParams({ file: filename });
      if (useTempStorage) params.set("tmp", "true");

      fetch(`/api/document/usage?${params.toString()}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selectedModel: id }),
      }).catch(() => {});
    },
    [filename, useTempStorage],
  );

  useEffect(() => {
    if (!editor) return;

    const handleTransaction = () => {
      setSelectionText(getSelectionText(editor));
    };

    editor.on("transaction", handleTransaction);
    return () => {
      editor.off("transaction", handleTransaction);
    };
  }, [editor]);

  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      prepareSendMessagesRequest: async ({ messages }) => {
        const selectionText = getSelectionText(editor);

        if (editor) {
          await saveDocumentToApi(filename, useTempStorage, editor.getJSON());
        }

        return {
          body: {
            mode: "chat",
            messages,
            model: modelId,
            document: {
              filename,
              temporary: useTempStorage,
            },
            ...(selectionText
              ? {
                  documentContext: {
                    selectionText,
                  },
                }
              : {}),
          },
        };
      },
    }),
  });

  useChatPersistence(runtime, filename, useTempStorage);

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="h-full">
        <Thread
          selectionText={selectionText}
          modelId={modelId}
          onModelChange={handleModelChange}
        />
      </div>
    </AssistantRuntimeProvider>
  );
};
