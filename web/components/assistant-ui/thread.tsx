import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { cn } from "@/lib/utils";
import {
  ActionBarPrimitive,
  AuiIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  RefreshCwIcon,
  SquareIcon,
  TextSelectIcon,
} from "lucide-react";
import { type FC, useEffect, useState } from "react";

type ModelOption = { id: string; displayName: string };

/**
 * Fetches available Anthropic models and renders a dropdown for switching.
 */
const ModelSelector: FC<{
  modelId: string;
  onModelChange: (id: string) => void;
}> = ({ modelId, onModelChange }) => {
  const [models, setModels] = useState<ModelOption[]>([]);

  useEffect(() => {
    fetch("/api/models")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.models) setModels(data.models);
      })
      .catch(() => {});
  }, []);

  if (models.length === 0) return null;

  return (
    <select
      value={modelId}
      onChange={(e) => onModelChange(e.target.value)}
      className="w-full rounded-md border bg-background px-2 py-1.5 text-xs text-muted-foreground outline-none hover:border-ring/50 focus:border-ring/75"
      aria-label="Select model"
    >
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.displayName}
        </option>
      ))}
    </select>
  );
};

/**
 * Composes the assistant conversation viewport, welcome state, and composer
 * into one cohesive sidebar UI.
 */
export const Thread: FC<{
  selectionText?: string;
  modelId: string;
  onModelChange: (id: string) => void;
}> = ({ selectionText, modelId, onModelChange }) => {
  return (
    <ThreadPrimitive.Root
      className="aui-root aui-thread-root @container flex h-full flex-col bg-background"
      style={{
        ["--thread-max-width" as string]: "44rem",
        ["--composer-radius" as string]: "24px",
        ["--composer-padding" as string]: "10px",
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        className="aui-thread-viewport relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth px-4 pt-4"
      >
        <AuiIf condition={(s) => s.thread.isEmpty}>
          <ThreadWelcome />
        </AuiIf>

        <ThreadPrimitive.Messages
          components={{
            UserMessage,
            EditComposer,
            AssistantMessage,
          }}
        />

        <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer sticky bottom-0 mx-auto mt-auto flex w-full max-w-(--thread-max-width) flex-col gap-4 overflow-visible rounded-t-(--composer-radius) bg-background pb-4 md:pb-6">
          <ThreadScrollToBottom />
          <Composer selectionText={selectionText} />
          <div className="px-1">
            <ModelSelector modelId={modelId} onModelChange={onModelChange} />
          </div>
        </ThreadPrimitive.ViewportFooter>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
};

/**
 * Gives the user a quick way to jump back to the latest assistant output when
 * the conversation has scrolled upward.
 */
const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom className="absolute -top-12 z-10 self-center rounded-full border bg-background p-2 shadow-sm hover:bg-accent disabled:invisible">
      <ArrowDownIcon className="size-4" />
    </ThreadPrimitive.ScrollToBottom>
  );
};

/**
 * Empty-state copy shown before the thread has any messages.
 */
const ThreadWelcome: FC = () => {
  return (
    <div className="aui-thread-welcome-root mx-auto my-auto flex w-full max-w-(--thread-max-width) grow flex-col">
      <div className="aui-thread-welcome-center flex w-full grow flex-col items-center justify-center">
        <div className="aui-thread-welcome-message flex size-full flex-col justify-center px-4">
          <h1 className="font-semibold text-2xl">Hello there!</h1>
          <p className="text-muted-foreground text-xl">
            How can I help you today?
          </p>
        </div>
      </div>
    </div>
  );
};

/**
 * Shows a compact indicator inside the composer when the user has text selected
 * in the editor, so they know the selection will be sent as additional context.
 */
const SelectionChip: FC<{ text: string }> = ({ text }) => {
  const lines = text.split("\n").filter((l) => l.trim().length > 0).length;

  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-muted/60 px-2.5 py-1 text-xs text-muted-foreground">
      <TextSelectIcon className="size-3 shrink-0" />
      <span className="min-w-0 truncate">
        {lines <= 1 ? `"${text}"` : `${lines} lines selected`}
      </span>
    </div>
  );
};

/**
 * Wraps the assistant-ui composer with the local visual styling used in the
 * sidebar.
 */
const Composer: FC<{ selectionText?: string }> = ({ selectionText }) => {
  return (
    <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
      <div className="flex w-full flex-col gap-2 rounded-(--composer-radius) border bg-background p-(--composer-padding) transition-shadow focus-within:border-ring/75 focus-within:ring-2 focus-within:ring-ring/20">
        {selectionText && <SelectionChip text={selectionText} />}
        <ComposerPrimitive.Input
          placeholder="Send a message..."
          className="aui-composer-input max-h-32 min-h-10 w-full resize-none bg-transparent px-1.75 py-1 text-sm outline-none placeholder:text-muted-foreground/80"
          rows={1}
          autoFocus
          aria-label="Message input"
        />
        <ComposerAction />
      </div>
    </ComposerPrimitive.Root>
  );
};

/**
 * Swaps the composer action between send and cancel depending on whether the
 * assistant is currently streaming.
 */
const ComposerAction: FC = () => {
  return (
    <div className="aui-composer-action-wrapper relative flex items-center justify-end">
      <AuiIf condition={(s) => !s.thread.isRunning}>
        <ComposerPrimitive.Send
          className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90"
          aria-label="Send message"
        >
          <ArrowUpIcon className="size-4" />
        </ComposerPrimitive.Send>
      </AuiIf>
      <AuiIf condition={(s) => s.thread.isRunning}>
        <ComposerPrimitive.Cancel
          className="size-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90"
          aria-label="Stop generating"
        >
          <SquareIcon className="size-3 fill-current" />
        </ComposerPrimitive.Cancel>
      </AuiIf>
    </div>
  );
};

/**
 * Renders request-level assistant errors inline with the affected message.
 */
const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="aui-message-error-root mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-destructive text-sm">
        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

/**
 * Defines the presentation of assistant-authored messages, including markdown
 * rendering and per-message controls.
 */
const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      className="aui-assistant-message-root relative mx-auto w-full max-w-(--thread-max-width) py-3"
      data-role="assistant"
    >
      <div className="aui-assistant-message-content wrap-break-word px-2 text-foreground leading-relaxed">
        <MessagePrimitive.Parts
          components={{
            Text: MarkdownText,
          }}
        />
        <MessageError />
      </div>

      <div className="aui-assistant-message-footer mt-1 ml-2 flex min-h-6 items-center">
        <BranchPicker />
        <AssistantActionBar />
      </div>
    </MessagePrimitive.Root>
  );
};

/**
 * Exposes lightweight assistant message actions without adding another custom
 * state layer on top of assistant-ui's primitives.
 */
const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-assistant-action-bar-root -ml-1 flex gap-1 text-muted-foreground"
    >
      <ActionBarPrimitive.Copy className="hover:bg-accent rounded p-1">
        <AuiIf condition={(s) => s.message.isCopied}>
          <CheckIcon className="size-4" />
        </AuiIf>
        <AuiIf condition={(s) => !s.message.isCopied}>
          <CopyIcon className="size-4" />
        </AuiIf>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload className="hover:bg-accent rounded p-1">
        <RefreshCwIcon className="size-4" />
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
};

/**
 * Defines the layout for user-authored messages in the thread.
 */
const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      className="aui-user-message-root mx-auto grid w-full max-w-(--thread-max-width) auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 py-3 [&:where(>*)]:col-start-2"
      data-role="user"
    >
      <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
        <div className="aui-user-message-content wrap-break-word rounded-2xl bg-muted px-4 py-2.5 text-foreground">
          <MessagePrimitive.Parts />
        </div>
      </div>

      <BranchPicker className="col-span-full col-start-1 row-start-3 -mr-1 justify-end" />
    </MessagePrimitive.Root>
  );
};

/**
 * Renders the inline message editor used when assistant-ui allows editing a
 * previously sent user message.
 */
const EditComposer: FC = () => {
  return (
    <MessagePrimitive.Root className="aui-edit-composer-wrapper mx-auto flex w-full max-w-(--thread-max-width) flex-col px-2 py-3">
      <ComposerPrimitive.Root className="aui-edit-composer-root ml-auto flex w-full max-w-[85%] flex-col rounded-2xl bg-muted">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input min-h-14 w-full resize-none bg-transparent p-4 text-foreground text-sm outline-none"
          autoFocus
        />
        <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center gap-2 self-end">
          <ComposerPrimitive.Cancel className="px-3 py-1.5 text-sm rounded-md hover:bg-accent">
            Cancel
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90">
            Update
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
};

/**
 * Lets the user step through alternate branches for a single message when the
 * assistant runtime exposes regenerations.
 */
const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "aui-branch-picker-root mr-2 -ml-2 inline-flex items-center text-muted-foreground text-xs",
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous className="hover:bg-accent rounded p-0.5">
        <ChevronLeftIcon className="size-4" />
      </BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next className="hover:bg-accent rounded p-0.5">
        <ChevronRightIcon className="size-4" />
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};
