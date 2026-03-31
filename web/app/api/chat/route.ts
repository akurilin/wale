import { runAssistant } from "@/lib/assistant/run-assistant";
import {
  AssistantRequestError,
  parseAssistantRequest,
} from "@/lib/assistant/types";

/**
 * Validates a chat request and forwards it into the assistant streaming
 * runtime. Client payload problems are mapped to 400s so only true server-side
 * failures bubble up as unhandled errors.
 */
export async function POST(req: Request) {
  try {
    const request = await parseAssistantRequest(await req.json());
    const result = await runAssistant(request);

    return result.toUIMessageStreamResponse();
  } catch (error) {
    if (
      error instanceof AssistantRequestError ||
      error instanceof SyntaxError
    ) {
      return Response.json(
        {
          error: "Invalid assistant request payload.",
        },
        {
          status: 400,
        },
      );
    }

    throw error;
  }
}
