import { NextResponse } from "next/server";

type AnthropicModel = {
  id: string;
  display_name: string;
};

type AnthropicModelsResponse = {
  data: AnthropicModel[];
  has_more: boolean;
  last_id: string;
};

/** Fetches available models from the Anthropic API and returns a trimmed list. */
export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured." },
      { status: 500 },
    );
  }

  try {
    const models: Array<{ id: string; displayName: string }> = [];
    let afterId: string | undefined;

    // Paginate through all available models
    do {
      const url = new URL("https://api.anthropic.com/v1/models");
      url.searchParams.set("limit", "100");
      if (afterId) url.searchParams.set("after_id", afterId);

      const res = await fetch(url.toString(), {
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
      });

      if (!res.ok) {
        return NextResponse.json(
          { error: `Anthropic API returned ${res.status}.` },
          { status: 502 },
        );
      }

      const body = (await res.json()) as AnthropicModelsResponse;
      for (const m of body.data) {
        if (m.id.startsWith("claude-")) {
          models.push({ id: m.id, displayName: m.display_name });
        }
      }

      afterId = body.has_more ? body.last_id : undefined;
    } while (afterId);

    models.sort((a, b) => a.displayName.localeCompare(b.displayName));

    return NextResponse.json({ models });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch models from Anthropic." },
      { status: 502 },
    );
  }
}
