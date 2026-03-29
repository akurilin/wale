"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import type { Editor } from "@tiptap/core";
import { Thread } from "@/components/assistant-ui/thread";
import { saveDocumentToApi } from "@/lib/document/api";

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

export const Assistant = ({
  editor,
  filename,
  useTempStorage,
}: {
  editor: Editor | null;
  filename: string;
  useTempStorage: boolean;
}) => {
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

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="h-full">
        <Thread />
      </div>
    </AssistantRuntimeProvider>
  );
};
