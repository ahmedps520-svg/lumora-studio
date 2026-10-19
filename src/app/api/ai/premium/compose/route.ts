import type Anthropic from "@anthropic-ai/sdk";
import { AiDesignSchema } from "@/lib/ai/design-format";
import { ComposeRequestSchema } from "@/lib/ai/premium";
import { buildComposeText, COMPOSE_SYSTEM, PREMIUM_PROMPT_VERSION } from "@/lib/ai/prompts/premium";
import { AiError, toErrorResponse } from "@/lib/ai/server/errors";
import { finishDesign } from "@/lib/ai/server/premium-finish";
import { guard, imageBlock, json, readJson, runRich } from "@/lib/ai/server/run";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Premium step 3 — Claude looks at the artwork and lays the design out on top of it. */
export async function POST(request: Request) {
  try {
    const input = await readJson(request, ComposeRequestSchema, 4_000_000);
    const ctx = guard(request, "compose", input.prefs, input.prompt.length + 2_000);
    const content: Anthropic.Beta.BetaContentBlockParam[] = [];
    if (input.artwork) content.push(imageBlock(input.artwork));
    content.push({ type: "text", text: buildComposeText(input) });
    const { data, usage } = await runRich(ctx, {
      task: "compose",
      prefs: input.prefs,
      system: COMPOSE_SYSTEM,
      content,
      schema: AiDesignSchema,
    });
    if (data.elements.length === 0)
      throw new AiError("invalid_output", "The design came back empty.", 502);
    const { page, fixes, palette } = finishDesign(data, input.format);
    return json({
      design: data,
      page,
      fixes,
      palette,
      usage,
      promptVersion: PREMIUM_PROMPT_VERSION,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
