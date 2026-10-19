import { ReviewRequestSchema, ReviewResultSchema } from "@/lib/ai/premium";
import { buildReviewText, PREMIUM_PROMPT_VERSION, REVIEW_SYSTEM } from "@/lib/ai/prompts/premium";
import { toErrorResponse } from "@/lib/ai/server/errors";
import { finishDesign } from "@/lib/ai/server/premium-finish";
import { guard, imageBlock, json, readJson, runRich } from "@/lib/ai/server/run";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Premium step 4 — Claude looks at the real render and fixes what isn't premium yet. */
export async function POST(request: Request) {
  try {
    const input = await readJson(request, ReviewRequestSchema, 4_000_000);
    const designChars = JSON.stringify(input.design).length;
    const ctx = guard(request, "review", input.prefs, input.prompt.length + designChars);
    const { data, usage } = await runRich(ctx, {
      task: "review",
      prefs: input.prefs,
      system: REVIEW_SYSTEM,
      content: [imageBlock(input.render), { type: "text", text: buildReviewText(input) }],
      schema: ReviewResultSchema,
    });
    // An empty "improvement" is never better than what we had.
    const design = data.design.elements.length > 0 ? data.design : input.design;
    const verdict = design === input.design ? "good" : data.verdict;
    const { page, fixes, palette } = finishDesign(design, input.format);
    return json({
      verdict,
      notes: data.notes.slice(0, 400),
      design,
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
