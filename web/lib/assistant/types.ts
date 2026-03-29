import { type UIMessage, validateUIMessages } from "ai";
import { z } from "zod";

const invalidAssistantRequestMessage = "Invalid assistant request payload.";

const documentHandleSchema = z.object({
  filename: z.string().trim().min(1),
  temporary: z.boolean().default(false),
});

// The assistant request can carry focused editor context in addition to chat history.
// Expand this object as we add more client-side wiring, and keep app/assistant.tsx
// aligned so the UI keeps sending the fields the backend already understands.
const documentContextSchema = z
  .object({
    selectionText: z.string().trim().min(1).optional(),
    excerpt: z.string().trim().min(1).optional(),
  })
  .refine(
    (value) => value.selectionText !== undefined || value.excerpt !== undefined,
    {
      message: "Document context must include selectionText or excerpt.",
    },
  );

const assistantRequestSchema = z.object({
  mode: z.literal("chat").default("chat"),
  messages: z.unknown(),
  document: documentHandleSchema.optional(),
  documentContext: documentContextSchema.optional(),
});

type AssistantRequestSchema = z.output<typeof assistantRequestSchema>;

export type AssistantMode = AssistantRequestSchema["mode"];
export type AssistantDocumentHandle = NonNullable<
  AssistantRequestSchema["document"]
>;
export type AssistantDocumentContext = NonNullable<
  AssistantRequestSchema["documentContext"]
>;
export type AssistantRequest = Omit<AssistantRequestSchema, "messages"> & {
  messages: UIMessage[];
};

export class AssistantRequestError extends Error {
  constructor(cause?: unknown) {
    super(invalidAssistantRequestMessage, {
      cause,
    });
    this.name = "AssistantRequestError";
  }
}

export async function parseAssistantRequest(
  input: unknown,
): Promise<AssistantRequest> {
  let parsedRequest: AssistantRequestSchema;

  try {
    parsedRequest = assistantRequestSchema.parse(input);
  } catch (error) {
    throw new AssistantRequestError(error);
  }

  try {
    const messages = await validateUIMessages({
      messages: parsedRequest.messages,
    });

    return {
      ...parsedRequest,
      messages,
    };
  } catch (error) {
    throw new AssistantRequestError(error);
  }
}
