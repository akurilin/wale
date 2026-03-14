import { runAssistant } from "@/lib/assistant/run-assistant";
import {
  AssistantRequestError,
  parseAssistantRequest,
} from "@/lib/assistant/types";

export async function POST(req: Request) {
  try {
    const request = await parseAssistantRequest(await req.json());
    const result = await runAssistant(request);

    return result.toUIMessageStreamResponse();
  } catch (error) {
    if (error instanceof AssistantRequestError || error instanceof SyntaxError) {
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
