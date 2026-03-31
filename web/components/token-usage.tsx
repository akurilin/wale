"use client";

import { useEffect, useState } from "react";
import type { DocumentMeta } from "@/lib/document/envelope";

// Pricing per million tokens (USD) keyed by model family prefix.
// Dated model IDs (e.g. claude-haiku-4-5-20260215) are matched by stripping
// the date suffix, so new point releases pick up the right price automatically.
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-4-6": { input: 15, output: 75 },
  "claude-opus-4-5": { input: 15, output: 75 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-sonnet-4-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 0.8, output: 4 },
};

/** Strips the trailing -YYYYMMDD date suffix from a model ID if present. */
function modelFamily(modelId: string): string {
  return modelId.replace(/-\d{8}$/, "");
}

const POLL_INTERVAL_MS = 5000;

/** Computes total dollar cost across all models in the usage map. */
function computeCost(usage: DocumentMeta["usage"]): {
  totalCost: number;
  hasUnknownModel: boolean;
} {
  let totalCost = 0;
  let hasUnknownModel = false;

  for (const [modelId, tokens] of Object.entries(usage)) {
    const pricing = PRICING[modelId] ?? PRICING[modelFamily(modelId)];
    if (pricing) {
      totalCost +=
        (tokens.inputTokens / 1_000_000) * pricing.input +
        (tokens.outputTokens / 1_000_000) * pricing.output;
    } else {
      console.error(
        `No pricing found for model "${modelId}" (family "${modelFamily(modelId)}"). Cost estimate will be incomplete.`,
      );
      hasUnknownModel = true;
    }
  }

  return { totalCost, hasUnknownModel };
}

/** Formats a token count with a compact suffix (e.g. 12.5k). */
function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

/**
 * Shows cumulative token usage and estimated cost for the current document.
 * Polls the document usage API and displays a small overlay in the editor.
 */
export function TokenUsage({
  filename,
  useTempStorage,
}: {
  filename: string;
  useTempStorage: boolean;
}) {
  const [usage, setUsage] = useState<DocumentMeta["usage"] | null>(null);

  useEffect(() => {
    const params = new URLSearchParams({ file: filename });
    if (useTempStorage) params.set("tmp", "true");
    const url = `/api/document/usage?${params.toString()}`;

    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(url);
        if (res.ok && !cancelled) {
          const meta = (await res.json()) as DocumentMeta;
          setUsage(meta.usage);
        }
      } catch {
        // Silently skip failed polls
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [filename, useTempStorage]);

  if (!usage || Object.keys(usage).length === 0) return null;

  let totalInput = 0;
  let totalOutput = 0;
  for (const tokens of Object.values(usage)) {
    totalInput += tokens.inputTokens;
    totalOutput += tokens.outputTokens;
  }

  const { totalCost, hasUnknownModel } = computeCost(usage);

  return (
    <div className="fixed right-[416px] bottom-4 z-10 rounded-lg border bg-background/80 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <span title="Input tokens">{formatTokens(totalInput)} in</span>
        <span title="Output tokens">{formatTokens(totalOutput)} out</span>
        {totalCost > 0 && (
          <span className="font-medium" title="Estimated cost">
            ${totalCost < 0.01 ? totalCost.toFixed(4) : totalCost.toFixed(2)}
            {hasUnknownModel ? "+" : ""}
          </span>
        )}
      </div>
    </div>
  );
}
