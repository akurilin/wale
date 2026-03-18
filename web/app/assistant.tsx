"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import {
  AssistantChatTransport,
  useChatRuntime,
} from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";

export const Assistant = () => {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      prepareSendMessagesRequest: ({ messages }) => ({
        body: {
          mode: "chat",
          messages,
          // The backend also accepts `documentContext` with `selectionText`
          // and/or `excerpt` once the editor-side capture is wired up.
        },
      }),
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
